'use client';

import { useEffect, useState } from 'react';
import ProjectGallery from '@/components/project-gallery';
import WorldScene from '@/components/world-scene';
import styles from './construction.module.css';

export default function Construction() {
  const [selected, setSelected] = useState<string | null>(null);
  const [motion, setMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!preference.matches);
    update();
    preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  return (
    <div className={`showcase ${styles.construction}`} data-theme="brooklyn" data-edition="construction" data-motion={motion}>
      <div className="world-scene" aria-hidden="true">
        <WorldScene theme="brooklyn" motion={motion} />
      </div>
      <main className={styles.collection} aria-label="Construction project collection">
        <ProjectGallery
          theme="brooklyn"
          motion={motion}
          selected={selected}
          onSelect={id => setSelected(current => current === id ? null : id)}
        />
      </main>
    </div>
  );
}
