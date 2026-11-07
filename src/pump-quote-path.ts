/** Integer-only Pump sale composition. Each hop consumes the exact net output
 * of the preceding hop, including each fee's ceiling and real-liquidity bound.
 * Callers must authenticate the pools and denomination bindings separately. */
export type PumpSaleQuote = {
  baseReserve: bigint;
  realQuoteReserve: bigint;
  effectiveQuoteReserve: bigint;
  feeBps: readonly number[];
};

// One collateral curve, an optional Pump-coin parent, and its conversion pool.
export const MAX_PUMP_QUOTE_LEGS = 3;
const U64_MAX = (1n << 64n) - 1n;
const u64 = (value: bigint) => typeof value === 'bigint' && value >= 0n && value <= U64_MAX;

function validatePath(legs: readonly PumpSaleQuote[]) {
  if (legs.length > MAX_PUMP_QUOTE_LEGS) throw Error('Pump quote path exceeds supported depth');
  for (const leg of legs) {
    if (![leg.baseReserve, leg.realQuoteReserve, leg.effectiveQuoteReserve].every(u64) ||
        leg.feeBps.length !== 3 || leg.feeBps.some(f => !Number.isInteger(f) || f < 0 || f >= 10000) ||
        leg.feeBps.reduce((sum, f) => sum + f, 0) >= 10000 ||
        (leg.baseReserve > 0n && leg.realQuoteReserve > 0n && leg.effectiveQuoteReserve === 0n))
      throw Error('Invalid Pump quote path reserves or fees');
  }
}

/** Zero is a verified unexecutable full-bag quote, not a substitute for missing
 * or malformed source data. Invalid later legs are checked even after zero. */
export function pumpPathOutput(amount: bigint, legs: readonly PumpSaleQuote[], collateral = true): bigint {
  if (!u64(amount)) throw Error('Pump quote amount is outside u64 range');
  validatePath(legs);
  let output = amount;
  for (const leg of legs) {
    if (output === 0n) continue;
    if (leg.baseReserve === 0n || leg.realQuoteReserve === 0n) {
      if (!collateral) throw Error('Pump quote path has no executable liquidity');
      output = 0n; continue;
    }
    const gross = output * leg.effectiveQuoteReserve / (leg.baseReserve + output);
    const fees = leg.feeBps.map(f => (gross * BigInt(f) + 9999n) / 10000n);
    const total = fees.reduce((sum, f) => sum + f, 0n);
    // LP fees remain in an AMM. A bonding curve has a zero LP fee.
    if (gross - fees[0] > leg.realQuoteReserve || total > gross) {
      if (!collateral) throw Error('Pump quote path cannot execute the full amount');
      output = 0n; continue;
    }
    output = gross - total;
  }
  return output;
}

export function pumpPathUsd(amount: bigint, legs: readonly PumpSaleQuote[], usdPerFinalAtomE21: bigint): bigint {
  if (usdPerFinalAtomE21 <= 0n || usdPerFinalAtomE21 > 1_000_000_000_000_000_000n)
    throw Error('Invalid quote-token USD conversion');
  const value = pumpPathOutput(amount, legs) * usdPerFinalAtomE21 / 1_000_000_000_000_000n;
  if (!u64(value)) throw Error('Pump quote USD value is outside u64 range');
  return value;
}
