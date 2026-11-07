import { useRef, useState } from 'react';
import { WalletWithdraw, type WithdrawProps } from './WalletWithdraw.tsx';
import { tokenAmountInput } from './withdrawal.ts';
import type { WithdrawalAsset } from './withdrawal-plan.ts';

/** Custody release to the current trading wallet is distinct from an external transfer. */
export function WalletReturn(props: WithdrawProps) {
  const { owner, assets, tradingBalances = {}, ready, busy, returnToWallet } = props;
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [step, setStep] = useState('');
  const [external, setExternal] = useState(false);
  const lock = useRef(false);
  const rows = assets.filter(a => (tradingBalances[a.mint] ?? 0n) > 0n);
  async function release(asset: WithdrawalAsset) {
    if (!ready || busy || lock.current || !returnToWallet) return;
    lock.current = true;
    setPending(asset.mint); setMessage(''); setStep('Checking trading funds…');
    try {
      await returnToWallet(asset, setStep);
      setMessage(`Available ${asset.symbol} returned to your wallet.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      lock.current = false; setPending(''); setStep('');
    }
  }
  return <section className="wallet-return" aria-label="Return trading funds">
    <h3>Return to my wallet</h3>
    <p>Move available trading funds back to your {props.feeCovered ? 'local' : 'connected browser'} wallet for use across markets.</p>
    <code title={owner}>{owner.slice(0, 6)}…{owner.slice(-6)}</code>
    <div className="wallet-return-tokens">
      {rows.map(asset => <button key={asset.mint} className="wallet-connect"
        disabled={!ready || busy || !!pending || !returnToWallet}
        onClick={() => void release(asset)}>
        {pending === asset.mint ? step : `Return ${tokenAmountInput(tradingBalances[asset.mint], asset.decimals)} ${asset.symbol} to my wallet`}
      </button>)}
    </div>
    {!rows.length && <p>{ready ? 'No available funds remain in trading custody.' : 'Checking trading funds…'}</p>}
    <p className="wallet-withdraw-note">{props.feeCovered ? 'Your local wallet signs the return.' : 'Approve in your wallet.'} Funds arrive after Solana settlement. Open positions and locked bet backing stay in place.</p>
    {message && <p className="wallet-deposit-status" role="status">{message}</p>}
    <button className="wallet-use-browser" disabled={busy || !!pending}
      aria-expanded={external} onClick={() => setExternal(!external)}>
      {external ? 'Hide external transfer' : 'Send to another wallet'}
    </button>
    {external && <WalletWithdraw {...props} />}
  </section>;
}
