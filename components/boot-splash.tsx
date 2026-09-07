'use client';
import { caption, progress, type BootState } from '@/lib/boot-state';
export default function BootSplash({state,fading}:{state:BootState;fading:boolean}) {
  const percent = Math.round(progress(state) * 100);
  return <output className="boot-splash" data-fading={fading} aria-label="Loading">
    <div className="boot-inner">
      <img className="boot-logo" src="/thesis-logo.png" alt="Thesis" width={790} height={159}/>
      <div className="boot-rail"><span style={{width:`${percent}%`}}/></div>
      <p className="boot-caption"><span>{caption(state)}</span><span className="boot-percent">{percent}%</span></p>
    </div>
  </output>;
}
