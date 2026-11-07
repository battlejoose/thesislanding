import { useState } from "react";
import type { AssetInfo, Row } from "./client.ts";
import { backedPositions, coreBackingValue, hasBackingReserve } from "./core-backing.ts";
import {tokenAmountInput} from './withdrawal.ts';
import type { BackingDisplayValue } from './backing-display.ts';
import { BackingCountdown } from './BackingCountdown.tsx';
import { parseUnits } from "./math.ts";
import { Coin } from "./components.tsx";
import {NATIVE_MINT} from '@solana/spl-token';
import "./core-backing.css";

export type CoreBackingProps = { asset: AssetInfo; trader?: Row; backing?: BackingDisplayValue; refreshSeconds:number; available: bigint;
  quoteSample?: {quote: Row; at: number};
  exemptAssets: readonly string[];
  choices?: {asset:AssetInfo;available:bigint;quoteSample?:{quote:Row;at:number}}[];
  busy: boolean; onChange: (amount: bigint, unstake: boolean, asset?:AssetInfo) => Promise<unknown> };
const backingUsd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (n: bigint) => backingUsd.format(Number(n) / 1e6);
export function CoreBacking({asset:primary,trader,backing,refreshSeconds,available:primaryAvailable,busy,onChange,exemptAssets,quoteSample:primaryQuote,choices}: CoreBackingProps) {
  const [amount,setAmount]=useState(""),[unstake,setUnstake]=useState(false),[error,setError]=useState("");
  const [selected,setSelected]=useState(primary.mint);
  const options=choices??[{asset:primary,available:primaryAvailable,quoteSample:primaryQuote}];
  const {asset,available,quoteSample}=options.find(c=>c.asset.mint===selected)??options[0];
  const kind=asset.mint===NATIVE_MINT.toBase58()?'sol':asset.feedId===104?'usdc':'pool';
  const staked=BigInt((asset.mint===primary.mint?trader?.coreStake:trader?.auxiliaryStakes?.[kind==='sol'?0:1])?.tokens??0);
  const locked=!!trader&&backedPositions(trader,exemptAssets).length>0;
  const tokens=(n:bigint)=>new Intl.NumberFormat("en-US",{maximumFractionDigits:6}).format(Number(n)/10**asset.decimals);
  let preview:bigint|undefined;
  try {const atoms=parseUnits(amount||'0',asset.decimals);preview=atoms===0n?0n:quoteSample?coreBackingValue(atoms,quoteSample.quote,quoteSample.at,kind):undefined;}catch{/* Invalid input is explained on submit. */}
  const preset=(percent:number)=>{setAmount(tokenAmountInput((unstake?staked:available)*BigInt(percent)/100n,asset.decimals));setError('');};
  async function change() {
    setError("");
    try {
      const atoms=parseUnits(amount,asset.decimals);
      if(atoms<=0n||atoms>(unstake?staked:available))throw Error("Enter an amount within your available balance");
      await onChange(atoms,unstake,asset);
    } catch(e) { setError(e instanceof Error?e.message:"Unable to update backing"); }
  }
  return <section className="core-backing" aria-label="Bet backing">
    {options.length>1&&<div className="core-stake-mode" aria-label="Backing token">{options.map(c=><button type="button" key={c.asset.mint} disabled={busy} aria-pressed={c.asset.mint===asset.mint} onClick={()=>{setSelected(c.asset.mint);setAmount('');setError('');}}><Coin symbol={c.asset.symbol}/>${c.asset.symbol}</button>)}</div>}
    <header><span><Coin symbol={asset.symbol}/> Staked</span><strong>{tokens(staked)} <small>${asset.symbol}</small></strong></header>
    <div className="core-capacity"><span>Combined backing value<strong>{backing?money(backing.value):!hasBackingReserve(trader)?money(0n):"—"}<BackingCountdown seconds={refreshSeconds}/></strong></span><span>Available for bets<strong>{backing?money(backing.available):!hasBackingReserve(trader)?money(0n):"—"}</strong></span></div>
    <div className="core-usage" aria-hidden="true"><i style={{width:backing&&backing.value>0n?`${Math.min(100,Number(backing.reserved*100n/backing.value))}%`:"0%"}}/></div>
    <div className="core-stake-mode"><button type="button" aria-pressed={!unstake} onClick={()=>setUnstake(false)}>Stake</button><button type="button" aria-pressed={unstake} onClick={()=>setUnstake(true)}>Unlock</button></div>
    <div className="core-wallet-balance"><span>Wallet balance</span><strong>{tokens(available)} <small>${asset.symbol}</small></strong></div>
    <div className="core-amount-presets"><span>{unstake?'Amount to unlock':'Amount to stake'}</span><div>{[25,50,100].map(percent=><button key={percent} type="button" disabled={busy||(unstake&&locked)} onClick={()=>preset(percent)}>{percent===100?'Max':percent+'%'}</button>)}</div></div>
    <div className="core-stake-input"><input aria-label={`${unstake?"Unlock":"Stake"} ${asset.symbol} amount`} disabled={busy} inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Token amount"/><button type="button" disabled={busy||(unstake&&locked)} onClick={()=>void change()}>{busy?"Updating…":unstake?"Unlock":"Stake"}</button></div>
    <div className="core-amount-value"><span>Estimated USD value</span><strong>{preview===undefined?'Quote updating…':'≈ '+money(preview)}</strong></div>
    {locked&&<small>Backing stays locked until bets that use it settle.</small>}
    {backing&&backing.poolShortfall>0n&&<small>Past shortfall absorbed by the pool: {money(backing.poolShortfall)}</small>}
    {error&&<p role="alert">{error}</p>}
    <div className="core-explainer">
      <p>Combine {options.map(c=>`$${c.asset.symbol}`).join(' + ')} backing to cover supported token bets up to their combined USD value. Backing can be consumed if the bet token loses value.</p>
      <p className="core-exempt">{[...new Set(['SOL','USDC',primary.symbol,...(exemptAssets[3]?['SDICE']:[])])].map((symbol,i)=><span key={symbol} className="core-exempt-token">{i>0?' + ':''}<Coin symbol={symbol}/> ${symbol}</span>)} bets need no backing.</p>
    </div>
  </section>;
}
