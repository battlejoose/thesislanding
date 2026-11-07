export const FLAT_THRESHOLD = 100_000_000_000n;
export const MIN_REWARD_THRESHOLD = 1_000_000_000_000n;
export const POOL_CAP = 5_000_000_000_000n;
const FP = 1_000_000_000_000n;
/** Mirrors emissions.rs, using each pool's pre-settlement executable USD value. */
export function rewardFactor(poolUsd: bigint) {
  if (poolUsd <= FLAT_THRESHOLD) return FP;
  if (poolUsd >= MIN_REWARD_THRESHOLD) return FP / 10n;
  return FP - (poolUsd - FLAT_THRESHOLD) * (FP * 9n / 10n)
    / (MIN_REWARD_THRESHOLD - FLAT_THRESHOLD);
}
/** Existing high-water storage is preserved but no longer determines issuance. */
export function emissionQuote(tokens: bigint, _basis: bigint, poolUsd: bigint, _advance: bigint, hwm: bigint) {
  if (tokens < 0n) throw Error('Invalid reward token amount');
  return {issued: tokens * 100n * rewardFactor(poolUsd) / FP, highwater: hwm};
}
