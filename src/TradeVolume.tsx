import {memo,useState,type CSSProperties} from 'react';
import {AcidpumpLogo} from './AcidpumpLogo.tsx';
import {advanceVolumeReaction,formatTradeVolume,volumeAtoms,volumeReels} from './trade-volume.ts';

const reelStrip=Array.from({length:40},(_,i)=>i%10).join('\n');
const sparks=[[-16,-9],[4,-14],[23,-8],[17,11],[-8,13],[-23,3]];
/** CSS does the motion; React runs only when a reading changes and when the
 * brief burst ends. No frame loop, counter timers or extra price requests. */
export const TradeVolume=memo(function TradeVolume({atoms,ready,visible,pool}:{atoms?:string;ready:boolean;visible:boolean;pool?:string}){
  const reading={pool:pool??'',atoms:volumeAtoms(atoms,ready),animate:visible&&!document.hidden&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches};
  const [reaction,setReaction]=useState(()=>advanceVolumeReaction(undefined,reading));
  const next=advanceVolumeReaction(reaction,reading);if(next!==reaction)setReaction(next);
  const value=formatTradeVolume(next.atoms),reacting=next.from!==null;
  return <div className={`trade-volume${reacting?' is-reacting':''}`} title="Cumulative USD bet volume including leverage" aria-label={`Leveraged trade volume: ${next.atoms===null?'loading':value}`}>
    <span key={`icon-${next.revision}`} className="trade-volume-icon" aria-hidden="true"><AcidpumpLogo/><svg className="trade-volume-orbit" viewBox="0 0 32 32" fill="none" focusable="false"><path d="M4 13A12.4 12.4 0 0 1 24 6m-5-1 5 1-1 5"/><path d="M28 19A12.4 12.4 0 0 1 8 26m5 1-5-1 1-5"/></svg>{reacting&&<i className="trade-volume-ring"/>}</span>
    <span className="trade-volume-label" aria-hidden="true">Trade<br/>Volume</span>
    <strong key={`amount-${next.revision}`} className="trade-volume-amount" aria-hidden="true" onAnimationEnd={e=>{
      if(e.target===e.currentTarget&&e.animationName==='trade-volume-flash')setReaction(current=>current.revision===next.revision?{...current,from:null}:current);
    }}>{reacting?volumeReels(next.from!,value).map((reel,i)=>reel.start===undefined?<span key={i}>{reel.char}</span>:<span key={i} className="trade-volume-reel" style={{'--reel-start':reel.start,'--reel-end':reel.end}as CSSProperties}><span className="trade-volume-reel-strip">{reelStrip}</span></span>):value}</strong>
    {reacting&&<span key={`sparks-${next.revision}`} className="trade-volume-burst" aria-hidden="true">{sparks.map(([x,y],i)=><i key={i} style={{'--spark-x':`${x}px`,'--spark-y':`${y}px`,'--spark-origin':`${15+i*16}%`,'--spark-delay':`${i*22}ms`}as CSSProperties}/>)}</span>}
  </div>;
});
