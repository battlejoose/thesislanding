'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Sprout, Building2, Cog, Play, Pause } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Theme } from '@/lib/projects';
import WorldScene from '@/components/world-scene';
import ProjectGallery from '@/components/project-gallery';
const worlds = {
  roots: { label: 'Roots', eyebrow: 'GROUNDED IN POSSIBILITY', title: 'Good ideas.', emphasis: 'Deep roots.', copy: 'Discover the projects planting the seeds of what comes next.', icon: Sprout, chapter: '01 / THE LIVING WORLD' },
  brooklyn: { label: 'Brooklyn', eyebrow: 'INDEPENDENT SPIRIT. COLLECTIVE ENERGY.', title: 'The next wave.', emphasis: 'From the block.', copy: 'A new generation of projects. Built with ambition. Owned by the community.', icon: Building2, chapter: '02 / THE CITY EDITION' },
  steampunk: { label: 'Steampunk', eyebrow: 'INGENUITY IN MOTION', title: 'Bright minds.', emphasis: 'Great machines.', copy: 'Extraordinary projects powering a world of new possibilities.', icon: Cog, chapter: '03 / THE AGE OF INVENTION' },
};

export default function Home() {
  const [theme, setTheme] = useState<Theme>('roots');
  const [selected, setSelected] = useState<string|null>(null);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches); update(); query.addEventListener('change', update);
    try { const saved = localStorage.getItem('thesis-world'); if (saved === 'roots' || saved === 'brooklyn' || saved === 'steampunk') setTheme(saved); setPaused(localStorage.getItem('thesis-paused') === 'true'); } catch { /* Preferences are optional when storage is unavailable. */ }
    return () => query.removeEventListener('change', update);
  }, []);
  const motion = !paused && !reduced;
  const chooseTheme = (value: Theme) => { setTheme(value); try { localStorage.setItem('thesis-world', value); } catch { /* Storage may be disabled. */ } };
  const toggleMotion = () => { const value = !paused; setPaused(value); try { localStorage.setItem('thesis-paused', String(value)); } catch { /* Storage may be disabled. */ } };
  const world = worlds[theme];
  return <div className="showcase" data-theme={theme} data-motion={motion}>
    <a className="skip-link" href="#projects">Skip to projects</a>
    <div className="page-shell">
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Thesis home"><span className="brand-symbol">t.</span>thesis<span className="brand-period">®</span></a>
        <Tabs className="world-tabs" value={theme} onValueChange={v => chooseTheme(v as Theme)} aria-label="Choose your world">
          <TabsList className="world-list">{Object.entries(worlds).map(([key, value]) => <TabsTrigger className="world-tab" key={key} value={key}><value.icon size={16}/><span>{value.label}</span></TabsTrigger>)}</TabsList>
        </Tabs>
        <a className="header-explore" href="#projects">Explore projects <ArrowUpRight size={17}/></a>
      </header>
      <main>
        <section className="intro" aria-labelledby="world-title">
          <div className="intro-copy" key={theme}>
            <div className="eyebrow"><span className="living-dot"/>{world.eyebrow}</div>
            <h1 id="world-title">{world.title}<br/><em>{world.emphasis}</em></h1>
            <p>{world.copy}</p>
          </div>
          <div className="world-scene"><WorldScene theme={theme} motion={motion}/></div>
          <div className="intro-foot"><button className="motion-toggle" onClick={toggleMotion} disabled={reduced} aria-pressed={paused || reduced} aria-label={motion ? "Pause ambient animations" : reduced ? "Motion reduced by device settings" : "Resume ambient animations"}>{motion ? <Pause size={12}/> : <Play size={12}/>}<span>{motion ? "Pause motion" : "Motion paused"}</span></button><a href="#projects">Find your next discovery <ArrowDown size={14}/></a></div>
        </section>
        <section id="projects" className="projects-section" aria-labelledby="projects-title">
          <div className="collection-header"><div><span className="section-index">01 —</span><h2 id="projects-title">The collection <span>06</span></h2></div><span className="collection-note"><span className="living-dot"/>6 perspectives. Endless possibility.</span></div>
          <ProjectGallery theme={theme} motion={motion} selected={selected} onSelect={id => setSelected(current => current === id ? null : id)}/>
          <p className="collection-end"><span/>Big things start with a little curiosity.<Sprout size={16}/><span/></p>
        </section>
      </main>
      <footer><a className="footer-brand" href="#">thesis.</a><span>A different world. The same possibilities.</span><span className="demo-note">Concept projects · Illustrative market data · <a href="https://mixkit.co/license/#videoFree" target="_blank" rel="noopener noreferrer">Film credits ↗</a></span></footer>
    </div>
  </div>;
}
