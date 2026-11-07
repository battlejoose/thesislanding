export interface ArrivalCriteria {
  market: string;
  collateral: string;
  margin: string;
  leverage: number;
  long: boolean;
}

export interface ArrivalRow extends ArrivalCriteria {
  key: string;
  openedAt: string | number;
  archived?: boolean;
  state?: number;
}

export interface ArrivalRequest {
  criteria: ArrivalCriteria;
  existingKeys: ReadonlySet<string>;
  startedAt: number;
}

/** Match real, confirmed snapshot rows, never optimistic placeholder positions.
 * A trade can already be liquidated by the time the next snapshot reaches us. */
export function findPositionArrival<T extends ArrivalRow>(
  rows: readonly T[],
  request: ArrivalRequest,
  snapshotAgeMs: number | null | undefined,
): T | undefined {
  if (
    snapshotAgeMs == null ||
    !Number.isFinite(snapshotAgeMs) ||
    snapshotAgeMs < 0 ||
    snapshotAgeMs >= 15_000
  )
    return;
  const c = request.criteria;
  return rows.find((row) => {
    const openedAt = Number(row.openedAt);
    return (
      !request.existingKeys.has(row.key) &&
      !row.archived &&
      Number.isFinite(openedAt) &&
      openedAt >= Math.floor(request.startedAt / 1000) - 2 &&
      row.market === c.market &&
      row.collateral === c.collateral &&
      row.margin === c.margin &&
      row.leverage === c.leverage &&
      row.long === c.long
    );
  });
}
