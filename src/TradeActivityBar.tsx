import { appFetch as fetch, sdiceSkin, thesisSkin } from "./app-url.ts";
import {memo,useEffect,useRef,useState,type CSSProperties} from 'react';
import type {AssetInfo,Row} from './client.ts';
import {Coin} from './components.tsx';
import {WalletTokenIcon} from './WalletTokenIcon.tsx';
import {TradeVolume} from './TradeVolume.tsx';
import {betVolumeTotals,type BetVolumeTotals} from './metrics-volume.ts';
import {coreMarketSymbol} from './core-markets.ts';
import {TradeActivityTracker,type TradeActivity} from './trade-activity.ts';
import type {TokenDisplays} from './token-display.ts';
import './trade-activity.css';
const dollars=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
// Half the SDICE travel speed; keep the same space between queued chips.
const activityTimeScale=sdiceSkin?2:1;
export const TradeActivityBar=memo(function TradeActivityBar({positions,markets,assets,displays={},volumes,pool,ready}:{positions:Row[];markets:Row[];assets:Map<string,AssetInfo>;displays?:TokenDisplays;volumes?:BetVolumeTotals[];pool?:string;ready:boolean}){
  const tracker=useRef(new TradeActivityTracker()),queue=useRef<TradeActivity[]>([]),timer=useRef<ReturnType<typeof setTimeout>>();
  const [items,setItems]=useState<TradeActivity[]>([]),[width,setWidth]=useState(300),lane=useRef<HTMLDivElement>(null);
  const [icons,setIcons]=useState<TokenDisplays>({});
  const [visible,setVisible]=useState(()=>document.visibilityState!=='hidden');
  useEffect(()=>{const update=()=>setVisible(document.visibilityState!=='hidden');document.addEventListener('visibilitychange',update);return()=>document.removeEventListener('visibilitychange',update);},[]);
  const iconMints=[...assets.values()].map(a=>a.sourceMint&&a.sourceMint!=='11111111111111111111111111111111'?a.sourceMint:a.mint).sort().join(',');
  // Load icon metadata once when the registered asset list changes. Price ticks
  // and the animation never trigger additional provider or RPC requests.
  useEffect(()=>{
    const controller=new AbortController();
    void (async()=>{
      const keys=iconMints.split(',').filter(Boolean),next:TokenDisplays={};
      try{
        for(let i=0;i<keys.length;i+=120){
          const response=await fetch('/api/wallet/token-display?mints='+keys.slice(i,i+120).join(','),{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10_000)])});
          if(!response.ok)return;Object.assign(next,await response.json());
        }
        if(!controller.signal.aborted)setIcons(next);
      }catch{/* Keep the bundled token icons available if metadata is offline. */}
    })();
    return()=>controller.abort();
  },[iconMints]);
  const volume=pool?(volumes?.find(v=>v.pool===pool)??betVolumeTotals(positions,pool)):undefined;
  useEffect(()=>{if(!lane.current)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(lane.current);return()=>observer.disconnect();},[]);
  useEffect(()=>{
    if(!ready)return;
    const next=tracker.current.receive(positions);
    if(document.visibilityState==='hidden')return;
    queue.current.push(...next);
    function emit(){
      timer.current=undefined;
      if(document.visibilityState==='hidden'){queue.current=[];setItems([]);return;}
      const item=queue.current.shift();if(item)setItems(old=>[...old,item]);
      // Keep a cooldown even when the queue briefly empties, so a close event
      // arriving just after an open cannot overlap the slower preceding chip.
      if(item&&(sdiceSkin||queue.current.length))timer.current=setTimeout(emit,1800*activityTimeScale);
    }
    if(queue.current.length&&!timer.current)emit();
  },[positions,ready]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  return <section className="trade-activity-bar" aria-label="Platform trade activity" data-paused={!visible||undefined}>
    <TradeVolume atoms={volume?.leveragedValue} pool={pool} ready={ready} visible={visible}/>
    <div ref={lane} className="trade-activity-lane" style={{'--activity-travel':`${width+180}px`,'--activity-duration':`${(width+180)/95*activityTimeScale}s`} as CSSProperties}>
      <div className="trade-activity-underlay" aria-hidden="true"><div className="trade-activity-marquee">{[0,1].map(copy=><div className="trade-activity-marquee-group" key={copy}>{[0,1,2].map(n=><span className="trade-activity-watermark" key={n}>{thesisSkin ? <>THESIS<span>PERPS</span></> : sdiceSkin ? <>SDICE<span>PERPS</span></> : <><b>acid</b>pump<span>.fun</span></>}<i/></span>)}</div>)}</div></div>
      {items.map(item=>{
        const asset=assets.get(item.collateral),market=markets.find(m=>m.key===item.market),symbol=(market?coreMarketSymbol(market.id):undefined)??'?';
        const label=`${item.kind==='open'?'Opened':'Closed'} ${symbol} ${item.long?'Long':'Short'} · ${dollars(item.usd)} leveraged exposure · ${asset?.symbol??'token'} collateral`;
        return <div className="trade-activity-flight" key={item.id} onAnimationEnd={e=>{if(e.target===e.currentTarget)setItems(old=>old.filter(x=>x.id!==item.id));}}>
          <div className={`trade-activity-chip ${item.long?'is-long':'is-short'} is-${item.kind}`} title={label} aria-label={label}>
            <span className="trade-activity-event" aria-hidden="true">{item.kind==='open'?'✦':'▣'}</span>
            {asset&&<WalletTokenIcon row={{mint:asset.mint,symbol:asset.symbol,name:asset.name,balance:0n,decimals:asset.decimals,asset,imageUrl:(displays[asset.sourceMint]??displays[asset.mint]??icons[asset.sourceMint]??icons[asset.mint])?.imageUrl,rank:0}}/>}
            <span className="trade-activity-arrow" aria-hidden="true">→</span><Coin symbol={symbol}/>
            <span className="trade-activity-side" aria-hidden="true">{item.long?'↑':'↓'}</span><b>{dollars(item.usd)}</b>
            <span className="trade-activity-sparks" aria-hidden="true"><i/><i/><i/></span>
          </div>
        </div>;
      })}
    </div>
  </section>;
});
