'use client';
import { useState, type CSSProperties } from 'react';
import { Globe } from 'lucide-react';
import type { Project } from '@/lib/projects';
import { shortAddress, pumpFunUrl, type TokenStats } from '@/lib/token-stats';
import { socialIconPaths } from '@/lib/social-icon-paths';

const SOCIALS = [
  { key: 'twitter', icon: 'x', label: 'X' },
  { key: 'telegram', icon: 'telegram', label: 'Telegram' },
] as const;

function BrandIcon({ name }: { name: 'x'|'telegram' }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d={socialIconPaths[name]}/></svg>;
}

export default function ProjectCard({project:p,index,stats}:{project:Project;index:number;stats?:TokenStats}) {
  const [imageError,setImageError]=useState(false);
  const name=stats?.name??p.name, ticker=stats?.symbol??p.ticker;
  // Only links the token actually lists are rendered; the rest are absent.
  const links=SOCIALS.filter(s=>stats?.[s.key]);
  return <article data-project-id={p.id} data-coming-soon={p.comingSoon?'true':undefined} className={`project-card${p.comingSoon?' is-coming-soon':''}`} style={{'--order':index} as CSSProperties}>
    <div className="newspaper-masthead"><span>{!p.comingSoon&&<i className="live-dot" aria-hidden="true"/>}THE {ticker} JOURNAL</span><span>{p.comingSoon?`NO. 0${index+1}`:'LIVE'}</span></div>
    <div className="project-media">
      <img src={imageError?'/art/brooklyn.webp':p.image} onError={()=>setImageError(true)} alt={p.comingSoon?'':`${name} token image`} width={720} height={405} loading={p.featured?'eager':'lazy'} decoding="async"/>
      <span className="media-shade"/>
      <span className="category-chip">{p.category}</span>{p.featured&&<span className="featured-chip">↗ Featured</span>}
      {p.comingSoon&&<span className="soon-overlay">SOON</span>}
    </div>
    <div className="project-info">
      <div className="project-name-row">
        <span className="project-symbol" style={{background:p.color}}>{p.icon}</span>
        <span className="name-block">
          <h3>{stats?.address?<a data-token-action="title" href={pumpFunUrl(stats.address)} target="_blank" rel="noopener noreferrer">{name}</a>:name}</h3>
          <span className="ticker">${ticker}</span>
        </span>
      </div>
      <dl className="token-stats">
          <div><dt>Price</dt><dd>{stats?.price??'N/A'}</dd></div>
          <div><dt>Volume / 24h</dt><dd>{stats?.volume??'N/A'}</dd></div>
          <div><dt>Market cap</dt><dd>{p.comingSoon?'N/A':stats?.cap??p.cap}</dd></div>
          <div><dt>Change / 24h</dt><dd className={`price-change${stats&&!stats.up?' is-negative':''}`}>{p.comingSoon?'N/A':stats?.change??p.change}</dd></div>
      </dl>
      <div className="token-links">
          {stats?.website&&<a data-token-action="website" className="token-website" href={stats.website} target="_blank" rel="noopener noreferrer" aria-label={`${name} website`} title="Website"><Globe size={16} aria-hidden="true"/></a>}
          {links.map(s=><a key={s.key} data-token-action={s.icon} href={stats![s.key]!} target="_blank" rel="noopener noreferrer" aria-label={`${name} on ${s.label}`} title={s.label}><BrandIcon name={s.icon}/></a>)}
      </div>
      {stats?.address&&<p className="token-ca"><a href={pumpFunUrl(stats.address)} target="_blank" rel="noopener noreferrer" title={stats.address}>CA {shortAddress(stats.address)}</a>{stats.chart&&<> · <a href={stats.chart} target="_blank" rel="noopener noreferrer">Chart</a></>}</p>}
    </div>
  </article>;
}
