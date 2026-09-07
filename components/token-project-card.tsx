'use client';
import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { Project } from '@/lib/projects';
import { TOKEN_SOCIALS } from '@/lib/token-controls';
import { socialIconPaths } from '@/lib/social-icon-paths';

export default function TokenProjectCard({project:p,onRetry}:{project:Project;onRetry:()=>void}) {
  const [imageError,setImageError]=useState(false);
  useEffect(()=>setImageError(false),[p.image,p.updatedAt]);
  const ready=p.dataState==='ready'||p.dataState==='stale',soon=p.kind==='soon';
  const overlay=soon?'Soon':p.dataState==='loading'?'Loading':p.dataState==='error'?'Retry':imageError||p.imageAvailable===false?'N/A':null;
  const media=<><img src={imageError?'/art/brooklyn.webp':p.image} onError={()=>setImageError(true)} alt={ready?`${p.name} token image`:''} width={720} height={405} style={{objectFit:ready&&!imageError?'contain':'cover'}}/>{p.dataState==='error'?<button className="token-image-overlay token-retry" data-token-action="retry" onClick={onRetry}>Retry</button>:overlay&&<span className="token-image-overlay">{overlay}</span>}</>;
  return <article data-project-id={p.id} data-token-state={p.dataState} data-image-error={imageError} data-kind={p.kind} data-selected="false" data-busy="false" data-video-error="false" className={`project-card token-card${!ready?' token-obscured':''}`}>
    <div className="project-media">{media}</div>
    <div className="project-info">
      <div className="project-name-row"><span className="project-symbol" style={{background:p.color}}>{ready?'◈':'—'}</span><span className="name-block"><h3>{ready?<a className="token-title" data-token-action="title" href={p.tokenUrl} target="_blank" rel="noopener noreferrer">{p.name}</a>:'N/A'}</h3><span className="ticker">{ready?'$'+p.ticker:'N/A'}</span></span></div>
      <p className="sr-only">{p.description}</p>
      <dl className="token-stats"><div><dt>Price</dt><dd>{p.price??'N/A'}</dd></div><div><dt>Volume / 24h</dt><dd>{p.volume??'N/A'}</dd></div></dl>
      <div className="project-bottom"><div className="market-cap"><span>Market cap</span><strong>{p.cap}</strong></div><div className="token-change"><span>Change / 24h</span><strong className={`price-change${p.change.startsWith('-')?' is-negative':''}`}>{p.change}</strong></div></div>
      <div className="token-links">
        {p.website&&<a className="token-website" data-token-action="website" href={p.website} target="_blank" rel="noopener noreferrer">Website <ArrowUpRight size={14}/></a>}
        <div className="social-links">{TOKEN_SOCIALS.map(s=>{
          const icon=<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d={socialIconPaths[s.key]}/></svg>;
          return p[s.key]?<a key={s.key} data-token-action={s.key} href={p[s.key]!} target="_blank" rel="noopener noreferrer" aria-label={`${p.name} on ${s.label}`} title={s.label}>{icon}</a>:<button key={s.key} disabled aria-label={`${s.label}: N/A`} title={`${s.label}: N/A`}>{icon}<span className="social-na">N/A</span></button>;
        })}</div>
      </div>
      <div className="token-extra"><span>{p.tokenAddress?`CA: ${p.tokenAddress}`:'CA: N/A'}</span></div>
    </div>
  </article>;
}
