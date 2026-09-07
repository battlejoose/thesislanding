'use client';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { projects, type Project, type Theme } from '@/lib/projects';
import type { createGallery } from '@/lib/three-gallery';
import ProjectCard from './project-card';
import TokenProjectCard from './token-project-card';
export default function ProjectGallery({theme,motion,selected,onSelect,displayScale=1,cursorTilt=false,projectList=projects}:{theme:Theme;motion:boolean;selected:string|null;onSelect:(id:string)=>void;displayScale?:number;cursorTilt?:boolean;projectList?:Project[]}){
  const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLDivElement>(null),engine=useRef<Awaited<ReturnType<typeof createGallery>>|null>(null),motionRef=useRef(motion);
  const [ready,setReady]=useState(false);
  const projectsRef=useRef(projectList),projectIds=projectList.map(p=>p.id).join(',');
  useEffect(()=>{projectsRef.current=projectList;engine.current?.setProjects(projectList);},[projectList]);
  useEffect(()=>{motionRef.current=motion;engine.current?.setMotion(motion);},[motion]);
  useEffect(()=>{const host=canvas.current;if(!host||!root.current)return;let disposed=false;setReady(false);const fail=()=>setReady(false);host.addEventListener('gallery-error',fail);
    void import('@/lib/three-gallery').then(async({createGallery})=>{if(disposed)return;const articles=Array.from(root.current!.querySelectorAll<HTMLElement>('[data-project-id]'));const result=await createGallery(host,articles,projectsRef.current,theme,()=>{if(!disposed)setReady(true);},{displayScale,cursorTilt});if(disposed){result.dispose();return;}engine.current=result;result.setProjects(projectsRef.current);result.setMotion(motionRef.current);}).catch(()=>{if(!disposed)setReady(false);});
    return()=>{disposed=true;host.removeEventListener('gallery-error',fail);engine.current?.dispose();engine.current=null;};
  },[theme,displayScale,cursorTilt,projectIds]);
  return <div className={`project-gallery${ready?' models-ready':''}`} ref={root} style={{'--project-display-scale':displayScale} as CSSProperties}><div ref={canvas} className="gallery-canvas" aria-hidden="true"/><div className="project-grid" tabIndex={0} aria-label="Project collection. Scroll to roll the project wheel.">{projectList.map((project,index)=>project.kind?<TokenProjectCard key={project.id} project={project} onRetry={()=>onSelect(project.id)}/>:<ProjectCard key={project.id} project={project} index={index} theme={theme} motion={motion && !ready} selected={selected===project.id} onSelect={()=>onSelect(project.id)}/>)}</div></div>;
}
