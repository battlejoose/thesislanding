'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Send } from 'lucide-react';
import type { Project } from '@/lib/projects';

export default function TokenProjectCard({project:p,onRetry}:{project:Project;onRetry:()=>void}) {
  const [imageError,setImageError]=useState(false);
  useEffect(()=>setImageError(false),[p.image,p.updatedAt]);
  const ready=p.dataState==='ready'||p.dataState==='stale',soon=p.kind==='soon';
  const overlay=soon?'Soon':p.dataState==='loading'?'Loading':p.dataState==='error'?'Retry':imageError||p.imageAvailable===false?'N/A':null;
  const media=<><img src={imageError?'/art/brooklyn.webp':p.image} onError={()=>setImageError(true)} alt={ready?`${p.name} token image`:''} width={720} height={405} style={{objectFit:ready&&!imageError?'contain':'cover'}}/>{overlay&&<span className="token-image-overlay">{overlay}</span>}<span className="category-chip">{p.category}</span><span className="play-prompt">{ready?'View on Pump.fun':soon?'Soon':p.dataState==='error'?'Retry token data':'Loading token data'}{ready&&<ArrowUpRight size={15}/>}</span></>;
  return <article data-project-id={p.id} data-token-state={p.dataState} data-image-error={imageError} data-kind={p.kind} data-selected="false" data-busy="false" data-video-error="false" className={`project-card token-card${!ready?' token-obscured':''}`}>
    {ready?<a className="project-media" href={p.tokenUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${p.name} on Pump.fun`}>{media}</a>:<button className="project-media" disabled={soon||p.dataState==='loading'} onClick={onRetry}>{media}</button>}
    <div className="project-info">
      {ready?<a className="project-name-row" href={p.tokenUrl} target="_blank" rel="noopener noreferrer"><span className="project-symbol" style={{background:p.color}}>◈</span><span className="name-block"><h3>{p.name}</h3><span className="ticker">${p.ticker}</span></span></a>:<div className="project-name-row"><span className="project-symbol">—</span><span className="name-block"><h3>N/A</h3><span className="ticker">N/A</span></span></div>}
      <p className="project-description">{p.description}</p>
      <div className="project-bottom"><div className="market-cap"><span>Market cap</span><strong>{p.cap}</strong></div><span className={`price-change${p.change.startsWith('-')?' is-negative':''}`}>{p.change}<span className="change-period">24h</span></span>
        <div className="social-links">{p.x?<a href={p.x} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} on X`}>𝕏</a>:<button disabled aria-label="X: N/A">N/A</button>}{p.telegram?<a href={p.telegram} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} on Telegram`}><Send size={14}/></a>:<button disabled aria-label="Telegram: N/A">N/A</button>}</div>
      </div>
      <div className="token-extra">{p.website&&<a className="token-website" href={p.website} target="_blank" rel="noopener noreferrer">Website ↗</a>}<span>{p.tokenAddress?`CA: ${p.tokenAddress}`:'CA: N/A'}</span></div>
    </div>
  </article>;
}
