import type { Row } from "./client.ts";

export type BetVolumeTotals = {
  pool: string;
  recordedTrades: number;
  settledTrades: number;
  openTrades: number;
  valuedTrades: number;
  entryValue: string;
  leveragedValue: string;
};

/** Original USD entry values, never current collateral prices or token amounts. */
export function betVolumeTotals(rows: Row[], pool: string): BetVolumeTotals {
  const unique = new Map<string, Row>();
  for (const row of rows) {
    if (row.pool !== pool || ![0, 1, 2].includes(row.state)) continue;
    const previous = unique.get(row.key);
    if (!previous || !row.archived || previous.archived)
      unique.set(row.key, row);
  }
  let entry = 0n,
    leveraged = 0n,
    valuedTrades = 0,
    openTrades = 0,
    settledTrades = 0;
  for (const row of unique.values()) {
    if (row.state === 0) {
      if (!row.archived) openTrades++;
    } else settledTrades++;
    if (
      !/^\d+$/.test(String(row.entryValue)) ||
      BigInt(row.entryValue) <= 0n ||
      !Number.isInteger(row.leverage) ||
      row.leverage < 1 ||
      row.leverage > 1000
    )
      continue;
    entry += BigInt(row.entryValue);
    leveraged += BigInt(row.entryValue) * BigInt(row.leverage);
    valuedTrades++;
  }
  return {
    pool,
    recordedTrades: unique.size,
    settledTrades,
    openTrades,
    valuedTrades,
    entryValue: String(entry),
    leveragedValue: String(leveraged),
  };
}
