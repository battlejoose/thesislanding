'use client';
import { useEffect, useRef, useState } from 'react';
import { MoveHorizontal, Box } from 'lucide-react';
import type { Theme } from '@/lib/projects';
import type { createWorld } from '@/lib/three-world';
export default function WorldScene({theme,motion,webgl=true,onReady}:{theme:Theme;motion:boolean;webgl?:boolean|null;onReady?:()=>void}){
  const reported=useRef(false);
  const settleBoot=()=>{if(reported.current)return;reported.current=true;onReady?.();};
  const host=useRef<HTMLDivElement>(null),engine=useRef<ReturnType<typeof createWorld>|null>(null),motionRef=useRef(motion);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{motionRef.current=motion;engine.current?.setMotion(motion);},[motion]);
  useEffect(()=>{
    const container=host.current;if(!container)return;
    // null means the capability check has not answered yet. Treating that as
    // "unsupported" would settle the stage and lift the loading screen before
    // any 3D exists, which is the flicker. Wait for a real answer.
    if(webgl===null||webgl===undefined)return;
    // No WebGL: never fetch three.js, show the still artwork and settle at once.
    if(!webgl){setFailed(true);setReady(false);settleBoot();return;}
    let disposed=false;setReady(false);setFailed(false);
    const fail=()=>{setFailed(true);setReady(false);settleBoot();};container.addEventListener('scene-error',fail);
    void import('@/lib/three-world').then(({createWorld})=>{if(disposed)return;engine.current=createWorld(container,theme,()=>{setReady(true);settleBoot();});engine.current.setMotion(motionRef.current);}).catch(()=>{if(!disposed){setFailed(true);settleBoot();}});
    return()=>{disposed=true;container.removeEventListener('scene-error',fail);engine.current?.dispose();engine.current=null;};
  },[theme,webgl]);
  return <div className="scene-stage" data-ready={ready} data-motion={motion}>
    {!ready&&<div className="scene-reveal">{theme!=="volcanic"&&theme!=="space"&&<img src={`/art/${theme}.webp`} alt="" width={1280} height={853}/>} {!failed&&<span className="scene-loading"><i/><i/><i/></span>}</div>}
    <div ref={host} className="three-host" tabIndex={theme==='brooklyn'?-1:0} role="img" aria-label={theme==='brooklyn'?'Brooklyn cityscape with working cranes, rooftop water towers and moving traffic.':`${theme} 3D world. Drag to rotate, or use left and right arrow keys.`} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();engine.current?.rotate(e.key==='ArrowRight'?1:-1);}}}/>
    <div className="scene-ui"><span><Box size={13}/><span data-spatial-text data-spatial-tone='accent'>{failed?'STILL WORLD':'A LIVING 3D WORLD'}</span></span>{!failed&&<span><MoveHorizontal size={16}/><span data-spatial-text data-spatial-tone="muted">Drag to explore</span></span>}</div>
  </div>;
}
