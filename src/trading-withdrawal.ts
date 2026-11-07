import type { Snapshot } from "./client.ts";

/** A base receipt alone is not enough: the ER must also have consumed and
 * released the exact signed withdrawal nonce. Later reuse of that slot is OK. */
export function withdrawalAcknowledged(
  state: Snapshot,
  owner: string,
  slot: number,
  nonce: bigint,
): boolean {
  if (!owner || !Number.isSafeInteger(slot) || slot < 0 || nonce <= 0n)
    return false;
  const custody = state.custodies?.find((row) => row.owner === owner);
  const trader = state.erTraders?.find((row) => row.owner === owner);
  // Bound both sides by their actual account layout (8 on legacy devnet,
  // 50 after the production migration), never by a historical constant.
  if (!Array.isArray(custody?.receipts) || !Array.isArray(trader?.slots) ||
      slot >= custody.receipts.length || slot >= trader.slots.length) return false;
  const receipt = custody?.receipts?.[slot];
  const current = trader?.slots?.[slot];
  if (!receipt || receipt.settled !== true || !current || !trader) return false;
  try {
    const receiptNonce = BigInt(receipt.nonce);
    if (receiptNonce < nonce || BigInt(trader.nextNonce) <= nonce) return false;
    if (receiptNonce === nonce && receipt.kind !== 2) return false;
    // Reject even a malformed matching open slot; only release or a later
    // nonce proves this withdrawal is no longer reserving the slot.
    if (current.state !== 0 && BigInt(current.nonce) === nonce) return false;
    if (current.state !== 0 && BigInt(current.nonce) < nonce) return false;
    return [0, 1, 2].includes(current.state);
  } catch {
    return false;
  }
}

export type TradingWithdrawalState = {
  wallet: bigint;
  available: bigint;
  pendingCredit?: bigint;
  pendingWithdrawal?: bigint;
};

const waiting = (state: TradingWithdrawalState) =>
  (state.pendingCredit ?? 0n) > 0n || (state.pendingWithdrawal ?? 0n) > 0n;

/** Gather the selected token before an external wallet send. This function
 * never closes positions and never treats their locked collateral as available.
 * The caller holds its wallet mutation lock for this flow AND the final send. */
export async function restoreWithdrawalBalance(
  requested: bigint,
  actions: {
    read: () => Promise<TradingWithdrawalState>;
    /** Resolve only after this exact intent's base custody receipt and ER
     * acknowledgement are verified. An uncertain submission must reject; it
     * must never be resubmitted under another nonce here. */
    withdraw: (amount: bigint) => Promise<void>;
    onProgress?: (step: string) => void;
    pause?: () => Promise<void>;
    now?: () => number;
    timeoutMs?: number;
  },
): Promise<TradingWithdrawalState> {
  if (requested <= 0n) throw Error("Enter a withdrawal amount greater than zero");
  const now = actions.now ?? Date.now;
  const deadline = now() + (actions.timeoutMs ?? 180_000);
  const checkDeadline = () => {
    if (now() >= deadline)
      throw Error("Your tokens are still settling. No external withdrawal has been sent. Please retry after settlement completes.");
  };
  const pause = async () => {
    checkDeadline();
    await (actions.pause?.() ?? new Promise<void>((resolve) => setTimeout(resolve, 500)));
    checkDeadline();
  };
  actions.onProgress?.("Checking available tokens…");
  let state = await actions.read();
  for (;;) {
    checkDeadline();
    if (waiting(state)) {
      actions.onProgress?.("Waiting for token settlement…");
      await pause();
      state = await actions.read();
      continue;
    }
    if (state.available > 0n) {
      const amount = state.available;
      const walletAfterReturn = state.wallet + amount;
      actions.onProgress?.("Returning tokens to your wallet…");
      // No catch/retry: a failed or uncertain signed intent is reconciled by
      // the caller/backend, never replaced by another withdrawal here.
      await actions.withdraw(amount);
      checkDeadline();
      actions.onProgress?.("Confirming returned tokens…");
      for (;;) {
        state = await actions.read();
        checkDeadline();
        if (!waiting(state) && state.wallet >= walletAfterReturn) break;
        await pause();
      }
      // A position may have settled while the transfer was completing. Drain
      // any newly acknowledged available credit only after the prior intent's
      // acknowledgement AND actual wallet increase have both been verified.
      continue;
    }
    if (state.wallet < requested)
      throw Error("Not enough available tokens for this withdrawal. Tokens in open positions remain locked.");
    actions.onProgress?.("Sending to your wallet address…");
    return state;
  }
}
