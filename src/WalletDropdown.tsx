import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {compactBalance} from './compact-balance.ts';
import {WalletHistory} from './WalletHistory.tsx';
import { Coin } from "./components.tsx";
import { isPrimary, isSol, type AssetInfo, type Row } from "./client.ts";
import { walletTokenRows, walletTokenAction } from './wallet-token-list.ts';
import { WalletTokenIcon } from './WalletTokenIcon.tsx';
import type { TokenDisplays } from './token-display.ts';
import { WalletDeposit, type DepositProps } from "./WalletDeposit.tsx";
import { WalletWithdraw, type WithdrawProps } from "./WalletWithdraw.tsx";
import { WalletReturn } from './WalletReturn.tsx';
import {availableWalletBalances} from './wallet-balances.ts';
import { WalletEffects, type WalletNotice } from "./WalletEffects.tsx";
import { WalletRecovery, type WalletRecoveryProps } from './WalletRecovery.tsx';
import type { WalletTokenSnapshot } from './wallet-discovery.ts';
import { discoveredTokenStatus } from './wallet-discovery.ts';

const number = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);

export function WalletDropdown({
  browserMode=false,
  modeControls,
  walletStatus,
  gasBalance,
  owner,
  assets,
  selected,
  balances,
  tradingBalances,
  marketName = "This",
  quotes,
  now = Date.now(),
  quoteMint,
  usdc,
  ready,
  busy,
  onMarket,
  onFaucet,
  deposit,
  withdrawal,
  recovery,
  notices,
  discovered,
  discoveryError,
  displays,
  register,
  backingRequired,
  open: controlledOpen,
  onOpenChange,
  cluster = "devnet",
}: {
  browserMode?:boolean;
  modeControls?:ReactNode;
  walletStatus?:ReactNode;
  gasBalance?:number;
  owner: string;
  assets: AssetInfo[];
  selected?: AssetInfo;
  balances: Record<string, bigint>;
  tradingBalances?: Record<string,bigint>;
  marketName?: string;
  quotes: Row[];
  /** Server-aligned display time; never the device wall clock in the app. */
  now?: number;
  quoteMint: string;
  usdc: number;
  ready: boolean;
  busy: string;
  onMarket: (asset?: AssetInfo) => void;
  onFaucet?: (solOnly?: boolean) => void;
  cluster?: string;
  deposit: DepositProps;
  withdrawal: WithdrawProps;
  recovery?: WalletRecoveryProps;
  notices?: WalletNotice[];
  discovered?: WalletTokenSnapshot;
  discoveryError?: string;
  displays?: TokenDisplays;
  register?: (token:import('./wallet-discovery.ts').WalletToken)=>void;
  backingRequired?: (asset:AssetInfo)=>boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    setInternalOpen(next);
    onOpenChange?.(next);
  };
  const [view, setView] = useState<"balances" | "deposit" | "withdraw" | "return" | "recovery" | "history">(
    "balances",
  );
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const walletBalances = availableWalletBalances(balances, tradingBalances);
  const otherTokens=discovered?.owner===owner?discovered.tokens.filter(t=>!assets.some(a=>a.mint===t.mint)&&t.mint!==quoteMint):[];
  const hasUsdcRow = assets.some((a) => a.mint === quoteMint);
  const balanceCount = new Set(
    assets.filter((a) => (walletBalances[a.mint] ?? 0n) > 0n).map((a) => a.mint),
  ).size + (!hasUsdcRow && usdc > 0 ? 1 : 0) + otherTokens.length;
  const amount = (a?: AssetInfo) =>
    ready && a
      ? number(Number(walletBalances[a.mint] ?? 0n) / 10 ** a.decimals)
      : "—";
  const solAsset = assets.find(isSol);
  const compact=(a?:AssetInfo)=>ready&&a?compactBalance(walletBalances[a.mint]??0n,a.decimals):'—';
  const rows = walletTokenRows(assets,walletBalances,quotes,quoteMint,discovered?.owner===owner?discovered:undefined,displays,now);
  const dollars = (value:bigint|undefined) => value===undefined?"—":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value)/1e6);
  useEffect(() => {
    if (!open) return;
    setView("balances");
    const outside = (e: PointerEvent) => {
      if ((e.target as Element).closest(".wallet-adapter-modal")) return;
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  function select(a?: AssetInfo) {
    onMarket(a);
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div className="wallet-container" ref={root}>
      <WalletEffects notices={notices ?? []} />
      <button
        className="wallet"
        ref={trigger}
        aria-label={browserMode?'Browser trading wallet':'Instant wallet'}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          if (!open) setView("balances");
          setOpen(!open);
        }}
      >
        <svg
          className="wallet-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          aria-hidden="true"
        >
          <path d="M19 7V4.5a1 1 0 0 0-1.2-1L5 6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1H5" />
          <path d="M21 12h-5v5h5" />
          <circle cx="17.8" cy="14.5" r=".6" />
        </svg>
        <span className="wallet-summary">
          {owner ? <>
            <span className="wallet-selected-balance">
              <span title={amount(selected)}>{compact(selected)}</span><b>${selected?.symbol ?? "—"}</b>
            </span>
            <small className="wallet-core-balance" title={`${amount(solAsset)} $SOL`}>{compact(solAsset)} $SOL</small>
            {browserMode&&<small className="wallet-gas-balance">Gas · {gasBalance===undefined?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:4}).format(gasBalance/1e9)+' SOL'}</small>}
          </> : <span>Connect wallet</span>}
        </span>
        <span className="chevron" aria-hidden="true">
          ⌄
        </span>
      </button>
      {open && (
        <div
          className="wallet-dropdown"
          id={id}
          role="dialog"
          aria-label={browserMode?'Browser wallet':'Instant wallet'}
        >
          <div className="wallet-panel-heading">
            {view === "balances" ? (modeControls ?? (
              <strong>
                Your wallet{" "}
                <span className="wallet-network-label" title={cluster === "mainnet-beta" ? "Mainnet · real tokens" : "Test tokens only"}>
                  {cluster === "mainnet-beta" ? "Mainnet" : "Devnet"}
                </span>
              </strong>
            )) : (
              <button
                className="wallet-back"
                onClick={() => setView("balances")}
              >
                ← {view === "deposit" ? "Deposit" : view === "recovery" ? "Wallet backup & restore" : view==='history'?'Transaction history':"Withdraw"}
              </button>
            )}
            <button aria-label="Close wallet" onClick={() => setOpen(false)}>
              ×
            </button>
          </div>
          {deposit.browserAddress && (view !== "deposit" || (cluster === "mainnet-beta" && recovery && !recovery.backupReady)) && (
            <div className="wallet-deposit-source wallet-funding-connection">
              <span>{browserMode?'Browser trading wallet':'Browser funding wallet'} <strong title={deposit.browserAddress}>{deposit.browserAddress.slice(0,4)}…{deposit.browserAddress.slice(-4)}</strong></span>
              <button aria-label="Disconnect browser wallet" disabled={deposit.busy || deposit.connecting} onClick={deposit.disconnect}>Disconnect</button>
            </div>
          )}
          {view==='history'?<WalletHistory key={owner} owner={owner} browserMode={browserMode} assets={assets} displays={displays} discovered={discovered?.owner===owner?discovered:undefined} cluster={cluster}/>: (view === "recovery" || (view === "deposit" && cluster === "mainnet-beta" && recovery && !recovery.backupReady)) && recovery ? (
            <><WalletRecovery {...recovery}/>{view === 'deposit' && <small>Download your backup to continue to deposit.</small>}</>
          ) : view === "deposit" ? (
            browserMode?<div className="wallet-deposit"><p>Send tokens to your connected browser wallet. They appear here automatically.</p><code style={{overflowWrap:'anywhere'}}>{owner}</code><p>Transfers into trading custody and trades require your wallet approval.</p></div>:<WalletDeposit {...deposit} allowSol={true} />
          ) : view === "return" ? (
            <WalletReturn key={owner} {...withdrawal} />
          ) : view === "withdraw" ? (
            browserMode ? <WalletReturn key={owner} {...withdrawal} /> : <WalletWithdraw {...withdrawal} />
          ) : (
            <>
              {walletStatus && <div className="wallet-panel-controls">{walletStatus}</div>}
              <div className="wallet-actions">
                <button onClick={() => setView("deposit")}>↓ Deposit</button>
                <button onClick={() => setView("withdraw")}>↑ Withdraw</button>
              </div>
              <button className="wallet-history-trigger" onClick={()=>setView('history')}><span aria-hidden="true">↔</span> Transaction history <span aria-hidden="true">→</span></button>
              <small className="wallet-balance-count">{ready ? balanceCount : "—"} token balances · Available to use</small>
              <div className="wallet-balances">
                {!hasUsdcRow && usdc>0 && (
                  <div
                    className="wallet-balance-row"
                    aria-label="USDC balance"
                  >
                    <Coin symbol="USDC" />
                    <span className="wallet-token">
                      <b>USDC</b>
                      <small>Profit payouts</small>
                    </span>
                    <strong>{ready ? number(usdc) : "—"}</strong>
                  </div>
                )}
                {rows.map(row => {
                  const action=walletTokenAction(row),a=row.asset;
                  const actionable=action==='select'||action==='register'&&!!register;
                  return (
                  <button
                    className={`wallet-balance-row${isPrimary(a)?" wallet-core-row":""}`}
                    key={row.mint} data-wallet-mint={row.mint} disabled={!actionable} title={`${row.name} · ${row.mint}`}
                    onClick={() => { if(action==='select'&&a)select(a); else if(action==='register'&&row.token&&register){setOpen(false);register(row.token);} }}
                    aria-label={action==='select'?`Bet with ${row.symbol}`:action==='register'?`Register ${row.symbol}`:`${row.symbol}: ${row.token?discoveredTokenStatus(row.token):'Trading unavailable'}`}
                  >
                    <WalletTokenIcon row={row}/>
                    <span className="wallet-token">
                      <b>${row.symbol}</b>
                      {isPrimary(a) && <small>Platform token</small>}
                      {a&&backingRequired?.(a)&&<small className="token-backing-required">Requires bet backing</small>}
                      {row.token&&<small>{action==='register'&&register?'Register · 0.05 SOL':discoveredTokenStatus(row.token)}</small>}
                    </span>
                    <span className="wallet-row-values"><strong>{ready?number(Number(row.balance)/10**row.decimals):'—'}</strong><small title="Estimated USD balance value">{ready?dollars(row.usd):"—"}</small></span>
                    {actionable&&<span className="balance-arrow" aria-hidden="true">→</span>}
                  </button>
                );})}
              </div>
              {discoveryError&&<small className="wallet-discovery-status" role="status">{discoveryError}</small>}
              {onFaucet && <div className="wallet-faucets">
                <button disabled={!owner || !!busy} onClick={() => onFaucet()}>
                  {busy === "faucet" ? "Sending…" : "Get devnet tokens"}
                </button>
              </div>}
              {recovery && <button className="wallet-backup-link" onClick={()=>setView('recovery')}>↗ Wallet backup & restore {recovery.backupReady?'✓':''}</button>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
