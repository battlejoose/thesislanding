'use client';
import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUpRight, Sprout, Building2, Cog, Play, Pause, Flame, Orbit } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type Theme } from '@/lib/projects';
import WorldScene from '@/components/world-scene';
import ProjectGallery from '@/components/project-gallery';
import SpatialTypography from '@/components/spatial-typography';
const worlds = {
  volcanic: { label: 'Volcanic', eyebrow: 'FORGED IN FIRE', title: 'Raw energy.', emphasis: 'New worlds.', copy: 'Ideas with the power to reshape everything.', icon: Flame, chapter: '04 / FIRE & FORM' },
  space: { label: 'Space', eyebrow: 'BEYOND THE HORIZON', title: 'Think bigger.', emphasis: 'Go further.', copy: 'Discover the projects reaching for the next frontier.', icon: Orbit, chapter: '05 / THE COSMIC FRONTIER' },
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
    try { const saved = localStorage.getItem('thesis-world'); if (saved === 'roots' || saved === 'brooklyn' || saved === 'steampunk' || saved === 'volcanic' || saved === 'space') setTheme(saved); setPaused(localStorage.getItem('thesis-paused') === 'true'); } catch { /* Preferences are optional when storage is unavailable. */ }
    return () => query.removeEventListener('change', update);
  }, []);
  const motion = !paused && !reduced;
  const chooseTheme = (value: Theme) => { setTheme(value); try { localStorage.setItem('thesis-world', value); } catch { /* Storage may be disabled. */ } };
  const toggleMotion = () => { const value = !paused; setPaused(value); try { localStorage.setItem('thesis-paused', String(value)); } catch { /* Storage may be disabled. */ } };
  const world = worlds[theme];
  return <div className="showcase" data-theme={theme} data-motion={motion}>
    <SpatialTypography motion={motion}/><a className="skip-link" href="#projects">Skip to projects</a>
    <div className="page-shell">
      <header className="site-header">
        <a className="wordmark" href="#" aria-label="Thesis home"><span className="brand-symbol">t.</span><span data-spatial-text>thesis.</span></a>
        <Tabs className="world-tabs" value={theme} onValueChange={v => chooseTheme(v as Theme)} aria-label="Choose your world">
          <TabsList className="world-list">{(['roots','brooklyn','steampunk','volcanic','space'] as Theme[]).map(key => [key, worlds[key]] as const).map(([key, value]) => <TabsTrigger data-spatial-panel className="world-tab" key={key} value={key}><value.icon size={16}/><span data-spatial-text>{value.label}</span></TabsTrigger>)}</TabsList>
        </Tabs>
        <a className="header-explore" href="#projects"><span data-spatial-text>Explore projects</span> <ArrowUpRight size={17}/></a>
      </header>
      <main>
        <section className="intro" aria-labelledby="world-title">
          <div className="intro-copy" key={theme}>
            <div className="eyebrow"><span className="living-dot"/><span data-spatial-text data-spatial-tone="accent">{world.eyebrow}</span></div>
            <h1 id="world-title"><span data-spatial-text="heading">{world.title}</span><br/><em data-spatial-text="heading" data-spatial-tone="accent">{world.emphasis}</em></h1>
            <p className="spatial-description">{(world.copy.match(/.{1,35}(?:\s|$)/g) ?? [world.copy]).map((part,i)=><span key={i} data-spatial-text data-spatial-tone="muted">{part}</span>)}</p>
          </div>
          <div className="world-scene"><WorldScene theme={theme} motion={motion}/></div>
          <div className="intro-foot"><button className="motion-toggle" onClick={toggleMotion} disabled={reduced} aria-pressed={paused || reduced} aria-label={motion ? "Pause ambient animations" : reduced ? "Motion reduced by device settings" : "Resume ambient animations"}>{motion ? <Pause size={12}/> : <Play size={12}/>}<span data-spatial-text data-spatial-tone="muted">{motion ? "Pause motion" : "Motion paused"}</span></button><a href="#projects"><span data-spatial-text data-spatial-tone="muted">Find your next discovery</span> <ArrowDown size={14}/></a></div>
        </section>
        <section id="projects" className="projects-section" aria-labelledby="projects-title">
          <div className="collection-header"><div><span className="section-index" data-spatial-text data-spatial-tone="muted">01 /</span><h2 id="projects-title"><span data-spatial-text>The collection</span> <sup data-spatial-text data-spatial-tone="accent">06</sup></h2></div><span className="collection-note"><span className="living-dot"/><span data-spatial-text data-spatial-tone="muted">Scroll to turn the collection.</span></span></div>
          <ProjectGallery theme={theme} motion={motion} selected={selected} onSelect={id => setSelected(current => current === id ? null : id)}/>
          <p className="collection-end"><span/><em data-spatial-text data-spatial-tone="muted">Big things start with a little curiosity.</em><Sprout size={16}/><span/></p>
        </section>
      </main>
      <footer><a className="footer-brand" href="#"><span data-spatial-text>thesis.</span></a><span data-spatial-text data-spatial-tone="muted">A different world. The same possibilities.</span><span className="demo-note"><span data-spatial-text data-spatial-tone="muted">Concept projects / Illustrative data / </span><a href="https://mixkit.co/license/#videoFree" target="_blank" rel="noopener noreferrer"><span data-spatial-text data-spatial-tone="muted">Film credits</span> ↗</a></span></footer>
    </div>
  </div>;
}
