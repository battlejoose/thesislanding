import type { WithdrawalAsset } from './withdrawal-plan.ts';

/** Confirm each send before starting the next. Never retry an uncertain send. */
export async function withdrawAllBalances(
  assets: WithdrawalAsset[], recipient: string,
  transfer: (asset: WithdrawalAsset, amount: string, recipient: string, progress: (step: string) => void) => Promise<string>,
  progress: (step: string) => void,
  confirmed: (asset: WithdrawalAsset, signature: string) => void,
) {
  const unique = [...new Map(assets.map(a => [a.mint, a])).values()];
  for (const [i, asset] of unique.entries()) {
    const label = `${i + 1}/${unique.length} · $${asset.symbol}`;
    progress(`${label} · Checking balance…`);
    // "all" is resolved from fresh chain balances by the transfer handler.
    const signature = await transfer(asset, 'all', recipient, step => progress(`${label} · ${step}`));
    if (signature) confirmed(asset, signature);
  }
}
