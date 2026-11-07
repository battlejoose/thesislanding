import type { AssetInfo } from "./client.ts";
import type { WalletDelta } from "./wallet-changes.ts";

export type WalletNotice = { id: number; changes: WalletDelta[]; assets: AssetInfo[] };
export type WalletToast = {
  id: string;
  change: WalletDelta;
  asset: AssetInfo;
  receivedAt: number;
  expiresAt: number;
};
export const WALLET_TOAST_MS = 5_000;
export const MAX_ACTIVITY_TOASTS = 5;

/** Notice IDs increase monotonically. Replaying a React backlog is harmless. */
export class WalletToastQueue {
  private lastNoticeId = -Infinity;
  private entries: WalletToast[] = [];

  ingest(notices: readonly WalletNotice[], now: number): WalletToast[] {
    const added: WalletToast[] = [];
    this.active(now);
    for (const notice of [...notices].sort((a, b) => a.id - b.id)) {
      if (notice.id <= this.lastNoticeId) continue;
      this.lastNoticeId = notice.id;
      const batch = notice.changes.flatMap((change, index) => {
        const asset = notice.assets.find(a => a.mint === change.mint);
        if (!asset || change.amount === 0n) return [];
        return [{
          id: `${notice.id}:${index}`,
          change: { ...change },
          asset: { ...asset },
          receivedAt: now,
          expiresAt: now + WALLET_TOAST_MS,
        }];
      });
      this.entries.unshift(...batch);
      added.unshift(...batch);
    }
    this.entries = this.entries.slice(0, MAX_ACTIVITY_TOASTS);
    return added;
  }

  active(now: number): WalletToast[] {
    this.entries = this.entries.filter(entry => entry.expiresAt > now);
    return [...this.entries];
  }
}
