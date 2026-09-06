'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import WorldScene from '@/components/world-scene';
import ProjectGallery from '@/components/project-gallery';
import SpatialTypography from '@/components/spatial-typography';
import BootSplash from '@/components/boot-splash';
import { idle, settle, finish, type Stage } from '@/lib/boot-state';
import { hasWebGL } from '@/lib/webgl';

// Hero copy, hidden with the markup below. Each headline line is its own
// spatial-text span because the 3D typography scales one text geometry to one
// element rect — a span that wraps would be stretched to fill the wrapped box.
// const eyebrow = 'BROOKLYN / BUILT TOGETHER';
// const phrases = [
//   { lead: 'We are building', lines: ['Gamified', 'Ponzification', 'Proliferation'] },
//   { lead: 'We are finding', lines: ['the Product', 'Meme fit'] },
// ];
// const PHRASE_MS = 4000;
// However slow a device is, never hold the loading screen past this.
const BOOT_TIMEOUT_MS = 9000;
const FADE_MS = 520;

export default function Home() {
  const [reduced, setReduced] = useState(true);
  // null until the capability check runs, so no three.js is fetched before it.
  const [webgl, setWebgl] = useState<boolean|null>(null);
  const [boot, setBoot] = useState(idle);
  const [hidden, setHidden] = useState(false);
  const report = useCallback((stage: Stage) => setBoot(current => settle(current, stage)), []);
  const onType = useCallback(() => report('typography'), [report]);
  const onWorld = useCallback(() => report('world'), [report]);
  const onGallery = useCallback(() => report('gallery'), [report]);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches); update(); query.addEventListener('change', update);
    const supported = hasWebGL();
    setWebgl(supported);
    // With no WebGL nothing will ever report, so lift straight to the plain page.
    if (!supported) setBoot(finish);
    else timer.current = setTimeout(() => setBoot(finish), BOOT_TIMEOUT_MS);
    return () => { query.removeEventListener('change', update); if (timer.current) clearTimeout(timer.current); };
  }, []);
  const motion = !reduced;
  useEffect(() => {
    if (!boot.done) return;
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const fade = setTimeout(() => setHidden(true), FADE_MS);
    return () => clearTimeout(fade);
  }, [boot.done]);
  // The page must stay mounted under the splash: the gallery measures the real
  // card rects to place its 3D tiles. Lock scrolling instead of unmounting.
  useEffect(() => {
    document.documentElement.toggleAttribute('data-booting', !boot.done);
    return () => { document.documentElement.removeAttribute('data-booting'); };
  }, [boot.done]);
  return <div className="showcase" data-theme="brooklyn" data-motion={motion}>
    {webgl && <SpatialTypography motion={motion} onReady={onType}/>}
    {!hidden && <BootSplash state={boot} fading={boot.done}/>}
    <a className="skip-link" href="#projects">Skip to projects</a>
    <div className="page-shell">
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Thesis home"><img src="/thesis-logo.png" alt="Thesis" width={790} height={159}/></a>
      </header>
      <main>
        <section className="intro" aria-label="Brooklyn">
          {/* Hero copy hidden for now. Restore by uncommenting this block and the
              `phrases` constant, the `index` state and the rotation effect above.
          <div className="intro-copy" key={index}>
            <div className="eyebrow"><span className="living-dot"/><span data-spatial-text data-spatial-tone="accent">{eyebrow}</span></div>
            <h1 id="world-title"><span data-spatial-text="heading">{phrase.lead}</span>{phrase.lines.map(part => <em key={part} data-spatial-text="heading" data-spatial-tone="accent">{part}</em>)}</h1>
          </div>
          */}
          <div className="world-scene"><WorldScene motion={motion} webgl={webgl===true} onReady={onWorld}/></div>
        </section>
        <section id="projects" className="projects-section" aria-label="Builds">
          <ProjectGallery motion={motion} webgl={webgl===true} onReady={onGallery}/>
        </section>
      </main>
    </div>
  </div>;
}
