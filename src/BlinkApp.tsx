import { appPath } from "./app-url.ts";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { unpackAccount } from "@solana/spl-token";
import { assetPda, emptySnapshot, isSol, MixClient, pk, type AssetInfo, type Deployment, type Row, type Snapshot } from "./client.ts";
import { CORE_MARKETS } from "./core-markets.ts";
import { validateErDeployment } from "./execution-layer.ts";
import { blinkJson, sendBlinkTransaction } from "./blink-client.ts";
import { signBlinkWalletTransaction } from "./blink-wallet.ts";
import { fundTradingShortfall } from "./trading-funding.ts";
import { pendingTradingCredit, tradingBalances } from "./er-state.ts";
import { startEventStream } from "./event-source.ts";
import { listenForSnapshots } from "./snapshot-stream.ts";
import { displayMarketFeed, receiveLivePrices, receiveSnapshotPrices, type LivePriceBook } from "./live-market-prices.ts";
import { displayedPositionPnl, orderPositions } from "./position-order.ts";
import { isFresh, parseUnits } from "./math.ts";
import { transactionError } from "./funding.ts";
import { Coin } from "./components.tsx";
import type { ErAction } from "../server/er-transactions.ts";
import "./blink.css";

const number=new Intl.NumberFormat("en-US",{maximumFractionDigits:6});
const usd=(value: bigint | number)=>new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(Number(value)/1e6);
const tokens=(value:string|bigint,asset:AssetInfo)=>number.format(Number(value)/10**asset.decimals);
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

export function BlinkApp() {
  const wallet=useWallet(), {setVisible}=useWalletModal(), {connection}=useConnection();
  const owner=wallet.publicKey?.toBase58()??"", active=useRef(owner); active.current=owner;
  const initial=useMemo(()=>new URLSearchParams(location.search),[]);
  const [deployment,setDeployment]=useState<Deployment>();
  const [state,setState]=useState<Snapshot>(emptySnapshot());
  const latest=useRef(state), [prices,setPrices]=useState<LivePriceBook>({});
  const [marketId,setMarketId]=useState(CORE_MARKETS.find(m=>m.symbol===initial.get("market"))?.id??2);
  const [mint,setMint]=useState(initial.get("mint")??""), [amount,setAmount]=useState(initial.get("amount")??"10");
  const [leverage,setLeverage]=useState(initial.get("leverage")??"1000"), [long,setLong]=useState(initial.get("side")!=="short");
  const [busy,setBusy]=useState(""), [stage,setStage]=useState(""), [error,setError]=useState(""), [notice,setNotice]=useState("");
  const [now,setNow]=useState(Date.now()), [streamTime,setStreamTime]=useState(0);
  const lock=useRef(false), lastEvent=useRef(0);
  const client=useMemo(()=>new MixClient(connection),[connection]);
  if(deployment) client.deployment=deployment;
  const accept=(snapshot:Snapshot)=>{
    if(Number(snapshot.serverTime??0)<Number(latest.current.serverTime??0)) return;
    latest.current=snapshot; setState(snapshot); lastEvent.current=Date.now(); setStreamTime(lastEvent.current);
    setPrices(book=>receiveSnapshotPrices(book,snapshot.feeds));
  };
  const refresh=async()=>{ const next=await blinkJson("/api/state") as Snapshot; accept(next); return next; };
  useEffect(()=>{
    let alive=true;
    void blinkJson("/deployment.json").then(d=>{validateErDeployment(d);if(alive)setDeployment(d);}).catch(e=>{if(alive)setError(transactionError(e));});
    const stop=startEventStream(source=>{
      listenForSnapshots(source,snapshot=>{if(alive)accept(snapshot);});
      source.addEventListener("prices",event=>{try{if(alive)setPrices(book=>receiveLivePrices(book,JSON.parse((event as MessageEvent).data)));}catch{/* retain previous valid data */}});
    });
    let refreshing=false;
    const timer=setInterval(()=>{
      if(!alive)return; setNow(Date.now());
      if(document.visibilityState==="visible" && Date.now()-lastEvent.current>6000 && !refreshing) {
        refreshing=true; void blinkJson("/api/state").then(s=>{if(alive)accept(s);}).catch(()=>{}).finally(()=>{refreshing=false;});
      }
    },1000);
    return()=>{alive=false;stop();clearInterval(timer);};
  },[]);
  const assets=deployment?.assets.filter(a=>a.collateral)??[];
  const asset=assets.find(a=>a.mint===mint)??assets.find(a=>a.symbol==="USDC")??assets[0];
  const market=state.markets.find(m=>m.id===marketId), rawFeed=state.feeds.find(f=>f.id===marketId);
  const feed=rawFeed?displayMarketFeed(rawFeed,prices,now):undefined;
  const available=deployment?tradingBalances(state,owner,deployment):{};
  const positions=orderPositions(state.positions.filter(p=>p.owner===owner));
  const assertOwner=(address:string)=>{if(active.current!==address)throw Error("Wallet changed. Please reconnect the original wallet.");};
  const send=(request:ErAction)=>{
    if(!deployment || !wallet.signTransaction) throw Error("Connect a browser wallet that supports transaction signing");
    return sendBlinkTransaction(request,{deployment,sign:tx=>signBlinkWalletTransaction(wallet,request.owner,tx),assertOwner:()=>assertOwner(request.owner),stage:setStage});
  };
  async function run(name:string,job:()=>Promise<void>) {
    if(lock.current)return;
    lock.current=true;setBusy(name);setError("");setNotice("");
    try {await job();await refresh();}
    catch(e){setError(transactionError(e));}
    finally {lock.current=false;setBusy("");setStage("");}
  }
  async function walletAmount(a:AssetInfo,address:string) {
    const keys=[client.ata(pk(address),a),...(isSol(a)?[pk(address)]:[])];
    const accounts=await connection.getMultipleAccountsInfo(keys,"confirmed");
    assertOwner(address);
    const account=accounts[0]?unpackAccount(keys[0],accounts[0],pk(a.tokenProgram)):undefined;
    if(account && (!account.owner.equals(pk(address)) || !account.mint.equals(pk(a.mint))))throw Error("Unexpected wallet token account");
    return (account?.amount??0n)+BigInt(accounts[1]?.lamports??0);
  }
  async function open() {
    if(!owner){setVisible(true);return;}
    if(!asset||!market||!deployment) return;
    const address=owner, chosen=asset, lev=Number(leverage);
    await run("open",async()=>{
      if(!Number.isInteger(lev)||lev<1||lev>1000)throw Error("Choose leverage between 1 and 1000");
      const atoms=parseUnits(amount,chosen.decimals);
      if(atoms<=0n || atoms>0xffffffffffffffffn)throw Error("Enter a valid positive token amount");
      setStage("Checking your available collateral…");
      const balance=await walletAmount(chosen,address);
      await fundTradingShortfall(atoms,{
        read:async()=>{
          assertOwner(address);const s=await refresh();
          return {initialized:!!s.custodies?.some(c=>c.owner===address),available:tradingBalances(s,address,deployment)[chosen.mint]??0n,wallet:balance,pendingCredit:pendingTradingCredit(s,address,chosen.mint)};
        },
        initialize:async()=>{await send({kind:"initializeTrading",owner:address});await pause(1500);},
        deposit:async value=>{await send({kind:"depositCollateral",owner:address,mint:chosen.mint,amount:String(value)});setStage("Making your collateral available for trading…");},
      });
      await send({kind:"open",owner:address,mint:chosen.mint,market:market.key,amount:String(atoms),leverage:lev,long});
      setNotice("Position opened. Your confirmed position will appear below.");
    });
  }
  async function close(position:Row) {
    const address=owner;
    await run(position.key,async()=>{
      await send({kind:"close",owner:address,position:position.key});
      setNotice("Close confirmed on the rollup. Settlement and any token profit payout continue automatically.");
    });
  }
  async function withdraw(a:AssetInfo) {
    const address=owner;
    await run("withdraw",async()=>{
      if(!deployment)return;
      const s=await refresh(),value=tradingBalances(s,address,deployment)[a.mint]??0n;
      if(value<=0n)throw Error("No available trading balance to return");
      await send({kind:"withdrawCollateral",owner:address,mint:a.mint,amount:String(value)});
      setNotice("Return requested. The available tokens will settle back to this browser wallet automatically. Open-position collateral stays locked.");
    });
  }
  return <main className="blink-app">
    <header className="blink-brand"><a href={appPath("/")}><img src={appPath("/acidpump.svg")} alt=""/><span><em>acid</em>pump.fun</span></a><span className="blink-network">DEVNET</span></header>
    <section className="blink-card" aria-label="Acidpump trading card">
      <div className="blink-heading"><div><small>BROWSER WALLET TRADING</small><h1>Put your bags to work.</h1></div><span className={`blink-live ${now-streamTime<6000?"":"is-stale"}`}>{now-streamTime<6000?"Live":"Connecting"}</span></div>
      <button className="blink-wallet" disabled={!!busy} onClick={()=>owner?void wallet.disconnect():setVisible(true)}>{owner?`${owner.slice(0,6)}…${owner.slice(-6)} · Disconnect`:"Connect browser wallet"}</button>
      <div className="blink-market"><Coin symbol={CORE_MARKETS.find(m=>m.id===marketId)!.symbol}/><strong>{feed?usd(BigInt(feed.price)/1_000_000n):"—"}</strong><span>{feed&&isFresh(feed,now)?"Live market price":"Waiting for fresh price"}</span></div>
      <form onSubmit={event=>{event.preventDefault();void open();}}>
        <div className="blink-fields">
          <label>Market<select value={marketId} disabled={!!busy} onChange={e=>setMarketId(Number(e.target.value) as typeof marketId)}>{CORE_MARKETS.map(m=><option key={m.id} value={m.id}>{m.name} · {m.symbol}</option>)}</select></label>
          <label>Bet token<select value={asset?.mint??""} disabled={!!busy} onChange={e=>setMint(e.target.value)}>{assets.map(a=><option key={a.mint} value={a.mint}>${a.symbol}</option>)}</select></label>
          <label>Token amount<input aria-label="Token amount" value={amount} inputMode="decimal" maxLength={40} disabled={!!busy} onChange={e=>setAmount(e.target.value)}/></label>
          <label>Leverage<input aria-label="Leverage" type="number" min="1" max="1000" step="1" value={leverage} disabled={!!busy} onChange={e=>setLeverage(e.target.value)}/></label>
        </div>
        <div className="blink-direction" role="group" aria-label="Direction"><button type="button" aria-pressed={long} disabled={!!busy} onClick={()=>setLong(true)}>↑ Long</button><button type="button" aria-pressed={!long} disabled={!!busy} onClick={()=>setLong(false)}>↓ Short</button></div>
        <button className="blink-primary" disabled={!!busy||!asset||!market}>{busy==="open"?"Opening…":owner?`Open ${long?"long":"short"} position`:"Connect wallet to trade"}</button>
      </form>
      <p className="blink-explain">Approve each transaction in your wallet. New wallets may need setup, collateral funding, then opening approvals. Entry and exit use execution prices.</p>
      {busy&&<div role="status" className="blink-status"><i/>{stage||"Working…"}</div>}
      {error&&<div role="alert" className="blink-error">{error}<button onClick={()=>setError("")} aria-label="Dismiss error">×</button></div>}
      {notice&&<p role="status" className="blink-notice">{notice}</p>}
      <div className="blink-utilities"><button disabled={!owner||!asset||!!busy} onClick={()=>void run("faucet",async()=>{setStage("Sending devnet test tokens…");await blinkJson("/api/faucet",{owner,mint:asset?.mint});setNotice("Test tokens sent to your connected browser wallet.");})}>Get test tokens</button><button disabled={!!busy} onClick={()=>void run("refresh",async()=>{})}>Refresh</button><a href={appPath("/")}>Full platform ↗</a></div>
    </section>
    {owner&&<section className="blink-positions" aria-label="Your positions"><div className="blink-section-title"><h2>Your positions</h2><span>Same connected wallet</span></div>
      {positions.length===0&&<p className="blink-empty">Your first position will appear here.</p>}
      {positions.slice(0,20).map(position=>{
        const m=state.markets.find(m=>m.key===position.market),symbol=CORE_MARKETS.find(c=>c.id===m?.id)?.symbol??"?";
        const a=assets.find(a=>assetPda(pk(a.mint)).toBase58()===position.collateral);
        const raw=state.feeds.find(f=>f.id===m?.id), f=raw?displayMarketFeed(raw,prices,now):undefined;
        const quote=state.quotes.find(q=>q.id===a?.feedId);
        const value=position.state===0&&!position.erPending&&(!f||!isFresh(f,now))?null:displayedPositionPnl(position,f,quote);
        const active=position.state===0&&!position.erPending;
        return <article key={position.key} className={`blink-position ${active?"is-open":""}`}>
          <div className="blink-position-top"><strong><Coin symbol={symbol}/>{symbol} {position.long?"Long ↑":"Short ↓"}</strong><b className={value===null?"":value<0n?"negative":"positive"}>{value===null?"—":`${value>=0n?"+":"−"}${usd(value<0n?-value:value)}`}</b></div>
          <div className="blink-position-sub"><span>{a?`${tokens(position.margin,a)} $${a.symbol}`:"Collateral"} · {position.leverage}×</span><span>{active?"Estimated P&L":position.erPending?"Price locked · settling":position.liquidated?"Liquidated":"Closed"}</span></div>
          <div className="blink-position-prices"><span>Entry <b>{usd(BigInt(position.entry)/1_000_000n)}</b></span><span>Liquidation <b>{usd(BigInt(position.bust)/1_000_000n)}</b></span></div>
          {active?<button className="blink-close" disabled={!!busy} onClick={()=>void close(position)}>{busy===position.key?stage||"Closing…":"Close position · approve in wallet"}</button>:<p className="blink-settled">{position.erPending?"Settlement is processing automatically.":`Returned: ${a?`${tokens(position.returned??"0",a)} $${a.symbol}`:"—"}${BigInt(position.remaining??0)>0n?` · FIFO claim: ${usd(BigInt(position.remaining))}`:""}`}</p>}
        </article>;
      })}
      {Object.entries(available).some(([,v])=>v>0n)&&<div className="blink-balances"><h3>Available trading balance</h3>{assets.filter(a=>(available[a.mint]??0n)>0n).map(a=><div key={a.mint}><span><Coin symbol={a.symbol}/>{tokens(available[a.mint],a)} ${a.symbol}</span><button disabled={!!busy} onClick={()=>void withdraw(a)}>Return to wallet</button></div>)}</div>}
    </section>}
    <footer className="blink-footer">Test tokens only · Platform-sponsored fees · Wallet approval for every open and close</footer>
  </main>;
}
