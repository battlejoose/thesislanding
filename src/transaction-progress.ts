export type TransactionStage =
  "preparing" | "preparing-collateral" | "waiting-prices" | "signing" | "sending" | "confirming" | "updating" |
  "er-confirming" | "syncing-collateral" | "checking-collateral" | "recovering-collateral" | "committing" | "awaiting-base" | "settlement-queue" |
  "preparing-settlement" | "settling-base" | "crediting" | "settlement-retry";

export type ReportProgress = (stage: TransactionStage) => void;
export const progressLabels: Record<TransactionStage, string> = {
  preparing: "Preparing transaction",
  "preparing-collateral": "Preparing your token balance",
  "waiting-prices": "Waiting for fresh prices · up to 3s",
  signing: "Signing locally",
  sending: "Checking & sending",
  confirming: "Confirming on Solana",
  "syncing-collateral": "Syncing trading collateral",
  updating: "Updating position",
  "er-confirming": "Confirming on rollup",
  "checking-collateral": "Verifying lowest collateral value",
  "recovering-collateral": "Exit price locked · recovering token history",
  committing: "Price locked · committing close",
  "awaiting-base": "Waiting for Solana commit",
  "settlement-queue": "Waiting for settlement turn",
  "preparing-settlement": "Preparing swaps & settlement",
  "settling-base": "Settling tokens on Solana",
  crediting: "Returning funds to your balance",
  "settlement-retry": "Settlement delayed · retrying safely",
};

/** Synchronous per-action locks: a second click cannot slip in before React renders.
 * Distinct positions remain independent, including when one fails. */
export class PendingActions {
  private keys = new Set<string>();
  has(key: string) {
    return this.keys.has(key);
  }
  async run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
    if (this.keys.has(key)) return;
    this.keys.add(key);
    try {
      return await action();
    } finally {
      this.keys.delete(key);
    }
  }
}
