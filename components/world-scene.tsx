'use client';
import { useEffect, useRef, useState } from 'react';
import { MoveHorizontal, Box } from 'lucide-react';
import type { Theme } from '@/lib/projects';
import type { createWorld } from '@/lib/three-world';
export default function WorldScene({theme,motion}:{theme:Theme;motion:boolean}){
  const host=useRef<HTMLDivElement>(null),engine=useRef<ReturnType<typeof createWorld>|null>(null),motionRef=useRef(motion);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{motionRef.current=motion;engine.current?.setMotion(motion);},[motion]);
  useEffect(()=>{
    const container=host.current;if(!container)return;
    let disposed=false;setReady(false);setFailed(false);
    const fail=()=>{setFailed(true);setReady(false);};container.addEventListener('scene-error',fail);
    void import('@/lib/three-world').then(({createWorld})=>{if(disposed)return;engine.current=createWorld(container,theme,()=>setReady(true));engine.current.setMotion(motionRef.current);}).catch(()=>{if(!disposed)setFailed(true);});
    return()=>{disposed=true;container.removeEventListener('scene-error',fail);engine.current?.dispose();engine.current=null;};
  },[theme]);
  return <div className="scene-stage" data-ready={ready} data-motion={motion}>
    {!ready&&<div className="scene-reveal">{theme!=="volcanic"&&theme!=="space"&&<img src={`/art/${theme}.webp`} alt="" width={1280} height={853}/>} {!failed&&<span className="scene-loading"><i/><i/><i/></span>}</div>}
    <div ref={host} className="three-host" tabIndex={0} role="img" aria-label={`${theme} 3D world. Drag to rotate, or use left and right arrow keys.`} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();engine.current?.rotate(e.key==='ArrowRight'?1:-1);}}}/>
    <div className="scene-ui"><span><Box size={13}/><span data-spatial-text data-spatial-tone='accent'>{failed?'STILL WORLD':'A LIVING 3D WORLD'}</span></span>{!failed&&<span><MoveHorizontal size={16}/><span data-spatial-text data-spatial-tone="muted">Drag to explore</span></span>}</div>
  </div>;
}
