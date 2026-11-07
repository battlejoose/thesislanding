import { appFetch as fetch, serviceOrigin } from "./app-url.ts";
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import type {Deployment,Snapshot} from './client.ts';
import {programAddresses} from './program-addresses.ts';
import {PublicKey} from '@solana/web3.js';
import {Coin} from './components.tsx';
import {leaderboardBetAmount,rankOpenPositions,validUsernameChallenge,validUsername,type LeaderboardResponse} from './leaderboard.ts';
import {AcidHowButtonSkin} from './AcidHowButtonSkin.tsx';
import {LeaderboardLivePosition} from './LeaderboardLivePosition.tsx';
import {assetImage,type TokenDisplays} from './token-display.ts';
import './leaderboard.css';

const money=(atoms:string)=>BigInt(atoms)<10000n?'<$0.01':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(Number(atoms)/1e6);
async function request(url:string,input?:unknown){
  const response=await fetch(url,{method:input?'POST':'GET',headers:{'content-type':'application/json'},body:input?JSON.stringify(input):undefined,cache:'no-store',signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok)throw Error(result.error??'Leaderboard unavailable');return result;
}
export function Leaderboard({deployment,state,owner,signMessage,now=Date.now(),tokenDisplays={}}:{deployment:Deployment;state:Snapshot;owner:string;signMessage:(message:Uint8Array)=>Promise<Uint8Array>;now?:number;tokenDisplays?:TokenDisplays}){
  const [data,setData]=useState<LeaderboardResponse>(),[claiming,setClaiming]=useState(false),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const [view,setView]=useState<'historical'|'open'>('historical');
  const openPositions=useMemo(()=>rankOpenPositions(state.positions),[state.positions]);
  const list=useRef<HTMLOListElement>(null),openKeys=openPositions.map(p=>p.id).join(',');
  useEffect(()=>{
    if(view!=='open'||!list.current||typeof IntersectionObserver==='undefined')return;
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.toggleAttribute('data-offscreen',!entry.isIntersecting)),{root:list.current,rootMargin:'50px'});
    list.current.querySelectorAll('[data-live-position]').forEach(card=>observer.observe(card));
    return()=>observer.disconnect();
  },[view,openKeys]);
  const alive=useRef(true),lock=useRef(false);
  useEffect(()=>{alive.current=true;let reading=false;
    const read=async()=>{if(reading)return;reading=true;try{const next=await request('/api/leaderboard');if(alive.current)setData(next);}catch(e){if(alive.current)setError(e instanceof Error?e.message:'Leaderboard unavailable');}finally{reading=false;}};
    void read();const timer=setInterval(()=>{if(!document.hidden)void read();},15000);
    return()=>{alive.current=false;clearInterval(timer);};
  },[]);
  async function claim(){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');
    try {
      const username=name.trim();if(!validUsername(username))throw Error('Use 3–20 letters, numbers or underscores');
      const challenge=await request('/api/usernames/challenge',{owner,username});
      if(!alive.current)return;
      if(!validUsernameChallenge(challenge,{program:deployment.programId,origin:serviceOrigin(location.origin),owner,username}))throw Error('Username request changed; please retry');
      const signature=await signMessage(new TextEncoder().encode(challenge.message));
      if(!alive.current)return;
      const result=await request('/api/usernames/claim',{...challenge,signature:Buffer.from(signature).toString('base64')});
      if(alive.current){setNotice(`@${result.username} is yours`);setClaiming(false);setData(await request('/api/leaderboard'));}
    }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Unable to claim username');}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  const assets=useMemo(()=>{const addresses=programAddresses(deployment.programId);return new Map(deployment.assets.map(a=>[addresses.assetPda(new PublicKey(a.mint)).toBase58(),a]));},[deployment]);
  const isOpen=view==='open';
  const positions=isOpen?openPositions.map(p=>({...p,username:data?.usernames[p.owner]})):data?.positions??[];
  return <section className="leaderboard-panel">
    <div className="leaderboard-actions"><button className="leaderboard-claim top-how" aria-expanded={claiming} onClick={()=>{setClaiming(!claiming);setName(data?.usernames[owner]??'');}}><AcidHowButtonSkin/><span className="how-slime-label">{data?.usernames[owner]?`@${data.usernames[owner]}`:'Claim username'}</span></button></div>
    {claiming&&<form className="leaderboard-name" onSubmit={e=>{e.preventDefault();void claim();}}><label htmlFor="leaderboard-name">Your leaderboard name</label><div><span>@</span><input id="leaderboard-name" autoComplete="off" maxLength={20} value={name} onChange={e=>setName(e.target.value)} disabled={busy} placeholder="your_name"/><button className="primary" disabled={busy||!validUsername(name.trim())}>{busy?'Signing…':'Sign & claim'}</button></div><small>Signs a message with {owner.slice(0,4)}…{owner.slice(-4)}. No transaction or gas fee.</small></form>}
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="leaderboard-notice" role="status">{notice}</p>}
    <div className="leaderboard-tabs" role="group" aria-label="Leaderboard view"><button aria-pressed={!isOpen} onClick={()=>setView('historical')}>Historical</button><button aria-pressed={isOpen} onClick={()=>setView('open')}>Open Positions</button></div>
    {!isOpen&&<div className="leaderboard-columns"><span>RANK / TRADER</span><span>POSITION</span><span>PROFIT</span></div>}
    <ol ref={list} className={`leaderboard-list${isOpen?' leaderboard-live-list':''}`} key={view} aria-label={isOpen?'Open positions ranked by leveraged value':'Most profitable closed positions'}>
      {positions.map((p,i)=>{const market=state.markets.find(m=>m.key===p.market),feed=state.feeds.find(f=>f.key===market?.feed),symbol=feed?.symbol??market?.symbol??'Market',asset=assets.get(p.collateral),value='leveragedUsd' in p?p.leveragedUsd:p.profitUsd,date='openedAt' in p?p.openedAt:p.closedAt;
        if('leveragedUsd' in p){const position=state.positions.find(row=>row.key===p.position);return position?<LeaderboardLivePosition key={p.id} rank={i+1} summary={p} position={position} feed={feed} quote={state.quotes.find(q=>q.id===asset?.feedId)} asset={asset} imageUrl={asset&&assetImage(tokenDisplays,asset)} now={now} snapshotAgeMs={state.snapshotAgeMs} cluster={deployment.cluster}/>:null;}
        return <li className={i<3?'leaderboard-podium':''} key={p.id}>
        <div className="leaderboard-trader"><b className="leaderboard-rank">{String(i+1).padStart(2,'0')}</b><span><a href={`https://solscan.io/account/${p.owner}${deployment.cluster==='devnet'?'?cluster=devnet':''}`} target="_blank" rel="noreferrer" title={p.owner}>{p.username?'@'+p.username:p.owner.slice(0,4)+'…'+p.owner.slice(-4)}</a><small>{new Date(date*1000).toLocaleDateString()}</small></span></div>
        <div className="leaderboard-position"><span><Coin symbol={symbol}/><b>{symbol}</b><i className={p.long?'up':'down'}>{p.long?'↑':'↓'}</i><em>{p.leverage}×</em></span><span className="leaderboard-bet">{leaderboardBetAmount(p.margin,asset?.decimals)} ${asset?.symbol??'Token'}</span><small className="leaderboard-entry" title={`$${Number(p.entryUsd)/1e6} at entry`}>{money(p.entryUsd)} bet value</small></div>
        <div className="leaderboard-profit"><strong title={`$${Number(value)/1e6}${isOpen?' leveraged value':''}`} style={{'--profit-digits':money(value).length+(isOpen?0:1)} as CSSProperties}>{isOpen?'':'+'}{money(value)}</strong><a href={`https://solscan.io/${p.signature?'tx/'+p.signature:'account/'+p.position}${deployment.cluster==='devnet'?'?cluster=devnet':''}`} target="_blank" rel="noreferrer">View position ↗</a></div>
      </li>;})}
      {!positions.length&&<li className="leaderboard-empty">{isOpen?'No open positions.':data?'The first confirmed win starts here.':'Loading confirmed positions…'}</li>}
    </ol>{!isOpen&&<footer>Position profit includes USDC claims still waiting in the FIFO queue.</footer>}
  </section>;
}
