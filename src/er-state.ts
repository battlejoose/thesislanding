import { PublicKey } from "@solana/web3.js";
import { pk, type Deployment, type Row, type Snapshot } from "./client.ts";
import { DEVNET_ADDRESSES, DEVNET_PROGRAM_ID, programAddresses } from "./program-addresses.ts";
import { CORE_MARKETS } from "./core-markets.ts";
import { withSolCollateralPrice } from "./collateral-value.ts";
import { collateralGeneration, pendingCollateralCredits } from "./collateral-generations.ts";

export const { erTraderPda, erCustodyPda, erRiskPda, erQuotePda, collateralHistoryPda, collateralGuardPda, erFeePayerPda } = DEVNET_ADDRESSES;
export const ER_VALIDATOR = new PublicKey("MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd");
export const DELEGATION_PROGRAM = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");

export type ErState = { programId?: string; /** Created market's config; absent for the root market. */ venueConfig?: string; traders: Row[]; quotes: Row[]; histories?: Row[]; guards?: Row[]; risk?: Row; poolExposure?: Row; feePayer?: Row; slot: number; updatedAt: number };
export const emptyErState = (): ErState => ({ traders: [], quotes: [], slot: 0, updatedAt: 0 });

/** The compact on-chain ring stores only prices. Its sequence gives each
 * retained entry an unambiguous sequence number, including after wraparound. */
export function erMarketFeed(market: Row): Row {
  if (!market.prices) return market;
  const sequence = BigInt(market.sequence), observations: {sequence:string;price:string}[] = [];
  for (let cursor = sequence > 63n ? sequence - 63n : 1n; cursor <= sequence; cursor++)
    observations.push({ sequence: String(cursor), price: String(market.prices[Number(cursor % 64n)]) });
  return { ...market, observations };
}

export function tradingBalances(state: Snapshot, owner: string, deployment?: Deployment | null) {
  const { assetPda } = programAddresses(deployment?.programId ?? state.programId ?? DEVNET_PROGRAM_ID);
  const trader = state.erTraders?.find((row) => row.owner === owner);
  return Object.fromEntries((deployment?.assets ?? []).map((asset) => [
    asset.mint,
    BigInt(trader?.assets?.find((row: Row) => row.asset === assetPda(pk(asset.mint)).toBase58())?.available ?? 0),
  ]));
}

/** Confirmed credits awaiting ER acknowledgement are not spendable yet, but
 * they must be counted when deciding whether another deposit is necessary. */
export function pendingTradingCredit(state: Snapshot, owner: string, mint: string) {
  const { assetPda } = programAddresses(state.programId ?? DEVNET_PROGRAM_ID);
  const asset=assetPda(pk(mint)).toBase58();
  const custody=state.custodies?.find(row=>row.owner===owner);
  const trader=state.erTraders?.find(row=>row.owner===owner);
  if(collateralGeneration(custody?.generation)<collateralGeneration(trader?.custodyGeneration))return 0n;
  return pendingCollateralCredits(custody?.assets.find((row:Row)=>row.asset===asset),trader?.assets.find((row:Row)=>row.asset===asset));
}

export function pendingErIntents(state: ErState): Row[] {
  return state.traders.flatMap((trader) => (trader.slots as Row[]).flatMap((slot, index) =>
    slot.state === 2 ? [{ ...slot, slot: index, owner: trader.owner, trader: trader.key, pool: trader.pool } as Row] : [],
  )).sort((a, b) => BigInt(a.closeSeq) < BigInt(b.closeSeq) ? -1 : BigInt(a.closeSeq) > BigInt(b.closeSeq) ? 1 : 0);
}

/** Base snapshots own actual swaps/payouts. ER snapshots own open reservations.
 * Their slots are deliberately independent; a larger ER slot proves nothing
 * about the freshness of a base account. */
export function mergeErState(base: Snapshot, er: ErState, now = Date.now()): Snapshot {
  if (base.programId && er.programId && base.programId !== er.programId) throw Error("Cannot merge states from different deployments");
  const programId = er.programId ?? base.programId ?? DEVNET_PROGRAM_ID;
  const { positionPda, marketPda, feedPda } = programAddresses(programId, er.venueConfig);
  const positions = new Map(base.positions.map((position) => [position.key, position]));
  for (const trader of er.traders) {
    const guard = er.guards?.find(row=>row.owner===trader.owner);
    for (const [index, slot] of (trader.slots as Row[]).entries()) {
      const floor=guard?.floors[index];
      if (![1, 2].includes(slot.state) || slot.kind !== 1) continue;
      const key = positionPda(pk(trader.owner), BigInt(slot.nonce)).toBase58();
      const settled = positions.get(key);
      if (settled && settled.state !== 0 && String(settled.nonce) === String(slot.nonce)) continue;
      positions.set(key, {
        ...slot, key, owner: trader.owner, pool: trader.pool,
        coreBacked: trader.coreStake !== undefined,
        collateralLow: trader.coreStake !== undefined ? slot.entryValue : floor && String(floor.nonce) === String(slot.nonce) ? floor.value : undefined,
        collateralEntryPrice: floor && String(floor.nonce) === String(slot.nonce) ? floor.entryPrice : undefined,
        collateralHistoryIncomplete: trader.coreStake !== undefined ? false : floor && String(floor.nonce) === String(slot.nonce) ? floor.incomplete : true,
        market: marketPda(feedPda(slot.market)).toBase58(), collateral: slot.asset,
        openedSlot: slot.openedSourceSlot, state: 0,
        erTrader: trader.key, erSlot: index, erPending: slot.state === 2,
        settlementPhase: slot.state === 2 ? "settling" : "open",
        // These values only become authoritative after the base close. In
        // particular, an ER intent cannot imply that any profit was paid.
        profit: "0", remaining: "0", loss: "0", returned: "0", swappedOut: "0",
      });
    }
  }
  const marketRows = er.risk?.markets as Row[] | undefined;
  const feeds = marketRows ? CORE_MARKETS.map(({ id, symbol }) => ({
    ...erMarketFeed(marketRows[id]), key: feedPda(id).toBase58(), id, symbol, erNative: true,
  })) : [];
  const markets = base.markets.map((market) => marketRows?.[market.id] ? {
    ...market, ...marketRows[market.id], capRefreshedAt: er.risk!.capRefreshedAt,
  } : market);
  return {
    ...base, programId, positions: [...positions.values()], feeds, markets,
    quotes: base.quotes.map(quote => withSolCollateralPrice(quote, feeds.find(feed => feed.id === 2))!),
    exposures: er.traders.map((trader) => ({ key: trader.key, owner: trader.owner, notional: trader.notional })),
    erTraders: er.traders, erRisk: er.risk, poolExposure: er.poolExposure, erQuotes: er.quotes,
    erFeePayer: er.feePayer,
    erContextSlot: er.slot,
    erSnapshotAgeMs: er.updatedAt ? Math.max(0, now - er.updatedAt) : null,
  };
}

