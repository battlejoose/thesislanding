/** USD prices use the same 1e12 scale as the contract. Supply, fees and
 * historical full-bag swap estimates do not enter the price-floor rule. */
export function relativeCollateralValue(entryValue: bigint, entryPrice: bigint, price: bigint) {
  if (entryValue < 0n || entryPrice <= 0n || price < 0n) throw Error("Invalid collateral price baseline");
  return entryValue * (price < entryPrice ? price : entryPrice) / entryPrice;
}
export type CollateralPriceObservation = { sequence: string; publishTime: number; price: string };
export type PriceFloorInterval = { openedSequence: string; openedAt: number; closedAt: number;
  entryValue: bigint; entryPrice: bigint; ceiling: bigint };

/** Sequence numbers are local per-asset counters, never base-chain or ER slots.
 * Missing observations need backfill; endpoint prices cannot exclude a dip. */
export function replayRelativePriceFloor(observations: CollateralPriceObservation[], interval: PriceFloorInterval) {
  const unsigned = (value: string) => /^\d{1,20}$/.test(value) && BigInt(value) <= (1n << 64n) - 1n;
  if (!unsigned(interval.openedSequence) || BigInt(interval.openedSequence) === 0n ||
      !Number.isSafeInteger(interval.openedAt) || !Number.isSafeInteger(interval.closedAt) ||
      interval.openedAt <= 0 || interval.closedAt < interval.openedAt || interval.entryPrice <= 0n ||
      interval.entryValue < 0n || interval.ceiling < 0n || interval.ceiling > interval.entryValue)
    throw Error("Invalid relative-price recovery interval");
  const unique = new Map<string, CollateralPriceObservation>();
  for (const row of observations) {
    if (!unsigned(row.sequence) || !unsigned(row.price) || !Number.isSafeInteger(row.publishTime) || row.publishTime <= 0)
      throw Error("Invalid historical collateral price");
    const previous = unique.get(row.sequence);
    if (previous && (row.price !== previous.price || row.publishTime !== previous.publishTime))
      throw Error("Conflicting historical collateral prices");
    unique.set(row.sequence, row);
  }
  const rows = [...unique.values()].filter(row => BigInt(row.sequence) >= BigInt(interval.openedSequence))
    .sort((a,b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1);
  const entry = rows[0];
  if (!entry || entry.sequence !== interval.openedSequence || BigInt(entry.price) !== interval.entryPrice ||
      entry.publishTime > interval.openedAt || interval.openedAt - entry.publishTime > 3)
    throw Error("Missing or mismatched entry collateral price");
  let value = interval.ceiling, previous = entry;
  const used: CollateralPriceObservation[] = [];
  for (const row of rows) {
    if (used.length && (BigInt(row.sequence) !== BigInt(previous.sequence) + 1n || row.publishTime < previous.publishTime || row.publishTime - previous.publishTime > 10))
      throw Error("Collateral price history needs backfill");
    used.push(row);
    // Include the closing second. A post-close observation proves coverage,
    // but cannot change the outcome even if its price is much lower.
    if (row.publishTime > interval.closedAt) return { value, observations: used };
    const observed = relativeCollateralValue(interval.entryValue, interval.entryPrice, BigInt(row.price));
    if (observed < value) value = observed;
    previous = row;
  }
  throw Error("Waiting for collateral prices through the frozen close");
}
