import type { Snapshot } from "./client.ts";
import { isFresh } from "./math.ts";
import { collateralFresh, erCollateralFresh, withSolCollateralPrice } from "./collateral-value.ts";
import { coreBacking } from "./core-backing.ts";
import { poolExposureValue } from "./risk.ts";
import { PRICE_WAIT_MS, priceTimeoutMessage } from "./price-retry.ts";

export const OPEN_PRICE_WAIT_MS = PRICE_WAIT_MS;
export const OPEN_PRICE_TIMEOUT = priceTimeoutMessage("open");
export type OpeningSnapshot = { snapshot: Snapshot; receivedAt: number };
export type OpeningBacking = { owner: string; asset: string; exemptAssets: readonly string[] };

/** Check a single coherent snapshot, including time spent in the browser.
 * Reading an old snapshot again must never reset its freshness. */
export function openingPrices(sample: OpeningSnapshot | undefined, marketKey: string, quoteId: number, collateralKey: string, now = Date.now(), requiredBacking?: OpeningBacking) {
  if (!sample) return;
  const { snapshot, receivedAt } = sample;
  const elapsed = Math.max(0, now - receivedAt);
  // Quotes use the validator/server clock, not the user's computer clock.
  // Preserve elapsed time after receipt so rereading a snapshot cannot renew it.
  if (!Number.isFinite(snapshot.serverTime) || snapshot.serverTime <= 0) return;
  // Solana's Clock and quote timestamps use whole Unix seconds. Match that
  // boundary instead of expiring a valid quote up to a second too early.
  const priceNow = Math.floor((snapshot.serverTime + elapsed) / 1000) * 1000;
  // Use the same coherent clock for pool admission. An expired observation
  // waits for the existing stream instead of reporting a bet-size failure.
  const poolUsd = poolExposureValue(snapshot.poolExposure, priceNow);
  if (poolUsd === null) return;
  if ((snapshot.snapshotAgeMs ?? Infinity) + elapsed >= 15_000 ||
      (snapshot.erSnapshotAgeMs ?? Infinity) + elapsed >= 5_000 ||
      snapshot.erHistory?.canOpen !== true) return;
  const market = snapshot.markets.find(row => row.key === marketKey);
  const feed = snapshot.feeds.find(row => row.key === market?.feed);
  let quote = snapshot.quotes.find(row => row.id === quoteId);
  const erQuote = snapshot.erQuotes?.find(row => row.asset === collateralKey);
  if (quoteId === 103) {
    if (erQuote?.baseReserve !== '0' || !erQuote.feeBps?.every((fee: number) => fee === 0)) return;
    quote = withSolCollateralPrice(quote ?? { key: collateralKey, id: 103 },
      { key: collateralKey, price: erQuote.quoteReserve, publishTime: erQuote.publishTime });
  }
  // A fresh base reserve quote can still be awaiting publication on the rollup.
  // Match the actual ER account's freshness checks before preparing the bet.
  if (!erCollateralFresh(erQuote, priceNow, quoteId === 103 ? 'sol' : quoteId === 104 ? 'usdc' : 'pool')) return;
  if (!isFresh(feed, priceNow) || !collateralFresh(quote, priceNow) ||
      priceNow / 1000 - Number(feed!.publishTime) > 3 ||
      (quoteId !== 103 && priceNow / 1000 - Number(quote!.publishTime) > 3)) return;
  let backing: ReturnType<typeof coreBacking> | undefined;
  if (requiredBacking) {
    const trader = snapshot.erTraders?.find(row => row.owner === requiredBacking.owner);
    const coreQuote = snapshot.erQuotes?.find(row => row.asset === requiredBacking.asset);
    if (!trader?.coreStake || !coreQuote) return;
    try {backing = coreBacking(trader, coreQuote, priceNow, requiredBacking.exemptAssets, snapshot.erQuotes);}
    catch {return;}
  }
  return { snapshot, market: market!, feed: feed!, quote: quote!, backing, poolUsd };
}

/** Wait only on the existing live stream. Never retry or time out a submitted
 * transaction here: an ambiguous send must not produce a duplicate bet. */
export async function waitForOpeningPrices(
  read: () => OpeningSnapshot | undefined,
  marketKey: string,
  quoteId: number,
  collateralKey: string,
  options: { deadline?: number; backing?: OpeningBacking; onWait?: () => void; assertActive?: () => void; now?: () => number; pause?: (ms: number) => Promise<void> } = {},
) {
  const now = options.now ?? Date.now;
  const pause = options.pause ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const deadline = Math.min(options.deadline ?? Infinity, now() + OPEN_PRICE_WAIT_MS);
  let waiting = false;
  while (now() < deadline) {
    options.assertActive?.();
    const prices = openingPrices(read(), marketKey, quoteId, collateralKey, now(), options.backing);
    if (now() >= deadline) break;
    if (prices) return prices;
    if (!waiting) { waiting = true; options.onWait?.(); }
    await pause(Math.min(100, Math.max(0, deadline - now())));
  }
  throw Error(OPEN_PRICE_TIMEOUT);
}
