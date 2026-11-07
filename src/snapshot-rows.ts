/** Version 2 transport only. Account contents and their original ordering are
 * unchanged; missing baselines must resync instead of guessing balances. */
export type KeyedRow = Record<string, unknown> & { key: string };
export type RowPatch = { upsert: KeyedRow[]; remove: string[]; order?: string[] };
export const ROW_FIELDS = new Set([
  'positions', 'ownershipReceipts', 'erTraders', 'feeds', 'quotes', 'markets',
  'exposures', 'custodies', 'inventories', 'assets', 'pools', 'ownershipPools',
  'ownershipTraders', 'gasReserves', 'erQuotes',
]);
export function indexRows(value: unknown): Map<string, KeyedRow> | undefined {
  if (!Array.isArray(value)) return;
  const rows = new Map<string, KeyedRow>();
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || typeof row.key !== 'string' || !row.key || rows.has(row.key)) return;
    rows.set(row.key, row);
  }
  return rows;
}
export function applyRowPatch(previous: unknown, patch: RowPatch): KeyedRow[] {
  const rows = indexRows(previous), updates = indexRows(patch?.upsert);
  if (!rows || !updates || !Array.isArray(patch.remove) || new Set(patch.remove).size !== patch.remove.length)
    throw Error('Invalid row patch');
  for (const key of patch.remove) {
    if (typeof key !== 'string' || !rows.has(key) || updates.has(key)) throw Error('Invalid row removal');
    rows.delete(key);
  }
  for (const [key, row] of updates) rows.set(key, row);
  if (patch.order !== undefined) {
    if (!Array.isArray(patch.order) || patch.order.length !== rows.size || new Set(patch.order).size !== rows.size ||
        patch.order.some(key => typeof key !== 'string' || !rows.has(key))) throw Error('Invalid row order');
    return patch.order.map(key => rows.get(key)!);
  }
  return [...rows.values()];
}
