import type { Row } from "../src/client.ts";

/** ER positions copy opened_source_slot into openedSlot. That source can be
 * MagicBlock rather than base Solana, so it cannot bound base-chain receipts.
 * Position PDAs are nonce-specific; receipt readers still verify the exact
 * position and settled amounts. Legacy base positions retain their slot bound. */
export function baseHistoryStartSlot(position: Row): number {
  if (Number.isInteger(position.erSlot) && position.erSlot >= 0) return 0;
  return Number(position.openedSlot ?? 0);
}
