'use client';

import { useEffect, useState } from 'react';
import ProjectGallery from '@/components/project-gallery';
import WorldScene from '@/components/world-scene';
import styles from './construction.module.css';
import { CONSTRUCTION_TOKENS, INITIAL_CONSTRUCTION_PROJECTS } from '@/lib/construction-projects';
import { fetchTokenProject, tokenRefreshDelay } from '@/lib/token-client';

export default function Construction() {
  const [projects,setProjects]=useState(INITIAL_CONSTRUCTION_PROJECTS);
  const [retry,setRetry]=useState(0);
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>,running=false,failures=0;
    if(retry>0)setProjects(current=>current.map(p=>p.dataState==='error'?{...p,dataState:'loading'}:p));
    const refresh=async()=>{
      if(running||document.hidden)return;running=true;clearTimeout(timer);
      const results=await Promise.all(CONSTRUCTION_TOKENS.filter((address):address is string=>!!address).map(async address=>{
        try{
          const project=await fetchTokenProject(address,controller.signal);
          if(!controller.signal.aborted)setProjects(current=>current.map(p=>p.id===address?project:p));
          return true;
        }catch{
          if(!controller.signal.aborted)setProjects(current=>current.map(p=>p.id===address?{...p,dataState:p.dataState==='ready'||p.dataState==='stale'?'stale':'error'}:p));
          return false;
        }
      }));
      running=false;failures=results.every(Boolean)?0:failures+1;
      if(!controller.signal.aborted)timer=setTimeout(refresh,tokenRefreshDelay(failures));
    };
    void refresh();document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);
    return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);};
  },[retry]);

  return (
    <div className={`showcase ${styles.construction}`} data-theme="brooklyn" data-edition="construction" data-motion={motion}>
      <div className="world-scene" aria-hidden="true">
        <WorldScene theme="brooklyn" motion={motion} />
      </div>
      <main className={styles.collection} aria-label="Construction project collection">
        <ProjectGallery
          theme="brooklyn"
          displayScale={0.9}
          cursorTilt
          projectList={projects}
          motion={motion}
          selected={null}
          onSelect={()=>setRetry(value=>value+1)}
        />
      </main>
    </div>
  );
}
