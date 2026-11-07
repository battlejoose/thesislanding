import { useEffect, useId, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Coin } from "./components.tsx";
import type { AssetInfo, Row } from "./client.ts";
import { depositAtoms, type DepositAsset } from "./wallet-deposit.ts";
import {fundingOptions,fundingFraction,type FundingSnapshot} from './funding-wallet.ts';
import {useTokenDisplays} from './useTokenDisplays.ts';
import {WalletTokenIcon} from './WalletTokenIcon.tsx';
import {startWalletBalancePolling} from './wallet-balance-polling.ts';
import { transactionExplorer } from "./browser-deployment.ts";

export interface DepositProps {
  cluster?: string;
  owner: string;
  assets: AssetInfo[];
  browserAddress: string;
  connecting: boolean;
  disconnecting?: boolean;
  connectionError?: string;
  cancelConnect?: () => void;
  busy: boolean;
  connect: () => void;
  disconnect: () => void;
  quotes?: Row[];
  now?: number;
  quoteMint?: string;
  readInventory?: (nativeOnly?:boolean) => Promise<FundingSnapshot>;
  maxSol?: () => Promise<bigint>;
  readBalance: (asset?: DepositAsset) => Promise<bigint>;
  transfer: (amount: string, asset?: DepositAsset) => Promise<string>;
}

export function WalletDeposit({
  owner,
  assets,
  browserAddress,
  connecting,
  disconnecting = false,
  connectionError,
  cancelConnect,
  busy,
  connect,
  disconnect,
  readBalance,
  readInventory,
  maxSol,
  quotes = [],
  now = Date.now(),
  quoteMint = "",
  transfer,
  cluster = "devnet",
  allowSol = true,
  destination = "local",
  nativeOnly = false,
}: DepositProps & { allowSol?: boolean; destination?: "local" | "reserve"; nativeOnly?:boolean }) {
  const isReserve = destination === "reserve",onlyNative=isReserve||nativeOnly;
  const amountId=useId();
  const [mint,setMint]=useState('SOL'),[amount,setAmount]=useState('');
  const [snapshot,setSnapshot]=useState<FundingSnapshot>(),[loading,setLoading]=useState(false),[balanceError,setBalanceError]=useState('');
  const [sending,setSending]=useState(false),[choosingAmount,setChoosingAmount]=useState(false),[message,setMessage]=useState('');
  const [signature,setSignature]=useState(''),[copied,setCopied]=useState(false),[refresh,setRefresh]=useState(0),[selecting,setSelecting]=useState(false);
  const lock=useRef(false),currentSelection=useRef({owner:browserAddress,mint});
  currentSelection.current={owner:browserAddress,mint};
  const current=snapshot?.owner===browserAddress?snapshot:undefined;
  const displays=useTokenDisplays(assets,current,!!browserAddress&&!onlyNative);
  const options=fundingOptions(current,assets,quotes,quoteMint,displays,now).filter(row=>(allowSol||row.id!=='SOL')&&(!(isReserve||nativeOnly)||row.id==='SOL'));
  const selected=options.find(row=>row.id===mint),asset=selected?.transferAsset;
  const symbol=selected?.symbol??'token',decimals=selected?.decimals??9,balance=selected?.spendable??0n;
  const fmt=(n:bigint,d:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:Math.min(d,9)}).format(Number(n)/10**d);
  const dollars=(v:bigint|undefined)=>v===undefined?'USD unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)/1e6);
  useEffect(()=>{setMint('SOL');setAmount('');setMessage('');setSignature('');setSelecting(false);},[browserAddress]);
  useEffect(()=>{
    if(selected||!options.length)return;
    setMint(options[0].id);setAmount('');
  },[selected,options.map(row=>row.id).join(',')]);
  useEffect(()=>{
    if(!browserAddress)return;
    let stopped=false,pending=false;
    const read=async()=>{
      if(pending)return;pending=true;setLoading(true);
      try {
        if(!readInventory)throw Error('Funding balances unavailable');
        const next=await readInventory(onlyNative);
        if(next.owner!==browserAddress)throw Error('Funding wallet changed');
        if(!stopped){setSnapshot(previous=>previous?.owner===next.owner&&previous.checkedAt>next.checkedAt?previous:next);setBalanceError('');}
      }catch{if(!stopped)setBalanceError('Could not refresh browser wallet balances. Retry.');}
      finally{pending=false;if(!stopped)setLoading(false);}
    };
    const stop=startWalletBalancePolling({refresh:read,intervalMs:60_000,visibility:document});
    return()=>{stopped=true;stop();};
  },[browserAddress,readInventory,refresh,onlyNative]);
  let valid=false;
  try{valid=!!selected&&depositAtoms(amount,decimals)<=balance;}catch{}
  async function fraction(percent:25|50|100) {
    if(!selected||busy||sending||choosingAmount)return;
    const selection={owner:browserAddress,mint};setChoosingAmount(true);setMessage('');
    try {
      const available=mint==='SOL'&&maxSol?await maxSol():balance;
      if(currentSelection.current.owner!==selection.owner||currentSelection.current.mint!==selection.mint)return;
      setAmount(fundingFraction(available,decimals,percent));
    }catch(e){setMessage(e instanceof Error?e.message:'Could not calculate amount');}
    finally{setChoosingAmount(false);}
  }
  async function send() {
    if (lock.current || busy || choosingAmount || !valid) return;
    lock.current = true;
    setSending(true);
    setMessage("");
    setSignature("");
    try {
      const sig = await transfer(amount, asset);
      if(currentSelection.current.owner!==browserAddress)return;
      setSignature(sig);
      setMessage(
        isReserve
          ? `$${symbol} added to the platform gas reserve`
          : `$${symbol} received in your local wallet`,
      );
      setAmount('');
      // Keep the confirmed selected balance until a newer cached inventory arrives.
      try {
        const remaining=await readBalance(asset);
        setSnapshot(previous=>{
          if(!previous||previous.owner!==browserAddress)return previous;
          if(!asset)return {...previous,nativeLamports:remaining.toString(),checkedAt:Date.now()};
          return {...previous,checkedAt:Date.now(),tokens:previous.tokens.map(t=>t.mint!==asset.mint?t:{...t,amount:remaining.toString()})};
        });
      }catch{/* The periodic inventory will recover after a transient read failure. */}
      setRefresh((n) => n + 1);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    } finally {
      lock.current = false;
      setSending(false);
    }
  }
  return (
    <div className="wallet-deposit">
      <div className="wallet-receive">
        <QRCodeSVG
          value={owner}
          size={116}
          marginSize={4}
          level="M"
          title={isReserve ? "Platform gas reserve address" : "Local wallet deposit address"}
        />
        <div className="wallet-receive-address">
          <span>{isReserve ? "Send to the platform gas reserve" : "Send to your local wallet"}</span>
          <code>{owner}</code>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(owner);
                setCopied(true);
              } catch {
                setMessage("Select the address above to copy it");
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy address"}
          </button>
        </div>
      </div>
      <div className="wallet-deposit-divider">
        <span>or fund with a browser wallet</span>
      </div>
      {!browserAddress ? (
        <><button
          className="wallet-connect"
          disabled={connecting || disconnecting || busy}
          onClick={connect}
        >
          {disconnecting ? "Disconnecting…" : connecting ? "Connecting…" : "Connect browser wallet"}
        </button>
        {connecting && cancelConnect && <button type="button" onClick={cancelConnect}>Cancel connection</button>}
        {connectionError && <p role="status">{connectionError}</p>}
        </>
      ) : (
        <>
          <div className="wallet-deposit-source">
            <span>
              Browser funding wallet <strong title={browserAddress}>{browserAddress.slice(0, 4)}…{browserAddress.slice(-4)}</strong>
            </span>
            <button aria-label="Disconnect browser wallet" disabled={sending || busy} onClick={disconnect}>
              Disconnect
            </button>
          </div>
          <div className="wallet-funding-inputs">
            <div className="wallet-funding-token-field">
              <span className="wallet-funding-label">Token</span>
              <button className="wallet-funding-selected" aria-label="Choose funding token" aria-expanded={selecting} disabled={sending||busy||choosingAmount||!options.length} onClick={()=>setSelecting(!selecting)}>
                {selected?<><WalletTokenIcon row={selected}/><strong>${symbol}</strong></>:<span>{loading?'Loading…':'No balances'}</span>}<span aria-hidden="true">⌄</span>
              </button>
              {selected&&<small>{fmt(selected.balance,decimals)} · {dollars(selected.usd)}</small>}
            </div>
            <div className="wallet-funding-amount-field">
              <label htmlFor={amountId}>Amount</label>
              <input id={amountId} aria-label="Deposit amount" inputMode="decimal" autoComplete="off" placeholder="0.00" disabled={sending||busy||choosingAmount} value={amount} onChange={e=>{setAmount(e.target.value);setMessage('');setSignature('');}}/>
              <div className="wallet-funding-fractions" role="group" aria-label="Deposit amount shortcuts">
                {([25,50,100] as const).map(percent=><button key={percent} disabled={sending||busy||choosingAmount||!selected||balance<=0n} onClick={()=>void fraction(percent)}>{percent===100?'Max':`${percent}%`}</button>)}
              </div>
            </div>
          </div>
          {selecting&&<div className="wallet-funding-options" role="group" aria-label="Browser wallet token balances">
            {options.map(row=><button className="wallet-funding-option" key={row.id} aria-pressed={row.id===mint} title={row.id==='SOL'?'Native SOL':row.mint} disabled={sending||busy||choosingAmount||row.spendable===0n} onClick={()=>{setMint(row.id);setAmount('');setMessage('');setSignature('');setSelecting(false);}}>
              <WalletTokenIcon row={row}/><span><strong>${row.symbol}</strong><small>{row.spendable===0n?'Frozen balance':row.name}</small></span>
              <span className="wallet-funding-values"><strong>{fmt(row.balance,row.decimals)}</strong><small>{dollars(row.usd)}</small></span>
            </button>)}
          </div>}
          <div className="wallet-funding-inventory-status">
            <span>{balanceError||(!current&&loading?'Loading wallet balances…':!options.length?'No token balances in this browser wallet.':`${options.length} active balance${options.length===1?'':'s'}`)}</span>
            <button disabled={loading||sending||busy} onClick={()=>setRefresh(n=>n+1)}>{loading?'Updating…':'Refresh'}</button>
          </div>
          {selected?.id==='SOL'&&<small className="wallet-funding-fee-note">Amount shortcuts leave SOL for the network fee.</small>}
          <button
            className="wallet-connect"
            disabled={sending || busy || choosingAmount || !valid}
            onClick={() => void send()}
          >
            {sending
              ? isReserve ? "Confirming contribution…" : "Confirming deposit…"
              : isReserve ? `Add $${symbol} to platform reserve` : `Deposit $${symbol}`}
          </button>
        </>
      )}
      {message && (
        <p role="status" className="wallet-deposit-status">
          {message}
          {signature && (
            <>
              {" "}
              ·{" "}
              <a
                href={transactionExplorer(signature, cluster)}
                target="_blank"
                rel="noreferrer"
              >
                View transaction ↗
              </a>
            </>
          )}
        </p>
      )}
      <p className="wallet-local-note">
        {isReserve ? (
          <>{cluster === "mainnet-beta" ? "Mainnet" : "Devnet only"} · This contribution pays shared platform fees. It does not add tokens to your local wallet.</>
        ) : (
          <>
            {cluster === "mainnet-beta" ? "Mainnet" : "Devnet only"} · Trades sign instantly in this browser.
            <br />
            Keep this browser’s data to retain wallet access.
          </>
        )}
      </p>
    </div>
  );
}
