'use client';
import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/lib/projects';
import { loreFor } from '@/lib/lore';

const CHAR_MS = 12;

export default function LoreBox({project,motion}:{project:Project|null;motion:boolean}) {
  // A fresh pick each time the pointer arrives, so the teases feel random.
  const [seed,setSeed] = useState(0);
  const previous = useRef<string|null>(null);
  useEffect(() => {
    const id = project?.id ?? null;
    if (id && id !== previous.current) setSeed(Math.floor(Math.random() * 997));
    previous.current = id;
  }, [project]);

  const content = loreFor(project, seed);
  const full = content ? content.lines.join('\n') : '';
  const [shown,setShown] = useState(0);
  useEffect(() => {
    if (!full) return;
    if (!motion) { setShown(full.length); return; }
    setShown(0);
    let index = 0;
    const tick = setInterval(() => {
      index += 3;
      setShown(index);
      if (index >= full.length) clearInterval(tick);
    }, CHAR_MS);
    return () => clearInterval(tick);
  }, [full, motion]);

  if (!content) return null;
  const typed = full.slice(0, shown);
  return <aside className="lore-box" aria-live="polite">
    <p className="lore-heading">{content.heading}</p>
    {typed.split('\n').map((line,i) => <p key={i} className="lore-line">{line}</p>)}
    {shown < full.length && <span className="lore-caret" aria-hidden="true"/>}
  </aside>;
}
