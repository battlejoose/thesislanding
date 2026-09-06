'use client';
import { useEffect, useRef, useState } from 'react';
import { Box } from 'lucide-react';
import type { createWorld } from '@/lib/three-world';
export default function WorldScene({motion}:{motion:boolean}){
  const host=useRef<HTMLDivElement>(null),engine=useRef<ReturnType<typeof createWorld>|null>(null),motionRef=useRef(motion);
  const [ready,setReady]=useState(false),[failed,setFailed]=useState(false);
  useEffect(()=>{motionRef.current=motion;engine.current?.setMotion(motion);},[motion]);
  useEffect(()=>{
    const container=host.current;if(!container)return;
    let disposed=false;setReady(false);setFailed(false);
    const fail=()=>{setFailed(true);setReady(false);};container.addEventListener('scene-error',fail);
    void import('@/lib/three-world').then(({createWorld})=>{if(disposed)return;engine.current=createWorld(container,()=>setReady(true));engine.current.setMotion(motionRef.current);}).catch(()=>{if(!disposed)setFailed(true);});
    return()=>{disposed=true;container.removeEventListener('scene-error',fail);engine.current?.dispose();engine.current=null;};
  },[]);
  return <div className="scene-stage" data-ready={ready} data-motion={motion}>
    {!ready&&<div className="scene-reveal"><img src="/art/brooklyn.webp" alt="" width={1280} height={853}/> {!failed&&<span className="scene-loading"><i/><i/><i/></span>}</div>}
    <div ref={host} className="three-host" tabIndex={-1} role="img" aria-label="Brooklyn cityscape with working cranes, rooftop water towers and moving traffic."/>
    <div className="scene-ui"><span><Box size={13}/><span data-spatial-text data-spatial-tone='accent'>{failed?'STILL WORLD':'A LIVING 3D WORLD'}</span></span></div>
  </div>;
}
