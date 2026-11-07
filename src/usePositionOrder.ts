import { useLayoutEffect, useRef } from "react";
import type { Row } from "./client.ts";
import {
  advancePositionOrder,
  orderPositions,
  type PositionOrderState,
} from "./position-order.ts";

/** Derive the pin before painting the first closed snapshot. Commit history
 * only after rendering, so an abandoned React render cannot consume a close. */
export function usePositionOrder<T extends Row>(
  positions: readonly T[],
  receipts: Readonly<Record<string, number>>,
  now: number,
  owner: string,
): T[] {
  const committed = useRef<PositionOrderState>();
  const next = advancePositionOrder(
    committed.current,
    positions,
    receipts,
    now,
    owner,
  );
  useLayoutEffect(() => {
    committed.current = next;
  });
  return orderPositions(positions, new Set(next.retained.keys()));
}
