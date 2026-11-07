import { memo, useId } from "react";

/** A small liquid silhouette; only the decoration moves, never the label. */
export const AcidHowButtonSkin = memo(function AcidHowButtonSkin() {
  const id = `acid-how-gel-${useId().replace(/:/g, "")}`;
  const edge = "M15 5C35 2 45 8 65 5S105 3 124 5C133 5 137 11 136 19S139 31 132 36C126 41 108 36 91 39S57 36 39 39S18 38 11 37C3 35 4 28 4 21S4 7 15 5Z";
  return (
    <svg className="how-slime-skin" viewBox="0 0 140 46" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2=".2" y2="1">
          <stop stopColor="#ecffad" />
          <stop offset=".32" stopColor="#caff49" />
          <stop offset=".72" stopColor="#a6ed25" />
          <stop offset="1" stopColor="#71ba12" />
        </linearGradient>
      </defs>
      <path className="how-slime-halo" d={edge} />
      <path className="how-slime-drip how-slime-drip-one" d="M24 36C28 35 31 35 31 39C31 43 30 45 27 45S23 42 24 36Z" />
      <path className="how-slime-drip how-slime-drip-two" d="M113 36C116 35 119 35 119 38C119 42 117 44 115 43S112 39 113 36Z" />
      <path className="how-slime-body" d={edge} fill={`url(#${id})`} />
      <path className="how-slime-rim" d={edge} pathLength="100" />
      <path className="how-slime-gloss" d="M16 9C36 6 47 12 65 9S105 7 123 9" />
      <g className="how-slime-bubbles">
        <circle cx="10" cy="28" r="1.9" />
        <circle cx="130" cy="30" r="1.5" />
        <circle cx="119" cy="33" r="1.1" />
      </g>
    </svg>
  );
});
