import type { Row } from './client.ts';
import { isFresh, sellUsd } from './math.ts';
import { normalizeMainnetRow } from './quote-context.ts';

/** The rollup requires both the pool quote and its USD conversion to be fresh. */
export function erCollateralFresh(quote: Row | undefined, now = Date.now(), kind: 'pool' | 'sol' | 'usdc' = 'pool'): boolean {
  if (!quote) return false;
  quote = normalizeMainnetRow(quote);
  // Native collateral leaves the mainnet conversion context zeroed on chain.
  // Match ErQuote::fresh/value, keeping the normal quote-age checks for both.
  if (kind === 'usdc' && quote.isQuote !== true) return false;
  if (kind === 'sol' && (quote.isQuote !== false || quote.baseReserve !== '0' ||
      BigInt(quote.quoteReserve ?? 0) <= 0n || quote.feeBps?.length !== 3 ||
      !quote.feeBps.every((fee: number) => fee === 0))) return false;
  const stamp = Number(quote.publishTime), conversionStamp = Number(quote.mainnet?.conversionPublishTime);
  return Number.isFinite(stamp) && stamp > 0 && stamp <= now / 1000 + 2 && now / 1000 - stamp <= 3 &&
    BigInt(quote.sourceSlot ?? 0) > 0n && (kind !== 'pool' || !quote.mainnet ||
      (Number.isFinite(conversionStamp) && conversionStamp > 0 && conversionStamp <= stamp && now / 1000 - conversionStamp <= 3));
}

/** Keep execution reserves separate from SOL's MagicBlock collateral value. */
export function withSolCollateralPrice(quote: Row | undefined, sol: Row | undefined): Row | undefined {
  if (!quote || quote.id !== 103) return quote;
  return { ...quote, solPrice: sol?.price, solPublishTime: sol?.publishTime };
}
export function collateralUsd(amount: bigint, quote: Row): bigint {
  if (quote.id !== 103) return sellUsd(amount, quote);
  const price = BigInt(quote.solPrice ?? 0);
  if (price <= 0n) throw Error('SOL collateral price unavailable');
  return amount * price / 1_000_000_000_000_000n;
}
export function collateralFresh(quote: Row | undefined, now = Date.now()): boolean {
  return quote?.id === 103
    ? isFresh({ key: quote.key, price: quote.solPrice ?? '0', publishTime: quote.solPublishTime ?? 0, erNative: true }, now)
    : isFresh(quote, now);
}
