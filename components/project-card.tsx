'use client';
import { useRef, useState, type CSSProperties } from 'react';
import { Send } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Project } from '@/lib/projects';
import type { TokenStats } from '@/lib/token-stats';

function CommunityLink({url,kind,name}:{url:string|null;kind:'X'|'Telegram';name:string}) {
  const icon=kind==='X'?<span aria-hidden="true">𝕏</span>:<Send size={14}/>;
  if(url)return <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${name} on ${kind}`}>{icon}</a>;
  return <Tooltip><TooltipTrigger className="unconfigured-link" aria-disabled="true" aria-label={`${name}: ${kind} link not added`}>{icon}</TooltipTrigger><TooltipContent>{kind} link not added for this build.</TooltipContent></Tooltip>;
}
export default function ProjectCard({project:p,index,stats,onHover}:{project:Project;index:number;stats?:TokenStats;onHover?:(id:string|null)=>void}) {
  const card=useRef<HTMLElement>(null);
  const [imageError,setImageError]=useState(false);
  return <article ref={card} data-project-id={p.id} data-coming-soon={p.comingSoon?'true':undefined} className={`project-card${p.comingSoon?' is-coming-soon':''}`} style={{'--order':index} as CSSProperties} onPointerEnter={onHover?()=>onHover(p.id):undefined} onPointerLeave={onHover?()=>onHover(null):undefined}>
    <div className="newspaper-masthead"><span>{!p.comingSoon&&<i className="live-dot" aria-hidden="true"/>}THE {p.ticker} JOURNAL</span><span>{p.comingSoon?`NO. 0${index+1}`:'LIVE'}</span></div>
    <div className="project-media">
      <img src={imageError?'/art/brooklyn.webp':p.image} onError={()=>setImageError(true)} alt={p.comingSoon?'':p.description} width={720} height={405} loading={p.featured?'eager':'lazy'} decoding="async"/>
      <span className="media-shade"/>
      <span className="category-chip">{p.category}</span>{p.featured&&<span className="featured-chip">↗ Featured</span>}
      {p.comingSoon&&<span className="play-prompt"><span>Coming soon</span></span>}
    </div>
    <div className="project-info">
      <div className="project-name-row"><span className="project-symbol" style={{background:p.color}}>{p.icon}</span><span className="name-block"><h3>{p.name}</h3><span className="ticker">${p.ticker}</span></span></div>
      <p className="project-description">{p.description}</p>
      {p.comingSoon?<div className="project-bottom"/>:<div className="project-bottom"><div className="market-cap"><span>Market cap</span><strong>{stats?.cap??p.cap}</strong></div><span className="price-change" data-down={stats&&!stats.up?'true':undefined} aria-label={`${stats?.change??p.change} in 24 hours`}>{stats?.up===false?'↘':'↗'} {stats?.change??p.change}<span className="change-period">24h</span></span><TooltipProvider><div className="social-links"><CommunityLink url={p.x} kind="X" name={p.name}/><CommunityLink url={p.telegram} kind="Telegram" name={p.name}/></div></TooltipProvider></div>}
    </div>
  </article>;
}
