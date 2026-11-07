import type { Row } from "./client.ts";
import { pumpPathUsd } from './pump-quote-path.ts';
export const ceil = (a: bigint, b: bigint) => (a + b - 1n) / b;
export const HIGH_POOL_THRESHOLD = 2_000_000_000_000n;
export function lossSplit(loss: bigint, venue = false, queued = false, poolUsd = 0n, native = false, perps = false) {
  const gas = loss / 100n;
  const buyback = venue && !queued ? loss * (perps ? (poolUsd > HIGH_POOL_THRESHOLD ? 14n : 1n) : native ? (poolUsd > HIGH_POOL_THRESHOLD ? 19n : 2n) : (poolUsd > HIGH_POOL_THRESHOLD ? 9n : 1n)) / 100n : 0n;
  return { acid: loss - gas - buyback, gas, ...(venue ? {buyback} : {}) };
}
export function acidSplit(received: bigint, queued = false, venue = false, poolUsd = 0n, native = false, perps = false) {
  if (queued) return { market: received, stakers: 0n, burn: 0n };
  const high=poolUsd>HIGH_POOL_THRESHOLD;
  if(perps) {
    const total=high?75n:8n,reserved=received*total/(high?85n:98n);
    const operations=reserved*(high?20n:2n)/total,burn=reserved*(high?5n:1n)/total;
    return {market:received-reserved,stakers:reserved-operations-burn,operations,burn};
  }
  const denominator=native?(high?80n:97n):venue?(high?90n:98n):99n;
  const stakers=received*(high?70n:7n)/denominator, burn=native?0n:received*(venue?(high?10n:1n):(high?19n:2n))/denominator;
  return {market:received-stakers-burn,stakers,burn};
}
export function sellUsd(amount: bigint, f: Row): bigint {
  if (f.id===104 && f.quoteCollateral===true) return amount;
  const base = BigInt(f.baseReserve),
    quote = BigInt(f.quoteReserve);
  if (f.mainnet?.usdPerQuoteAtomE21 !== undefined) return pumpPathUsd(amount, [{
    baseReserve: base, realQuoteReserve: BigInt(f.realQuoteReserve),
    effectiveQuoteReserve: quote, feeBps: f.feeBps,
  }], BigInt(f.mainnet.usdPerQuoteAtomE21));
  if (f.mainnet && (amount === 0n || base === 0n || BigInt(f.realQuoteReserve) === 0n)) return 0n;
  if (base <= 0n) throw Error("Collateral quote unavailable");
  const gross = (amount * quote) / (base + amount);
  const costs = (f.feeBps as number[]).map(x => ceil(gross * BigInt(x), 10000n));
  // Pump retains the LP fee in the pool. Mainnet's contract values a bag at
  // zero when the whole sale cannot execute, matching its collateral floor.
  if (f.mainnet && gross - costs[0] > BigInt(f.realQuoteReserve)) return 0n;
  if (!f.mainnet && gross > BigInt(f.realQuoteReserve))
    throw Error("Collateral sale exceeds available reserves");
  const fees = costs.reduce((sum,cost) => sum+cost,0n);
  return (
    ((gross > fees ? gross - fees : 0n) * BigInt(f.quoteUsd)) /
    (10n ** BigInt(f.quoteDecimals) * 1000000n)
  );
}
export const debit = (amount: bigint, price: bigint, decimals: number) =>
  ceil(amount * price, 10n ** BigInt(decimals) * 1000000n);
export const isFresh = (f?: Row, now = Date.now()) =>
  !!f &&
  BigInt(f.price) > 0n &&
  now / 1000 - Number(f.publishTime) <= (f.erNative ? 3 : f.id === 4 ? 5 : 10) &&
  Number(f.publishTime) <= now / 1000 + 2;
export function crossed(x: Row, f: Row) {
  const hit = (p: string) =>
    x.long ? BigInt(p) <= BigInt(x.bust) : BigInt(p) >= BigInt(x.bust);
  return (
    x.bustObserved ||
    hit(f.price) ||
    (f.observations ?? []).some(
      (o: any) => BigInt(o.sequence) > BigInt(x.cursor) && hit(o.price),
    )
  );
}
export function pnl(
  margin: bigint,
  entry: bigint,
  exit: bigint,
  lev: number,
  long: boolean,
) {
  const win = long ? exit > entry : exit < entry,
    diff = exit > entry ? exit - entry : entry - exit;
  if (!win)
    return -[margin, (margin * BigInt(lev) * diff) / entry].reduce((a, b) =>
      a < b ? a : b,
    );
  const dead = entry / 50000n;
  if (diff <= dead) return 0n;
  const gross = (margin * BigInt(lev) * (diff - dead)) / entry,
    movement = (diff * 1000000000000n) / entry;
  return (gross * movement) / (movement + 100000000n);
}
export const normalizeAmountInput = (value: string) => value.startsWith('.') ? '0' + value : value;
export function parseUnits(s: string, decimals: number) {
  s = normalizeAmountInput(s);
  if (!/^\d+(\.\d*)?$/.test(s)) throw Error("Enter a positive amount");
  const [a, b = ""] = s.split(".");
  if (b.length > decimals) throw Error("Too many decimals");
  return BigInt(a) * 10n ** BigInt(decimals) + BigInt(b.padEnd(decimals, "0"));
}
