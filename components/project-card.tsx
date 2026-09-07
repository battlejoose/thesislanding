'use client';
import { useRef, useState, type CSSProperties } from 'react';
import { Send } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Project } from '@/lib/projects';
import { shortAddress, pumpFunUrl, type TokenStats } from '@/lib/token-stats';

function CommunityLink({url,kind,name}:{url?:string|null;kind:'X'|'Telegram';name:string}) {
  const icon=kind==='X'?<span aria-hidden="true">𝕏</span>:<Send size={14}/>;
  if(url)return <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${name} on ${kind}`}>{icon}</a>;
  return <Tooltip><TooltipTrigger className="unconfigured-link" aria-disabled="true" aria-label={`${name}: ${kind} link not added`}>{icon}</TooltipTrigger><TooltipContent>No {kind} listed for this token.</TooltipContent></Tooltip>;
}
export default function ProjectCard({project:p,index,stats}:{project:Project;index:number;stats?:TokenStats}) {
  const card=useRef<HTMLElement>(null);
  const [imageError,setImageError]=useState(false);
  return <article ref={card} data-project-id={p.id} data-coming-soon={p.comingSoon?'true':undefined} className={`project-card${p.comingSoon?' is-coming-soon':''}`} style={{'--order':index} as CSSProperties}>
    <div className="newspaper-masthead"><span>{!p.comingSoon&&<i className="live-dot" aria-hidden="true"/>}THE {p.ticker} JOURNAL</span><span>{p.comingSoon?`NO. 0${index+1}`:'LIVE'}</span></div>
    <div className="project-media">
      <img src={imageError?'/art/brooklyn.webp':p.image} onError={()=>setImageError(true)} alt={p.comingSoon?'':p.description} width={720} height={405} loading={p.featured?'eager':'lazy'} decoding="async"/>
      <span className="media-shade"/>
      <span className="category-chip">{p.category}</span>{p.featured&&<span className="featured-chip">↗ Featured</span>}
      {p.comingSoon&&<span className="play-prompt"><span>Coming soon</span></span>}
    </div>
    <div className="project-info">
      <div className="project-name-row"><span className="project-symbol" style={{background:p.color}}>{p.icon}</span><span className="name-block"><h3>{stats?.name??p.name}</h3><span className="ticker">${stats?.symbol??p.ticker}</span></span></div>
      <p className="project-description">{p.description}</p>
      {stats?.address&&<p className="token-links">
        <a className="token-ca" href={pumpFunUrl(stats.address)} target="_blank" rel="noopener noreferrer" title={stats.address}>CA {shortAddress(stats.address)}</a>
        {stats.chart&&<a href={stats.chart} target="_blank" rel="noopener noreferrer">Chart</a>}
        {stats.website&&<a href={stats.website} target="_blank" rel="noopener noreferrer">Site</a>}
      </p>}
      {p.comingSoon?<div className="project-bottom"/>:<div className="project-bottom"><div className="market-cap"><span>Market cap</span><strong>{stats?.cap??p.cap}</strong></div><span className="price-change" data-down={stats&&!stats.up?'true':undefined} aria-label={`${stats?.change??p.change} in 24 hours`}>{stats?.up===false?'↘':'↗'} {stats?.change??p.change}<span className="change-period">24h</span></span><TooltipProvider><div className="social-links"><CommunityLink url={stats?.twitter??p.x} kind="X" name={stats?.name??p.name}/><CommunityLink url={stats?.telegram??p.telegram} kind="Telegram" name={stats?.name??p.name}/></div></TooltipProvider></div>}
    </div>
  </article>;
}
