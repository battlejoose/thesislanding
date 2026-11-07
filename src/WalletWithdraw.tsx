import { useEffect, useRef, useState } from 'react';
import { PublicKey } from '@solana/web3.js';
import type { AssetInfo, Row } from './client.ts';
import type { WalletTokenSnapshot } from './wallet-discovery.ts';
import type { TokenDisplays } from './token-display.ts';
import { walletTokenRows } from './wallet-token-list.ts';
import { WalletTokenIcon } from './WalletTokenIcon.tsx';
import { depositAtoms } from './wallet-deposit.ts';
import { tokenAmountInput, withdrawalRecipient,browserWithdrawableSol } from './withdrawal.ts';
import {NATIVE_MINT} from '@solana/spl-token';
import type { WithdrawalAsset } from './withdrawal-plan.ts';
import { withdrawAllBalances } from './withdrawal-batch.ts';
import { transactionExplorer } from './browser-deployment.ts';

export interface WithdrawProps {
  now?: number;
  /** Acknowledged custody credit only, excluding open collateral and backing. */
  tradingBalances?: Record<string, bigint>;
  returnToWallet?: (asset: WithdrawalAsset, onProgress?: (step: string) => void) => Promise<void>;
  feeCovered?:boolean;
  cluster?: string; owner: string; assets: AssetInfo[]; balances: Record<string, bigint>;
  ready: boolean; busy: boolean; browserAddress: string; connect: () => void;
  discovered?: WalletTokenSnapshot; inventoryError?: string; quotes?: Row[]; quoteMint?: string; displays?: TokenDisplays;
  transfer: (asset: WithdrawalAsset, amount: string, recipient: string, onProgress?: (step: string) => void) => Promise<string>;
}
export function WalletWithdraw({owner, assets, balances, ready, busy, browserAddress, connect, transfer,
  discovered, inventoryError, quotes=[], quoteMint='', displays={}, cluster='devnet',feeCovered=true,now=Date.now()}: WithdrawProps) {
  const options=walletTokenRows(assets,balances,quotes,quoteMint,discovered?.owner===owner?discovered:undefined,displays,now)
    .filter(row=>row.balance>0n).map(row=>({ ...row,
      transferable:row.token?.accounts?.length ? row.token.accounts.reduce((sum,a)=>sum+(a.frozen?0n:BigInt(a.amount)),0n) : row.balance,
      transferAsset:(row.asset??row.token)! as WithdrawalAsset,
    })).map(row=>({...row,transferable:row.transferable<row.balance?row.transferable:row.balance}));
  const [mint,setMint]=useState(''),[amount,setAmount]=useState(''),[recipient,setRecipient]=useState(browserAddress===owner?'':browserAddress);
  const [sending,setSending]=useState(false),[step,setStep]=useState(''),[message,setMessage]=useState(''),[selecting,setSelecting]=useState(false);
  const [receipts,setReceipts]=useState<{symbol:string;signature:string}[]>([]);
  const lock=useRef(false),selected=options.find(row=>row.mint===mint)??options[0];
  const asset=selected?.transferAsset,rawBalance=selected?.transferable??0n;
  const balance=!feeCovered&&asset?.mint===NATIVE_MINT.toBase58()?browserWithdrawableSol(rawBalance):rawBalance;
  useEffect(()=>{setMint('');setAmount('');setMessage('');setReceipts([]);},[owner]);
  useEffect(()=>{
    if(!sending&&!options.some(row=>row.mint===mint)){setMint(options[0]?.mint??'');setAmount('');}
  },[mint,sending,options.map(row=>row.mint).join(',')]);
  const fmt=(n:bigint,d:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:Math.min(d,9)}).format(Number(n)/10**d);
  const dollars=(v:bigint|undefined)=>v===undefined?'USD unavailable':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v)/1e6);
  let validRecipient=false,valid=false;
  try {validRecipient=ready&&!!withdrawalRecipient(recipient,new PublicKey(owner));}catch{}
  try {valid=validRecipient&&!!asset&&depositAtoms(amount,asset.decimals)<=balance;}catch{}
  const all=options.filter(row=>row.transferable>0n);
  async function send(everything=false) {
    if(lock.current||busy||!validRecipient||(everything?!all.length:!valid||!asset))return;
    lock.current=true;setSending(true);setSelecting(false);setStep('Preparing withdrawal…');setMessage('');setReceipts([]);
    let completed=0;
    const confirmed=(a:WithdrawalAsset,signature:string)=>{completed++;setReceipts(previous=>[...previous,{symbol:a.symbol,signature}]);};
    try {
      if(everything)await withdrawAllBalances([...all].sort((a,b)=>Number(a.mint===NATIVE_MINT.toBase58())-Number(b.mint===NATIVE_MINT.toBase58())).map(row=>row.transferAsset),recipient.trim(),transfer,setStep,confirmed);
      else {const signature=await transfer(asset!,amount,recipient.trim(),setStep);if(signature)confirmed(asset!,signature);}
      setMessage(everything?`${completed} token balance${completed===1?'':'s'} withdrawn`:`$${asset!.symbol} withdrawal confirmed`);
      setAmount('');
    }catch(e){setMessage(`${completed?`${completed} withdrawal${completed===1?'':'s'} confirmed. Remaining transfers stopped. `:''}${e instanceof Error?e.message:String(e)}`);}
    finally{lock.current=false;setSending(false);setStep('');}
  }
  return <div className="wallet-withdraw">
    <div className="wallet-funding-inputs">
      <div className="wallet-funding-token-field">
        <span className="wallet-funding-label">Token</span>
        <button className="wallet-funding-selected" aria-label="Choose withdrawal token" aria-expanded={selecting} disabled={busy||sending||!options.length} onClick={()=>setSelecting(!selecting)}>
          {selected?<><WalletTokenIcon row={selected}/><strong>${selected.symbol}</strong></>:<span>{ready?'No balances':'Loading…'}</span>}<span aria-hidden="true">⌄</span>
        </button>
        {selected&&<small>{fmt(selected.balance,selected.decimals)} · {dollars(selected.usd)}</small>}
      </div>
      <div className="wallet-funding-amount-field">
        <label htmlFor="withdrawal-amount">Amount</label>
        <input id="withdrawal-amount" aria-label="Withdrawal amount" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} disabled={busy||sending} onChange={e=>setAmount(e.target.value)}/>
        <div className="wallet-funding-fractions"><button aria-label="Use maximum balance" disabled={busy||sending||!ready||!asset||balance<=0n} onClick={()=>asset&&setAmount(tokenAmountInput(balance,asset.decimals))}>Max</button></div>
      </div>
    </div>
    {selecting&&<div className="wallet-funding-options" role="group" aria-label="App wallet withdrawal tokens">
      {options.map(row=><button className="wallet-funding-option" key={row.mint} title={row.mint} aria-pressed={row.mint===selected?.mint} disabled={busy||sending||row.transferable===0n} onClick={()=>{setMint(row.mint);setAmount('');setMessage('');setSelecting(false);}}>
        <WalletTokenIcon row={row}/><span><strong>${row.symbol}</strong><small>{row.transferable===0n?'Frozen balance':row.name}</small></span>
        <span className="wallet-funding-values"><strong>{fmt(row.balance,row.decimals)}</strong><small>{dollars(row.usd)}</small></span>
      </button>)}
    </div>}
    <div className="wallet-deposit-balance">Available: {ready&&asset?`${fmt(balance,asset.decimals)} $${asset.symbol}`:'—'}</div>
    {inventoryError&&<p className="wallet-deposit-status" role="status">{inventoryError}</p>}
    <label className="wallet-recipient"><span>To Solana wallet</span><input aria-label="Withdrawal address" autoComplete="off" spellCheck={false} placeholder="Paste wallet address" value={recipient} disabled={busy||sending} onChange={e=>setRecipient(e.target.value)}/></label>
    {browserAddress!==owner&&<button className="wallet-use-browser" disabled={busy||sending} onClick={browserAddress?()=>setRecipient(browserAddress):connect}>{browserAddress?'Use connected browser wallet':'Connect browser wallet'}</button>}
    <p className="wallet-withdraw-note">Send on Solana {cluster==='mainnet-beta'?'mainnet':'devnet'} · {feeCovered?'Network fee covered':'Approve in your wallet · you pay network fees'}</p>
    <button className="wallet-connect" disabled={busy||sending||!valid} onClick={()=>void send()}>{sending?step||'Withdrawing…':`Withdraw${asset?' $'+asset.symbol:''}`}</button>
    <button className="wallet-withdraw-all" disabled={busy||sending||!validRecipient||!all.length||!!inventoryError||!discovered} onClick={()=>void send(true)}>Withdraw all · {all.length} token balance{all.length===1?'':'s'}</button>
    <p className="wallet-withdraw-note">All available balances go to the address above. Open positions and locked bet backing stay in place.</p>
    {!feeCovered&&<p className="wallet-withdraw-note">SOL is sent last. Max leaves 0.00101 SOL for your wallet’s network and priority fees.</p>}
    {message&&<p className="wallet-deposit-status" role="status">{message}</p>}
    {!!receipts.length&&<div className="wallet-withdraw-receipts">{receipts.map(receipt=><a key={receipt.signature} href={transactionExplorer(receipt.signature,cluster)} target="_blank" rel="noreferrer">${receipt.symbol} · Confirmed ↗</a>)}</div>}
  </div>;
}
