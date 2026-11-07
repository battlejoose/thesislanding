import { memo, useEffect, useId, useState } from 'react';
import './acid-pool-header.css';

/** Decorative liquid only; independent of price and account updates. */
export const AcidPoolButtonSkin = memo(function AcidPoolButtonSkin({tone = 'teal'}: {tone?: 'teal' | 'gold'}) {
  const id = `acid-pool-gel-${useId().replace(/:/g, '')}`;
  const [paused, setPaused] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const update = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  const edge = 'M15 5C35 2 45 8 65 5S105 3 124 5C133 5 137 11 136 19S139 31 132 36C126 41 108 36 91 39S57 36 39 39S18 38 11 37C3 35 4 28 4 21S4 7 15 5Z';
  const wave = 'M-70 13C-35 1 1 25 35 13S105 25 140 13S210 25 245 13V60H-70Z';
  return (
    <svg className="pool-gel-skin" data-tone={tone} data-paused={paused} viewBox="0 0 140 46" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--gel-glass-top, #16786d)" />
          <stop offset="1" stopColor="var(--gel-glass-bottom, #083e3b)" />
        </linearGradient>
        <linearGradient id={`${id}-liquid`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--gel-light, #a4ffe7)" />
          <stop offset=".35" stopColor="var(--gel-middle, #58e8ce)" />
          <stop offset="1" stopColor="var(--gel-base, #2bbcae)" />
        </linearGradient>
        <clipPath id={`${id}-clip`}><path className="pool-gel-edge" d={edge} /></clipPath>
      </defs>
      <path className="pool-gel-edge pool-gel-halo" d={edge} />
      <path className="pool-gel-drip" d="M25 36C28 35 31 35 31 39C31 44 29 45 27 44S24 41 25 36Z" />
      <path className="pool-gel-drip pool-gel-drip-two" d="M112 36C115 35 118 35 118 39C118 43 116 44 114 43S112 39 112 36Z" />
      <path className="pool-gel-edge" d={edge} fill={`url(#${id}-glass)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <path className="pool-gel-wave pool-gel-wave-back" d={wave} />
        <path className="pool-gel-wave" d={wave} fill={`url(#${id}-liquid)`} />
        <path className="pool-gel-wave pool-gel-meniscus" d="M-70 13C-35 1 1 25 35 13S105 25 140 13S210 25 245 13" />
        <g className="pool-gel-bubbles">
          <circle cx="18" cy="40" r="2.1" />
          <circle cx="46" cy="42" r="1.4" />
          <circle cx="99" cy="40" r="1.8" />
          <circle cx="124" cy="43" r="2.5" />
        </g>
      </g>
      <path className="pool-gel-edge pool-gel-border" d={edge} />
      <path className="pool-gel-edge pool-gel-rim" d={edge} pathLength="100" />
    </svg>
  );
});
