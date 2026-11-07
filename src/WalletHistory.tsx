import { appFetch as fetch } from "./app-url.ts";
import {useEffect,useRef,useState} from 'react';
import type {AssetInfo} from './client.ts';
import type {TokenDisplays} from './token-display.ts';
import type {WalletTokenSnapshot} from './wallet-discovery.ts';
import {WalletTokenIcon} from './WalletTokenIcon.tsx';
import {NATIVE_SOL_HISTORY_MINT,transferAmount,mergeWalletHistory,type WalletTransfer,type WalletHistoryPage} from './wallet-history.ts';
import {HISTORY_LIMIT} from './history-limit.ts';
import './wallet-history.css';
const short=(s:string)=>s.slice(0,4)+'…'+s.slice(-4);
export function WalletHistory({owner,browserMode,assets,displays={},discovered,cluster}:{owner:string;browserMode:boolean;assets:AssetInfo[];displays?:TokenDisplays;discovered?:WalletTokenSnapshot;cluster:string}){
  const [rows,setRows]=useState<WalletTransfer[]>([]),[cursor,setCursor]=useState<string|null>(null),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const request=useRef<AbortController>(),failedCursor=useRef('');
  const suffix=cluster==='mainnet-beta'?'':'?cluster=devnet';
  async function load(next=''){
    if(next&&rows.length>=HISTORY_LIMIT)return;
    request.current?.abort();const controller=new AbortController();request.current=controller;failedCursor.current=next;setBusy(true);setError('');
    try{
      const response=await fetch(`/api/wallet/history?owner=${encodeURIComponent(owner)}${next?'&cursor='+encodeURIComponent(next):''}`,{signal:controller.signal});
      if(!response.ok)throw Error('Transfer history is temporarily unavailable. Please retry.');
      const page:WalletHistoryPage=await response.json();
      if(page.owner!==owner||!Array.isArray(page.transfers))throw Error('Transfer history could not be verified.');
      if(!controller.signal.aborted){const recent=mergeWalletHistory(next?rows:[],page);setRows(recent.transfers);setCursor(recent.cursor);setLoaded(true);}
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'History unavailable');}
    finally{if(!controller.signal.aborted)setBusy(false);}
  }
  useEffect(()=>{void load();return()=>request.current?.abort();},[owner]);
  return <section className="wallet-history" aria-label="Wallet transfers">
    <div className="wallet-history-heading"><span>{browserMode?'Browser':'Instant'} wallet <a href={`https://solscan.io/account/${owner}${suffix}`} target="_blank" rel="noreferrer">{short(owner)} ↗</a></span><button disabled={busy} onClick={()=>void load()}>Refresh</button></div>
    <p className="wallet-history-description">Latest {HISTORY_LIMIT} SOL and token transfers, newest first.</p>
    {rows.map(row=>{
      const native=row.mint===NATIVE_SOL_HISTORY_MINT,asset=assets.find(a=>a.mint===(native?'So11111111111111111111111111111111111111112':row.mint));
      const token=discovered?.tokens.find(t=>t.mint===row.mint),symbol=native?'SOL':asset?.symbol??token?.symbol??short(row.mint);
      const display=displays[asset?.sourceMint??row.mint]??displays[row.mint],counterparty=row.direction==='out'?row.to:row.from;
      const label=row.direction==='self'?'Self transfer':row.direction==='in'?'Received':'Sent';
      return <article className={`wallet-transfer is-${row.direction}`} key={row.id}>
        <WalletTokenIcon row={{mint:row.mint,symbol,name:asset?.name??token?.name??symbol,balance:BigInt(row.amount),decimals:row.decimals,asset,imageUrl:display?.imageUrl,rank:0}}/>
        <div className="wallet-transfer-detail"><b>{label} <span>${symbol}</span></b><small title={counterparty??undefined}>{counterparty?`${row.direction==='out'?'To':'From'} ${short(counterparty)}`:row.type==='mint'?'Minted':'Burned'}</small>
          <a href={`https://solscan.io/tx/${row.signature}${suffix}`} target="_blank" rel="noreferrer">{short(row.signature)} ↗</a></div>
        <div className="wallet-transfer-value"><strong>{row.direction==='in'?'+':row.direction==='out'?'−':''}{transferAmount(row.amount,row.decimals)}</strong><time dateTime={row.at?new Date(row.at).toISOString():undefined}>{row.at?new Date(row.at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}):'Time unavailable'}</time></div>
      </article>;
    })}
    {busy&&<p role="status">Loading transfers…</p>}
    {error&&<div className="wallet-history-error" role="alert">{error}<button disabled={busy} onClick={()=>void load(failedCursor.current)}>Retry</button></div>}
    {loaded&&!rows.length&&!error&&!busy&&<p className="wallet-history-empty">No transfers yet.</p>}
    {cursor&&<button className="wallet-history-more" disabled={busy} onClick={()=>void load(cursor)}>Load older transfers ↓</button>}
    {loaded&&rows.length>0&&!cursor&&<small className="wallet-history-end">{rows.length>=HISTORY_LIMIT?`Showing the latest ${HISTORY_LIMIT} transfers.`:'You’ve reached the beginning of this wallet’s transfer history.'}</small>}
  </section>;
}
