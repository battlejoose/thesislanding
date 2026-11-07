import { pk, type AssetInfo, type Row } from "./client.ts";
import type { ProgramAddresses } from "./program-addresses.ts";
import { WalletChanges, type WalletDelta } from "./wallet-changes.ts";
import { collateralGeneration } from "./collateral-generations.ts";

const atoms = (value: unknown) => {
  if (typeof value !== "string" || !/^\d+$/.test(value)) throw Error("Incomplete balance");
  return BigInt(value);
};
type Withdrawal = { slot: number; nonce: bigint; asset: string; amount: bigint };

/** Notification accounting only, never spendable credit. Pending internal
 * transfers remain part of the same wallet. Base wallet and custody MUST come
 * from one bank read; ER observations must already have passed SnapshotOrder. */
export class UnifiedWalletChanges {
  private owner = "";
  private changes = new WalletChanges();
  private sequence = 0;
  private assetKeys = new Map<string, string>();
  private withdrawals = new Map<string, Withdrawal>();

  constructor(private readonly addresses: Pick<ProgramAddresses, "assetPda">) {}

  observe(owner: string, wallet: Record<string, bigint>, trader: Row | undefined,
    custody: Row | undefined, assets: AssetInfo[]): WalletDelta[] {
    if (owner !== this.owner) {
      this.owner = owner;
      this.changes = new WalletChanges();
      this.withdrawals.clear();
    }
    try {
      if ((trader && trader.owner !== owner) || (custody && custody.owner !== owner)) return [];
      if (custody && !trader) return [];
      // Different record lifetimes cannot be reconciled by subtracting their
      // cumulative counters. Wait for the streams to agree before announcing.
      if (trader && custody && collateralGeneration(trader.custodyGeneration) !== collateralGeneration(custody.generation)) return [];
      // A base withdrawal ahead of our ER stream has an unknown amount until
      // the intent arrives. Wait rather than announce a false incoming balance.
      if (custody?.receipts?.some((r: Row) => r.settled && r.kind === 2 &&
        (!trader || atoms(r.nonce) >= atoms(trader.nextNonce)))) return [];
      for (const [index, slot] of (trader?.slots ?? []).entries()) {
        if (slot.state === 2 && slot.kind === 2) this.withdrawals.set(slot.nonce, {
          slot: index, nonce: atoms(slot.nonce), asset: slot.asset, amount: atoms(slot.margin),
        });
      }
      // Retain intents even if ER has already cleared its slot while the
      // wallet's bank read is still catching up. Nonces increase monotonically.
      for (const [key, w] of this.withdrawals) {
        const r = custody?.receipts?.[w.slot];
        if (r?.settled && atoms(r.nonce) >= w.nonce &&
            (atoms(r.nonce) > w.nonce || r.kind === 2)) this.withdrawals.delete(key);
      }
      const combined = { ...wallet };
      for (const asset of assets) {
        const key = this.assetKeys.get(asset.mint) ?? this.addresses.assetPda(pk(asset.mint)).toBase58();
        this.assetKeys.set(asset.mint, key);
        const er = trader?.assets?.find((a: Row) => a.asset === key);
        const bank = custody?.assets?.find((a: Row) => a.asset === key);
        if (er && bank && collateralGeneration(er.generation) !== collateralGeneration(bank.generation)) return [];
        const deposits = (bank ? atoms(bank.depositedCredits) : 0n) - (er ? atoms(er.creditedDeposits) : 0n);
        const returns = (bank ? atoms(bank.returnedCredits) : 0n) - (er ? atoms(er.creditedReturns) : 0n);
        const transferring = [...this.withdrawals.values()].reduce((sum, w) => sum + (w.asset === key ? w.amount : 0n), 0n);
        // Signed deposit reconciliation cancels wallet -> ER moves even when
        // ER is newer. Returned margin is credited once, whichever stream sees
        // it first; it remains in ER rather than appearing in a wallet ATA.
        combined[asset.mint] = (wallet[asset.mint] ?? 0n) + (er ? atoms(er.available) : 0n)
          + deposits + (returns > 0n ? returns : 0n) + transferring;
        if (combined[asset.mint] < 0n) return [];
      }
      return this.changes.observe(owner, ++this.sequence, combined);
    } catch {
      // A missing counter is not a zero balance. Preserve the last baseline.
      return [];
    }
  }
}
