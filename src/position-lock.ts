import type { Row } from "./client.ts";

/** Never infer a lock from a click, progress label, or send acknowledgement.
 * Only a confirmed ER exit fixes the market price; base settlement fixes USD. */
export function positionLock(position: Row): "price" | "settled" | null {
  if (position.state === 1 || position.state === 2) return "settled";
  try {
    if (position.erPending === true && BigInt(position.exit ?? 0) > 0n && BigInt(position.closedAt ?? 0) > 0n)
      return "price";
  } catch { /* An incomplete snapshot is not a confirmed close. */ }
  return null;
}
