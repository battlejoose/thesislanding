'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import ProjectGallery from '@/components/project-gallery';
import WorldScene from '@/components/world-scene';
import styles from './construction.module.css';
import { CONSTRUCTION_TOKENS, INITIAL_CONSTRUCTION_PROJECTS } from '@/lib/construction-projects';
import { prepareTokenProject, tokenRefreshDelay } from '@/lib/token-client';
import BootSplash from '@/components/boot-splash';
import { idle, settle, finish, type Stage } from '@/lib/boot-state';
import { hasWebGL } from '@/lib/webgl';

// However slow a device is, never hold the loading screen past this.
const BOOT_TIMEOUT_MS = 9000;
const FADE_MS = 520;

export default function Construction() {
  const [projects,setProjects]=useState(INITIAL_CONSTRUCTION_PROJECTS);
  const [retry,setRetry]=useState(0);
  const [motion, setMotion] = useState(false);
  const [webgl, setWebgl] = useState<boolean|null>(null);
  const [boot, setBoot] = useState(idle);
  const [hiddenSplash, setHiddenSplash] = useState(false);
  const report = useCallback((stage: Stage) => setBoot(current => settle(current, stage)), []);
  const onWorld = useCallback(() => report('world'), [report]);
  const onGallery = useCallback(() => report('gallery'), [report]);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!preference.matches);
    update();
    preference.addEventListener('change', update);
    const supported = hasWebGL();
    setWebgl(supported);
    // This edition has no 3D typography. Unsupported graphics settle in their
    // components, while token images still load for the plain HTML tiles.
    setBoot(current => settle(current, 'typography'));
    timer.current = setTimeout(() => setBoot(finish), BOOT_TIMEOUT_MS);
    return () => { preference.removeEventListener('change', update); if (timer.current) clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (!boot.done) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const fade = setTimeout(() => setHiddenSplash(true), FADE_MS);
    return () => clearTimeout(fade);
  }, [boot.done]);
  useEffect(() => {
    document.documentElement.toggleAttribute('data-booting', !boot.done);
    return () => { document.documentElement.removeAttribute('data-booting'); };
  }, [boot.done]);

  useEffect(()=>{
    const controller=new AbortController();let timer:ReturnType<typeof setTimeout>,running=false,failures=0,initial=true;
    if(retry>0)setProjects(current=>current.map(p=>p.dataState==='error'?{...p,dataState:'loading'}:p));
    const refresh=async()=>{
      if(running||(!initial&&document.hidden))return;running=true;clearTimeout(timer);
      const results=await Promise.all(CONSTRUCTION_TOKENS.filter((address):address is string=>!!address).map(async address=>{
        try{
          const project=await prepareTokenProject(address,controller.signal);
          if(!controller.signal.aborted)setProjects(current=>current.map(p=>p.id===address?project:p));
          return true;
        }catch{
          if(!controller.signal.aborted)setProjects(current=>current.map(p=>p.id===address?{...p,dataState:p.dataState==='ready'||p.dataState==='stale'?'stale':'error'}:p));
          return false;
        }
      }));
      running=false;initial=false;failures=results.every(Boolean)?0:failures+1;
      if(!controller.signal.aborted)report('images');
      if(!controller.signal.aborted)timer=setTimeout(refresh,tokenRefreshDelay(failures));
    };
    void refresh();document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);
    return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);};
  },[retry,report]);

  return (
    <div className={`showcase ${styles.construction}`} data-theme="brooklyn" data-edition="construction" data-motion={motion}>
      {!hiddenSplash && <BootSplash state={boot} fading={boot.done}/>}
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Thesis home"><img src="/thesis-logo.png" alt="Thesis" width={790} height={159}/></a>
      </header>
      <div className="world-scene" aria-hidden="true">
        <WorldScene theme="brooklyn" motion={motion} webgl={webgl} onReady={onWorld} />
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
          webgl={webgl}
          onReady={onGallery}
        />
      </main>
    </div>
  );
}
