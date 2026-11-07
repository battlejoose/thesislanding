export type WalletDelta = { mint: string; amount: bigint; balance: bigint };

/** Baselines are silent. Older RPC responses must never manufacture a transfer. */
export class WalletChanges {
  private owner = "";
  private slot = -1;
  private balances: Record<string, bigint> = {};
  observe(owner: string, slot: number, balances: Record<string, bigint>): WalletDelta[] {
    if (owner === this.owner && slot < this.slot) return [];
    const changes = owner === this.owner
      ? Object.entries(balances).flatMap(([mint, balance]) => {
          const before = this.balances[mint];
          return before !== undefined && before !== balance
            ? [{ mint, amount: balance - before, balance }] : [];
        }) : [];
    this.owner = owner;
    this.slot = slot;
    this.balances = { ...balances };
    return changes;
  }
}
