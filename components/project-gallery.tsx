'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { projects, type Theme } from '@/lib/projects';
import type { createGallery } from '@/lib/three-gallery';
import ProjectCard from './project-card';
export default function ProjectGallery({theme,motion,selected,onSelect,displayScale=1,cursorTilt=false}:{theme:Theme;motion:boolean;selected:string|null;onSelect:(id:string)=>void;displayScale?:number;cursorTilt?:boolean}){
  const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null),engine=useRef<Awaited<ReturnType<typeof createGallery>>|null>(null),motionRef=useRef(motion);
  const [ready,setReady]=useState(false);
  useEffect(()=>{motionRef.current=motion;engine.current?.setMotion(motion);},[motion]);
  useEffect(()=>{const host=canvas.current;if(!host||!root.current)return;let disposed=false;setReady(false);const fail=()=>setReady(false);host.addEventListener('gallery-error',fail);
    void import('@/lib/three-gallery').then(async({createGallery})=>{if(disposed)return;const articles=Array.from(root.current!.querySelectorAll<HTMLElement>('[data-project-id]'));const result=await createGallery(host,articles,projects,theme,()=>{if(!disposed)setReady(true);},{displayScale,cursorTilt});if(disposed){result.dispose();return;}engine.current=result;result.setMotion(motionRef.current);}).catch(()=>{if(!disposed)setReady(false);});
    return()=>{disposed=true;host.removeEventListener('gallery-error',fail);engine.current?.dispose();engine.current=null;};
  },[theme,displayScale,cursorTilt]);
  return <div className={`project-gallery${ready?' models-ready':''}`} ref={root} style={{'--project-display-scale':displayScale} as CSSProperties}><div ref={canvas} className="gallery-canvas" aria-hidden="true"/><div className="project-grid" tabIndex={0} aria-label="Project collection. Scroll to roll the project wheel.">{projects.map((project,index)=><ProjectCard key={project.id} project={project} index={index} theme={theme} motion={motion && !ready} selected={selected===project.id} onSelect={()=>onSelect(project.id)}/>)}</div></div>;
}
