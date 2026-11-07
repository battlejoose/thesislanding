import type {CSSProperties} from 'react';
import type {AssetInfo,Row} from './client.ts';
import type {OpenLeaderboardPosition} from './leaderboard.ts';
import {leaderboardBetAmount} from './leaderboard.ts';
import {leaderboardLiveMark} from './leaderboard-live.ts';
import {LiquidationMeter} from './LiquidationMeter.tsx';
import {ActivePositionAcid} from './ActivePositionAcid.tsx';
import {Coin} from './components.tsx';
import {formatMarketValue} from './market-view.ts';

const dollars=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2});
const usd=(atoms:string|bigint)=>dollars.format(Number(atoms)/1e6);
export function LeaderboardLivePosition({rank,summary,position,feed,quote,asset,imageUrl,now,snapshotAgeMs,cluster}:{
  rank:number;summary:OpenLeaderboardPosition&{username?:string};position:Row;feed?:Row;quote?:Row;asset?:AssetInfo;
  imageUrl?:string;now:number;snapshotAgeMs?:number|null;cluster:string;
}){
  const live=leaderboardLiveMark(position,feed,quote,now,snapshotAgeMs),pnl=live.pnl;
  const hot=live.meter.known&&live.meter.multiple>=2,danger=live.meter.known&&live.meter.danger;
  const tone=!live.meter.known?'waiting':danger?'danger':pnl!==null&&pnl<0n?'loss':'profit';
  const status=!live.meter.known?'Price updating':danger?'At risk':hot?'On fire':'Live';
  const pnlText=pnl===null?'—':`${pnl<0n?'−':'+'}${usd(pnl<0n?-pnl:pnl)}`;
  const roi=pnl===null?null:Number(pnl)*100/Number(summary.entryUsd);
  const symbol=feed?.symbol??'Market',suffix=cluster==='devnet'?'?cluster=devnet':'';
  return <li className={`leaderboard-live-card is-${tone}${hot?' is-hot':''}${rank<=3?' is-podium':''}`} data-live-position={summary.id}>
    <ActivePositionAcid/>
    <header className="leaderboard-live-heading">
      <div className="leaderboard-trader"><b className="leaderboard-rank" aria-label={`Rank ${rank}`}>{String(rank).padStart(2,'0')}</b><a href={`https://solscan.io/account/${summary.owner}${suffix}`} target="_blank" rel="noreferrer" title={summary.owner}>{summary.username?'@'+summary.username:summary.owner.slice(0,4)+'…'+summary.owner.slice(-4)}</a></div>
      <div className="leaderboard-live-notional"><small>Leveraged value</small><strong>{usd(summary.leveragedUsd)}</strong></div>
    </header>
    <div className="leaderboard-live-body">
      <div className="leaderboard-live-position"><h3><Coin symbol={symbol}/>{symbol} {summary.long?'Long':'Short'}<i className={summary.long?'positive':'negative'} aria-hidden="true">{summary.long?'↑':'↓'}</i><em>{summary.leverage}×</em></h3>
        <div className="leaderboard-live-bet"><Coin symbol={asset?.symbol??'Token'} imageUrl={imageUrl}/><b>{leaderboardBetAmount(summary.margin,asset?.decimals)} ${asset?.symbol??'Token'}</b></div><small>{usd(summary.entryUsd)} bet value</small>
      </div>
      <div className="leaderboard-live-pnl" title="Estimated live P&L in USD"><small>Live P&L</small><strong key={pnlText} style={{'--pnl-digits':pnlText.length}as CSSProperties}>{pnlText}<Coin symbol="USDC"/></strong><span>{roi===null?'—':`${roi<0?'−':'+'}${Math.abs(roi).toLocaleString('en-US',{maximumFractionDigits:1})}%`}</span></div>
    </div>
    <div className="leaderboard-live-meter"><LiquidationMeter state={live.meter} price={formatMarketValue(Number(live.price)/1e12)} liquidationPrice={formatMarketValue(Number(position.bust??0)/1e12)}/></div>
    <footer className="leaderboard-live-footer"><span>Entry <b>{formatMarketValue(Number(position.entry??0)/1e12)}</b></span><span className="leaderboard-live-status"><i aria-hidden="true"/>{status}</span><a href={`https://solscan.io/account/${summary.position}${suffix}`} target="_blank" rel="noreferrer">View position ↗</a></footer>
    {hot&&<span className="leaderboard-live-sparks" aria-hidden="true">{Array.from({length:5},(_,i)=><i key={i} style={{'--spark':i}as CSSProperties}/>)}</span>}
  </li>;
}
