import type { Row } from './client.ts';
import { estimateProfitTokens } from './ownership.ts';
import { settlementClaimAmounts, settlementWalletPayout, settlementWalletTokenPayout } from './settlement-story.ts';

/** Return on the original collateral USD value, not the leveraged notional. */
export function positionReturnPercent(pnl: bigint | null, entryValue: unknown): string {
  try {
    const entry = BigInt(String(entryValue));
    if (pnl === null || entry <= 0n) return '—';
    const absolute = pnl < 0n ? -pnl : pnl;
    const hundredths = (absolute * 10_000n + entry / 2n) / entry;
    return `${pnl < 0n ? '−' : '+'}${hundredths / 100n}.${String(hundredths % 100n).padStart(2, '0')}%`;
  } catch { return '—'; }
}

/** Confirmed transfers stay fixed. Only the unpaid USD debt is repriced. */
export function positionProfitTokens(position: Row, pnl: bigint | null, quote?: Row, now = Date.now()) {
  if (position.state === 0) return {
    total: estimateProfitTokens(pnl, quote, now), paid: 0n, queued: null,
    legacyUsd: 0n, estimated: true,
  };
  const { remaining, paid: paidUsd } = settlementClaimAmounts(position);
  const paid = settlementWalletTokenPayout(position), legacyUsd = settlementWalletPayout(position);
  // Do not show an estimate for malformed/incomplete claim accounting.
  const queued = paidUsd === null ? null : estimateProfitTokens(remaining, quote, now);
  return { paid, queued, legacyUsd, estimated: remaining !== null && remaining > 0n,
    total: paid !== null && queued !== null ? paid + queued : null };
}
