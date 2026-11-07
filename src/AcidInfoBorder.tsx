import { memo, useId } from "react";
import "./acid-info-border.css";

/** Decorative only: the information and its box retain their original geometry. */
export const AcidInfoBorder = memo(function AcidInfoBorder() {
  const glow = `acid-info-glow-${useId().replace(/:/g, "")}`;
  const outline =
    "M15 4C49 1 71 7 102 4S161 2 187 4S212 2 227 4C235 5 236 10 237 17S235 36 237 47C238 57 232 63 223 63C191 66 164 60 135 63S74 65 45 63S22 66 13 63C4 62 2 55 4 46S2 25 4 16C5 8 7 4 15 4Z";
  return (
    <svg
      className="acid-info-border"
      viewBox="0 0 240 68"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={glow}
          x1="8"
          y1="0"
          x2="230"
          y2="68"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#DFFF68" />
          <stop offset=".38" stopColor="#A9F348" />
          <stop offset=".74" stopColor="#64EBA9" />
          <stop offset="1" stopColor="#DFFF68" />
        </linearGradient>
      </defs>
      <path
        className="acid-info-edge-halo"
        d={outline}
        stroke={`url(#${glow})`}
      />
      <path className="acid-info-edge" d={outline} stroke={`url(#${glow})`} />
      <path className="acid-info-edge-flow" d={outline} pathLength="100" />
      <path
        className="acid-info-ooze info-ooze-one"
        d="M43 63C46 62 46 66 45 67C42 70 40 67 41 65Z"
      />
      <path
        className="acid-info-ooze info-ooze-two"
        d="M191 3C192 0 195 0 196 2C197 5 194 5 191 3Z"
      />
    </svg>
  );
});
