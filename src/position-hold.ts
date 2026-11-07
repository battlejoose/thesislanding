export const MIN_MANUAL_HOLD_MS = 5_000;

/** Display only. The ER program enforces the same hold using its own clock. */
export function manualCloseRemainingMs(position: { state: number; erPending?: boolean; openedAt?: unknown }, nowMs: number): number | null {
  if (position.state !== 0 || position.erPending) return 0;
  const openedAt = Number(position.openedAt);
  if (!Number.isFinite(nowMs) || !Number.isSafeInteger(openedAt) || openedAt <= 0) return null;
  return Math.min(MIN_MANUAL_HOLD_MS, Math.max(0, openedAt * 1_000 + MIN_MANUAL_HOLD_MS - nowMs));
}
