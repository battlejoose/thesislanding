'use client';
import { useEffect, useRef, useState } from 'react';
import { projects } from '@/lib/projects';
import { fetchTokenStats, type TokenStats } from '@/lib/token-stats';
import type { createGallery } from '@/lib/three-gallery';
import ProjectCard from './project-card';
export default function ProjectGallery({motion}:{motion:boolean}){
  const [stats,setStats]=useState<Record<string,TokenStats>>({});
  const statsRef=useRef(stats);statsRef.current=stats;
  const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null),engine=useRef<Awaited<ReturnType<typeof createGallery>>|null>(null),motionRef=useRef(motion);
  const [ready,setReady]=useState(false);
  useEffect(()=>{motionRef.current=motion;engine.current?.setMotion(motion);},[motion]);
  useEffect(()=>{
    const controller=new AbortController();
    const tracked=projects.filter(project=>project.token);
    void Promise.all(tracked.map(async project=>{
      const result=await fetchTokenStats(project.token!,'solana',controller.signal);
      if(!result||controller.signal.aborted)return;
      setStats(current=>({...current,[project.id]:result}));
      engine.current?.setStats(project.id,result);
    }));
    return()=>controller.abort();
  },[]);
  useEffect(()=>{const host=canvas.current;if(!host||!root.current)return;let disposed=false;setReady(false);const fail=()=>setReady(false);host.addEventListener('gallery-error',fail);
    void import('@/lib/three-gallery').then(async({createGallery})=>{if(disposed)return;const articles=Array.from(root.current!.querySelectorAll<HTMLElement>('[data-project-id]'));const result=await createGallery(host,articles,projects,()=>{if(!disposed)setReady(true);});if(disposed){result.dispose();return;}engine.current=result;result.setMotion(motionRef.current);for(const [id,value] of Object.entries(statsRef.current))result.setStats(id,value);}).catch(()=>{if(!disposed)setReady(false);});
    return()=>{disposed=true;host.removeEventListener('gallery-error',fail);engine.current?.dispose();engine.current=null;};
  },[]);
  return <div className={`project-gallery${ready?' models-ready':''}`} ref={root}><div ref={canvas} className="gallery-canvas" aria-hidden="true"/><div className="project-grid" tabIndex={0} aria-label="Project collection. Scroll to roll the project wheel.">{projects.map((project,index)=><ProjectCard key={project.id} project={project} index={index} stats={stats[project.id]}/>)}</div></div>;
}
