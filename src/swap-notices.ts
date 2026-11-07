import { isPrimary, type AssetInfo, type Row } from "./client.ts";
import { MAX_ACTIVITY_TOASTS, WALLET_TOAST_MS } from "./wallet-notices.ts";
import { isFresh, sellUsd } from "./math.ts";

export type SwapToast = {
  id: string; from: AssetInfo; to: AssetInfo; input: bigint; output: bigint; expiresAt: number;
  /** Executable USD estimate of the receipt, frozen at notification time. */
  usd: bigint | null;
};
const uint = (value: unknown) => typeof value === "string" && /^\d+$/.test(value) ? BigInt(value) : null;
const identity = (p: Row) => `${p.key}:${p.nonce}:${p.openedSlot}`;

/** Watches the existing platform-wide confirmed receipt stream. Initial
 * history is silent; late receipts for new closes still emit exactly once. */
export class SwapToastQueue {
  private seen = new Set<string>();
  private startedAt: number | undefined;
  private entries: SwapToast[] = [];

  ingest(positions: Row[], pools: Row[], assets: ReadonlyMap<string, AssetInfo>, now: number, quotes: Row[] = []): SwapToast[] {
    if (this.startedAt === undefined) {
      this.startedAt = Math.floor(now / 1000);
      for (const p of positions) if (p.state !== 0) this.seen.add(identity(p));
      return [];
    }
    const added: SwapToast[] = [];
    for (const p of positions) {
      const id = identity(p);
      if (p.state === 0 || this.seen.has(id) || Number(p.closedAt) < this.startedAt) continue;
      const receipt = p.settlementReceipt;
      const pool = pools.find(row => row.key === p.pool);
      const from = assets.get(p.collateral), to = assets.get(pool?.settlement);
      if (!pool || !from || !to || !isPrimary(to) || p.collateral === pool.settlement || !receipt?.signature) continue;
      // This is the whole loss-conversion route: original collateral consumed
      // -> net ACIDPUMP received after its gas allocation and execution fees.
      // Both amounts are confirmed, including receipts recovered from truncated
      // logs. Do not reconstruct a historical input from today's fee ratio.
      const input = uint(p.loss), output = uint(receipt.acidReceived);
      if (input === null || output === null || input <= 0n || output <= 0n) continue;
      let usd: bigint | null = null;
      try {
        const quote = quotes.find(q => q.id === to.feedId);
        if (isFresh(quote, now)) usd = sellUsd(output, quote!);
      } catch { /* Unavailable valuation is not a zero-dollar swap. */ }
      this.seen.add(id);
      added.push({ id, from: { ...from }, to: { ...to }, input, output, usd, expiresAt: now + WALLET_TOAST_MS });
    }
    this.entries.unshift(...added.reverse());
    this.entries = this.entries.slice(0, MAX_ACTIVITY_TOASTS);
    return added;
  }

  active(now: number) {
    this.entries = this.entries.filter(entry => entry.expiresAt > now);
    return [...this.entries];
  }
}
