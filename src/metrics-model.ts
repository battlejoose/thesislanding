import type { PoolHistoryPoint, Row, Snapshot } from "./client.ts";
import { CORE_MARKETS } from "./core-markets.ts";
import { isFresh, sellUsd } from "./math.ts";
import { spotUsd } from "./spot-value.ts";
import { betVolumeTotals } from "./metrics-volume.ts";
import { baseHistoryStartSlot } from "../server/position-history.ts";

export interface MetricsModel {
  ready: boolean;
  stale: boolean;
  quoteFresh: boolean;
  poolUsd: number | null;
  poolTokens: number;
  trades: number;
  openPositions: number;
  openNotionalUsd: number;
  payoutTokens: number;
  stakedTokens: number;
  issuedTokens: number;
  rewardsFunded: number;
  gasSolBought: number;
  queueUsd: number;
  queueCount: number;
  queue: Array<{ key: string; owner: string; sequence: string; remainingUsd: number }>;
  markets: Array<{ symbol: string; openNotionalUsd: number }>;
  queueComplete: boolean;
  betVolumeUsd: number | null;
  leveragedVolumeUsd: number | null;
  rewardsPaidTokens: number | null;
  burnedTokens: number | null;
  rewardsPaidUsd: number | null;
  burnedUsd: number | null;
  volumeComplete: boolean;
  burnComplete: boolean;
  historyCoverage: {
    recordedTrades: number;
    totalTrades: number;
    recordedLosses: number;
    verifiedBurnReceipts: number;
  };
  poolHistory: PoolHistoryPoint[];
}

const knownAtoms = (value: unknown): bigint | null => {
  if (value === undefined || value === null || !/^\d+$/.test(String(value))) return null;
  try { return BigInt(String(value)); } catch { return null; }
};
const atoms = (value: unknown): bigint => {
  try {
    const amount = BigInt(String(value ?? 0));
    return amount > 0n ? amount : 0n;
  } catch {
    return 0n;
  }
};
const total = (rows: Row[], field: string) =>
  rows.reduce((sum, row) => sum + atoms(row[field]), 0n);

/** Live accounts outrank their display archives if a caller supplies both. */
function uniquePositions(rows: Row[], pool: string | undefined): Row[] {
  const result = new Map<string, Row>();
  for (const row of rows) {
    if (row.pool !== pool) continue;
    const previous = result.get(row.key);
    if (!previous || !row.archived || previous.archived) result.set(row.key, row);
  }
  return [...result.values()];
}

function verifiedBurn(position: Row): bigint | null {
  const receipt = position.settlementReceipt;
  if (!receipt || position.settlementReceiptUnavailable || typeof receipt.signature !== "string" ||
    !receipt.signature || !Number.isSafeInteger(receipt.slot) || receipt.slot < 0) return null;
  const received = knownAtoms(receipt.acidReceived), pool = knownAtoms(receipt.poolTokens),
    stakers = knownAtoms(receipt.stakerTokens), burned = knownAtoms(receipt.burnedTokens),
    recordedPool = knownAtoms(position.swappedOut);
  if (received === null || pool === null || stakers === null || burned === null || recordedPool === null ||
    received !== pool + stakers + burned || pool !== recordedPool ||
    receipt.slot < baseHistoryStartSlot(position)) return null;
  return burned;
}

export type PositionHistoryTotals = { pool: string; settledTrades: number; validStates: boolean;
  burnValid: boolean; burnedAtoms: string; recordedLosses: number; verifiedBurnReceipts: number };
/** Derived from the complete server archive before the public history window.
 * This carries the same receipt checks as the full browser snapshot. */
export function positionHistoryTotals(rows: Row[], pool: string): PositionHistoryTotals {
  const history = uniquePositions(rows, pool);
  let burnValid = true, burnedAtoms = 0n, recordedLosses = 0, verifiedBurnReceipts = 0;
  for (const row of history) {
    if (row.state === 0) continue;
    const loss = knownAtoms(row.loss);
    if (loss === null) { burnValid = false; continue; }
    if (loss === 0n) continue;
    recordedLosses++;
    const burned = verifiedBurn(row);
    if (burned === null) burnValid = false;
    else { burnedAtoms += burned; verifiedBurnReceipts++; }
  }
  return { pool, settledTrades: history.filter(row => row.state !== 0).length,
    validStates: history.every(row => [0, 1, 2].includes(row.state)), burnValid,
    burnedAtoms: String(burnedAtoms), recordedLosses, verifiedBurnReceipts };
}

/** Permanent counters, current accounts, and executable quotes stay separate. */
export function platformMetrics(state: Snapshot, now = Date.now()): MetricsModel {
  const pool = state.pools.find((row) => row.id === 0);
  const inventory = state.inventories.find(
    (row) => row.pool === pool?.key && row.asset === pool?.settlement,
  );
  const asset = state.assets.find((row) => row.key === pool?.settlement);
  const ownership = state.ownershipPools?.find((row) => row.pool === pool?.key);
  const traders = (state.ownershipTraders ?? []).filter((row) => row.pool === pool?.key);
  const quote = state.quotes.find((row) => row.id === asset?.id);
  const decimals = Number(asset?.decimals ?? 6);
  const tokens = (value: bigint) => Number(value) / 10 ** decimals;
  const knownTreasury = knownAtoms(inventory?.treasury);
  const treasury = knownTreasury ?? 0n;
  const elapsed = Math.max(0, now - state.serverTime);
  const stale = !Number.isFinite(now) || state.serverTime <= 0 || now - state.serverTime > 20_000 ||
    (state.snapshotAgeMs !== undefined && (state.snapshotAgeMs === null || state.snapshotAgeMs + elapsed > 20_000)) ||
    (state.accountSnapshotAgeMs !== undefined && (state.accountSnapshotAgeMs === null ||
      !Number.isFinite(state.accountSnapshotAgeMs) || state.accountSnapshotAgeMs < 0 || state.accountSnapshotAgeMs + elapsed > 20_000));
  let poolUsd: number | null = null;
  if (inventory && !stale) {
    try {
      // A confirmed zero balance is $0 without a price. Unknown balances are
      // not zero-filled, and funded pools still require a valid sell quote.
      if (knownTreasury === 0n) poolUsd = 0;
      else if (knownTreasury !== null && isFresh(quote, now)) poolUsd = Number(spotUsd(treasury, quote!)) / 1e6;
    } catch {
      // A missing/invalid executable quote is not a zero-value treasury.
    }
  }
  const markets = CORE_MARKETS.map(({ id, symbol }) => {
    const row = state.markets.find((market) => market.id === id && market.pool === pool?.key);
    return { symbol, openNotionalUsd: Number(atoms(row?.longOi) + atoms(row?.shortOi)) / 1e6 };
  });
  const history = uniquePositions(state.positions, pool?.key);
  const positions = history.filter((row) => !row.archived);
  const tradeCount = knownAtoms(pool?.trades);
  const openPositions = positions.filter(row => row.state === 0).length;
  const historical = state.positionHistoryTotals?.find(row => row.pool === pool?.key) ?? positionHistoryTotals(history, pool?.key ?? '');
  const historyComplete = !!pool && tradeCount !== null && BigInt(historical.settledTrades) === tradeCount && historical.validStates;
  const volumes = state.betVolumeTotals?.find(row => row.pool === pool?.key) ?? betVolumeTotals(history, pool?.key ?? "");
  const entryTotal = knownAtoms(volumes.entryValue), leveragedTotal = knownAtoms(volumes.leveragedValue);
  const volumeComplete = tradeCount !== null && BigInt(volumes.settledTrades) === tradeCount &&
    volumes.openTrades === openPositions && volumes.valuedTrades === volumes.recordedTrades &&
    volumes.recordedTrades === volumes.settledTrades + volumes.openTrades && entryTotal !== null && leveragedTotal !== null;
  const burnComplete = historyComplete && historical.burnValid, burnTotal = BigInt(historical.burnedAtoms);
  const { recordedLosses, verifiedBurnReceipts } = historical;
  // These accounts are permanent. Matching cumulative issuance proves that the
  // snapshot includes every trader before presenting their claims as a total.
  const claimedTraders = [...new Map(traders.map((row) => [row.key, row])).values()];
  const rewardsComplete = !!(ownership && asset && state.ownershipTraders) &&
    knownAtoms(ownership.supply) !== null &&
    claimedTraders.every((row) => knownAtoms(row.issued) !== null && knownAtoms(row.claimed) !== null) &&
    total(claimedTraders, "issued") === knownAtoms(ownership.supply);
  const rewardsPaid = rewardsComplete ? total(claimedTraders, "claimed") : null;
  const burned = burnComplete || verifiedBurnReceipts > 0 ? burnTotal : null;
  // Cumulative token totals get a current-price equivalent, not a hypothetical
  // sale of every historical reward/burn or an invented historical cash total.
  const currentUsd = (amount: bigint | null): number | null => {
    if (amount === null || !asset || stale || !Number.isInteger(decimals) || decimals < 0 || decimals > 255) return null;
    try {
      if (!isFresh(quote, now)) return null;
      return Number(amount * BigInt(quote!.price) / 10n ** BigInt(decimals)) / 1e12;
    } catch { return null; }
  };
  const head = atoms(pool?.queueHead), tail = atoms(pool?.queueTail);
  const queueCount = tail >= head ? Number(tail - head) : 0;
  const pending = positions.filter((row) => row.state !== 0 && atoms(row.remaining) > 0n &&
    atoms(row.queueSeq) >= head && atoms(row.queueSeq) < tail)
    .sort((a, b) => atoms(a.queueSeq) < atoms(b.queueSeq) ? -1 : atoms(a.queueSeq) > atoms(b.queueSeq) ? 1 : 0);
  const queue = pending.map((row) => ({
    key: row.key,
    owner: String(row.owner),
    sequence: (atoms(row.queueSeq) - head + 1n).toString(),
    remainingUsd: Number(atoms(row.remaining)) / 1e6,
  }));
  const ready = !!(pool && inventory && asset && ownership);
  return {
    ready,
    stale,
    quoteFresh: poolUsd !== null,
    poolUsd,
    poolTokens: tokens(treasury),
    trades: Number(atoms(pool?.trades)) + openPositions,
    openPositions,
    openNotionalUsd: markets.reduce((sum, market) => sum + market.openNotionalUsd, 0),
    payoutTokens: tokens(atoms(inventory?.paid)),
    stakedTokens: tokens(atoms(ownership?.totalStaked)),
    issuedTokens: tokens(atoms(ownership?.supply)),
    // Reserved rewards plus persistent actual claims: never infer revenue from loss percentages.
    rewardsFunded: tokens(atoms(ownership?.rewardPool) + atoms(ownership?.feePending) + total(traders, "claimed")),
    gasSolBought: Number(total(state.gasReserves ?? [], "solReceived")) / 1e9,
    queueUsd: Number(atoms(pool?.queueUsd)) / 1e6,
    queueCount,
    queue,
    queueComplete: !!pool && tail >= head && pending.length === queueCount &&
      total(pending, "remaining") === atoms(pool.queueUsd) && new Set(pending.map((row) => String(row.queueSeq))).size === queueCount,
    markets,
    betVolumeUsd: entryTotal !== null && (volumes.valuedTrades > 0 || volumeComplete) ? Number(entryTotal) / 1e6 : null,
    leveragedVolumeUsd: leveragedTotal !== null && (volumes.valuedTrades > 0 || volumeComplete) ? Number(leveragedTotal) / 1e6 : null,
    rewardsPaidTokens: rewardsPaid !== null ? tokens(rewardsPaid) : null,
    burnedTokens: burned !== null ? tokens(burned) : null,
    rewardsPaidUsd: currentUsd(rewardsPaid),
    burnedUsd: currentUsd(burned),
    volumeComplete,
    burnComplete,
    historyCoverage: { recordedTrades: volumes.valuedTrades, totalTrades: Number(tradeCount ?? 0n) + openPositions, recordedLosses, verifiedBurnReceipts },
    poolHistory: state.poolHistory ?? [],
  };
}
