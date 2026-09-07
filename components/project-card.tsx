'use client';
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { ArrowUpRight, Pause, Play, Send, LoaderCircle, RotateCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { Project, Theme } from '@/lib/projects';

function CommunityLink({url,kind,name}:{url:string|null;kind:'X'|'Telegram';name:string}) {
  const icon=kind==='X'?<span aria-hidden="true">𝕏</span>:<Send size={14}/>;
  if(url)return <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${name} on ${kind}`}>{icon}</a>;
  return <Tooltip><TooltipTrigger className="unconfigured-link" aria-disabled="true" aria-label={`${name}: ${kind} link not added`}>{icon}</TooltipTrigger><TooltipContent>{kind} link not added for this concept project.</TooltipContent></Tooltip>;
}
export default function ProjectCard({project:p,index,selected,onSelect,theme,motion}:{project:Project;index:number;selected:boolean;onSelect:()=>void;theme:Theme;motion:boolean}) {
  const card=useRef<HTMLElement>(null),video=useRef<HTMLVideoElement>(null),bounds=useRef<DOMRect|null>(null),tiltFrame=useRef(0);
  const [loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(false),[imageError,setImageError]=useState(false);
  useEffect(()=>{
    setLoaded(false);setError(false);setBusy(selected);
    if(!selected||!video.current)return;
    const player=video.current;
    let inView=true,timeout:ReturnType<typeof setTimeout>;
    const clear=()=>clearTimeout(timeout);
    const watch=()=>{clear();timeout=setTimeout(()=>{if(player.readyState<3){setBusy(false);setError(true);}},15000);};
    const synchronize=()=>{if(document.hidden||!inView){player.pause();}else{void player.play().catch(()=>{setBusy(false);setError(true);});}};
    const observer=new IntersectionObserver(([e])=>{inView=e.isIntersecting;synchronize();},{threshold:.15});observer.observe(player);
    document.addEventListener('visibilitychange',synchronize);player.addEventListener('playing',clear);player.addEventListener('waiting',watch);watch();
    return()=>{clear();observer.disconnect();document.removeEventListener('visibilitychange',synchronize);player.removeEventListener('playing',clear);player.removeEventListener('waiting',watch);player.pause();};
  },[selected]);
  useEffect(()=>()=>cancelAnimationFrame(tiltFrame.current),[]);
  useEffect(()=>{if(!motion){card.current?.style.removeProperty('--rx');card.current?.style.removeProperty('--ry');}},[motion]);
  const tilt=(e:PointerEvent<HTMLElement>)=>{
    if(!motion||e.pointerType!=='mouse')return;
    const r=bounds.current;if(!r)return;const x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
    cancelAnimationFrame(tiltFrame.current);tiltFrame.current=requestAnimationFrame(()=>{card.current?.style.setProperty('--ry',`${x*10}deg`);card.current?.style.setProperty('--rx',`${-y*8}deg`);});
  };
  const resetTilt=()=>{cancelAnimationFrame(tiltFrame.current);card.current?.style.setProperty('--ry','0deg');card.current?.style.setProperty('--rx','0deg');};
  const select=()=>{if(selected&&error){setError(false);setBusy(true);const player=video.current;if(player){player.load();void player.play().catch(()=>{setBusy(false);setError(true);});}}else onSelect();};
  return <article ref={card} data-project-id={p.id} data-selected={selected} data-busy={busy} data-video-error={error} className={`project-card${selected?' is-selected':''}`} style={{'--order':index} as CSSProperties} onPointerEnter={()=>{bounds.current=card.current?.getBoundingClientRect()??null;}} onPointerMove={tilt} onPointerLeave={resetTilt}>
    {theme==='brooklyn'&&<div className="newspaper-masthead"><span>THE {p.ticker} JOURNAL</span><span>NO. 0{index+1}</span></div>}
    <button className="project-media" onClick={select} aria-label={selected?(error?`Retry ${p.name} preview`:`Stop ${p.name} preview`):`Play ${p.name} preview`} aria-pressed={selected}>
      <img src={imageError?`/art/${theme}.webp`:p.image} onError={()=>setImageError(true)} alt={p.description} width={720} height={405} loading={index>2?'lazy':'eager'} decoding="async" style={{opacity:selected&&loaded&&!error?0:1}}/>
      {selected&&<video ref={video} src={p.video??undefined} muted autoPlay loop playsInline preload="none" aria-hidden="true" style={{opacity:loaded&&!error?1:0}} onPlaying={()=>{setLoaded(true);setBusy(false);setError(false);}} onWaiting={()=>setBusy(true)} onError={()=>{setBusy(false);setError(true);}}/>}
      <span className="media-shade"/>
      <span className="category-chip">{p.category}</span>{p.featured&&<span className="featured-chip">↗ Featured</span>}
      {busy&&!error&&<span className="video-loading"><LoaderCircle size={26}/><span>Opening a new perspective</span></span>}
      <span className="play-prompt">{error?<RotateCw size={14}/>:selected?<Pause size={14} fill="currentColor"/>:<Play size={13} fill="currentColor"/>}<span>{error?'Preview unavailable · Tap to retry':selected?'Playing preview · Tap to stop':`Discover ${p.name}`}</span><ArrowUpRight size={15}/></span>
    </button>
    <div className="project-info">
      <button className="project-name-row" onClick={select} aria-label={`${selected?'Stop':'Play'} ${p.name} preview`}><span className="project-symbol" style={{background:p.color}}>{p.icon}</span><span className="name-block"><h3>{p.name}</h3><span className="ticker">${p.ticker}</span></span><ArrowUpRight className="project-arrow" size={19}/></button>
      <p className="project-description">{p.description}</p>
      <div className="project-bottom"><div className="market-cap"><span>Market cap</span><strong>{p.cap}</strong></div><span className="price-change" aria-label={`${p.change} in 24 hours`}>↗ {p.change}<span className="change-period">24h</span></span><TooltipProvider><div className="social-links"><CommunityLink url={p.x} kind="X" name={p.name}/><CommunityLink url={p.telegram} kind="Telegram" name={p.name}/></div></TooltipProvider></div>
    </div>
  </article>;
}
