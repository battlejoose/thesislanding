'use client';
import { useEffect, useState } from 'react';
import WorldScene from '@/components/world-scene';
import ProjectGallery from '@/components/project-gallery';
import SpatialTypography from '@/components/spatial-typography';

const eyebrow = 'BROOKLYN / BUILT TOGETHER';
// The headline alternates between the two theses. Each line is its own spatial-text
// span because the 3D typography scales one text geometry to one element rect —
// a span that wraps would be stretched to fill the wrapped box.
const phrases = [
  { lead: 'We are building', lines: ['Gamified', 'Ponzification', 'Proliferation'] },
  { lead: 'We are finding', lines: ['the Product', 'Meme fit'] },
];
const PHRASE_MS = 4000;

export default function Home() {
  const [reduced, setReduced] = useState(true);
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches); update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  const motion = !reduced;
  useEffect(() => {
    if (!motion) return;
    const timer = setInterval(() => setIndex(current => (current + 1) % phrases.length), PHRASE_MS);
    return () => clearInterval(timer);
  }, [motion]);
  const phrase = phrases[index];
  return <div className="showcase" data-theme="brooklyn" data-motion={motion}>
    <SpatialTypography motion={motion}/><a className="skip-link" href="#projects">Skip to projects</a>
    <div className="page-shell">
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Thesis home"><img src="/thesis-logo.png" alt="Thesis" width={790} height={159}/></a>
      </header>
      <main>
        <section className="intro" aria-labelledby="world-title">
          <div className="intro-copy" key={index}>
            <div className="eyebrow"><span className="living-dot"/><span data-spatial-text data-spatial-tone="accent">{eyebrow}</span></div>
            <h1 id="world-title"><span data-spatial-text="heading">{phrase.lead}</span>{phrase.lines.map(part => <em key={part} data-spatial-text="heading" data-spatial-tone="accent">{part}</em>)}</h1>
          </div>
          <div className="world-scene"><WorldScene motion={motion}/></div>
        </section>
        <section id="projects" className="projects-section" aria-label="Builds">
          <ProjectGallery motion={motion}/>
        </section>
      </main>
    </div>
  </div>;
}
