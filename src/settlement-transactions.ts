/** Only confirmed base-layer signatures belong on Solscan. ER signatures and
 * missing receipts must never be replaced with a plausible-looking close link. */
export function solscanTransaction(signature: unknown, cluster: string): string | null {
  if (typeof signature !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) return null;
  if (!['mainnet-beta', 'devnet', 'testnet'].includes(cluster)) return null;
  return `https://solscan.io/tx/${signature}${cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`}`;
}

export function settlementTransactions(position: Record<string, any>) {
  const close = position.settlementSignature ?? position.settlementReceipt?.signature;
  const receipts: Array<{ signature: string; usdc?: string | null;backingTokens?:string|null }> = Array.isArray(position.payoutReceipts) ? position.payoutReceipts : [];
  return {
    close: typeof close === 'string' ? [close] : [],
    payouts: [...new Set(receipts.map(r => r.signature))],
    walletPayouts: [...new Set(receipts.filter(r => [r.usdc,r.backingTokens].some(v=>typeof v==='string'&&/^\d+$/.test(v)&&BigInt(v)>0n)).map(r => r.signature))],
  };
}
