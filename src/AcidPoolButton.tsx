import { memo, useId, type CSSProperties } from "react";
import { sdiceSkin } from './app-url.ts';
import "./acid-pool-button.css";

type Props = { symbol: string; onClick: () => void; hasRewards?: boolean };

/** A little pressurised pool of acid. The moving liquid never covers its label. */
export const AcidPoolButton = memo(function AcidPoolButton({ symbol, onClick, hasRewards = false }: Props) {
  const id = useId().replace(/:/g, "");
  const chamber = `acid-pool-chamber-${id}`;
  const glass = `acid-pool-glass-${id}`;
  const liquid = `acid-pool-liquid-${id}`;
  const celebration = `acid-pool-celebration-${id}`;
  const ticker = `$${symbol.replace(/^\$/, "")}`;

  return (
    <button
      type="button"
      className={`pool-button acid-reactor-pool${hasRewards ? " has-rewards" : ""}`}
      onClick={onClick}
      aria-label={`Pool and rewards ${ticker}${hasRewards ? ": rewards available" : ""}`}
    >
      {sdiceSkin && hasRewards && <span className="sdice-pool-reward-effects" aria-hidden="true">
        <span className="sdice-pool-reward-aura" />
        {Array.from({ length: 20 }, (_, i) => {
          const angle = i * Math.PI / 10;
          return <span key={i} className="sdice-pool-reward-spark" style={{
            left: `${50 + Math.cos(angle) * 49}%`,
            top: `${50 + Math.sin(angle) * 48}%`,
            '--spark-color': ['#7ffff0', '#ffc96b', '#ef98ff', '#90caff', '#ff91c2'][i % 5],
            '--spark-x': `${Math.cos(angle) * 9}px`,
            '--spark-y': `${Math.sin(angle) * 8}px`,
            animationDelay: `${-i * .17}s`,
            animationDuration: `${1.6 + (i % 4) * .22}s`,
          } as CSSProperties} />;
        })}
      </span>}
      <svg
        className="acid-pool-vessel"
        viewBox="0 0 152 76"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <linearGradient
            id={glass}
            x1="76"
            y1="9"
            x2="76"
            y2="66"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#253619" />
            <stop offset="0.42" stopColor="#132014" />
            <stop offset="1" stopColor="#243816" />
          </linearGradient>
          <linearGradient
            id={liquid}
            x1="70"
            y1="48"
            x2="70"
            y2="66"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#DCFF5B" stopOpacity="0.2" />
            <stop offset="1" stopColor="#C8FF39" stopOpacity="0.8" />
          </linearGradient>
          <clipPath id={chamber}>
            <path d="M22 12H128C137 12 141 18 140 28L138 48C137 59 132 63 122 63H29C18 63 13 58 12 48L10 29C9 18 13 12 22 12Z" />
          </clipPath>
          <linearGradient
            id={celebration}
            x1="10"
            y1="65"
            x2="142"
            y2="8"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#DFFF58" />
            <stop offset=".3" stopColor="#6AFFAD" />
            <stop offset=".56" stopColor="#72F7FF" />
            <stop offset=".78" stopColor="#FFA2EF" />
            <stop offset="1" stopColor="#DDFF5A" />
          </linearGradient>
        </defs>

        {/* An asymmetric soft chamber, not a rectangular button skin. */}
        <path
          className="acid-pool-shell"
          d="M22 8C51 10 98 5 128 8C140 9 146 17 144 30L142 49C141 62 134 68 121 67L31 67C17 68 9 62 8 50L6 29C4 15 10 7 22 8Z"
          fill={`url(#${glass})`}
        />
        <g clipPath={`url(#${chamber})`}>
          {hasRewards && (
            <path
              className="acid-pool-reward-wave"
              d="M-55 59C-27 34-2 60 22 46S66 60 92 44S136 58 162 46S193 51 220 43V80H-55Z"
              fill={`url(#${celebration})`}
            />
          )}
          <path
            className="acid-pool-wash acid-pool-wash-back"
            d="M-55 54C-29 47-9 62 15 53S60 60 84 52S124 60 148 52S187 58 211 51V81H-55Z"
            fill="#B0F942"
          />
          <path
            className="acid-pool-wash"
            d="M-55 54C-29 47-9 62 15 53S60 60 84 52S124 60 148 52S187 58 211 51V81H-55Z"
            fill={`url(#${liquid})`}
          />
          <path
            className="acid-pool-meniscus"
            d="M-55 54C-29 47-9 62 15 53S60 60 84 52S124 60 148 52S187 58 211 51"
          />
          <g className="acid-pool-inner-bubbles">
            <circle
              className="acid-pool-bubble bubble-one"
              cx="20"
              cy="55"
              r="2.5"
            />
            <circle
              className="acid-pool-bubble bubble-two"
              cx="131"
              cy="56"
              r="3"
            />
            <circle
              className="acid-pool-bubble bubble-three"
              cx="123"
              cy="61"
              r="1.6"
            />
            <circle
              className="acid-pool-bubble bubble-four"
              cx="29"
              cy="60"
              r="1.4"
            />
          </g>
          {hasRewards && (
            <g className="acid-pool-reward-fizz">
              <circle cx="15" cy="55" r="2.3" />
              <circle cx="26" cy="64" r="1.6" />
              <circle cx="135" cy="62" r="2.3" />
              <circle cx="129" cy="56" r="1.4" />
              <circle cx="19" cy="39" r="1.2" />
              <circle cx="140" cy="38" r="1.8" />
            </g>
          )}
        </g>

        {hasRewards && (
          <g className="acid-pool-reward-trim">
            <path
              className="acid-pool-reward-edge"
              d="M22 8C51 10 98 5 128 8C140 9 146 17 144 30L142 49C141 62 134 68 121 67L31 67C17 68 9 62 8 50L6 29C4 15 10 7 22 8Z"
              stroke={`url(#${celebration})`}
            />
            <path
              className="acid-pool-reward-chase"
              pathLength="100"
              d="M22 8C51 10 98 5 128 8C140 9 146 17 144 30L142 49C141 62 134 68 121 67L31 67C17 68 9 62 8 50L6 29C4 15 10 7 22 8Z"
            />
            <path
              className="acid-pool-reward-spark reward-spark-cyan"
              d="M3 17L0 13M3 21H0M6 12L5 8"
            />
            <path
              className="acid-pool-reward-spark reward-spark-pink"
              d="M146 56L151 58M145 61L148 65M149 52H152"
            />
            <circle
              className="acid-pool-reward-orb reward-orb-one"
              cx="53"
              cy="7"
              r="2"
            />
            <circle
              className="acid-pool-reward-orb reward-orb-two"
              cx="103"
              cy="8"
              r="2.4"
            />
            <path
              className="acid-pool-reward-ooze"
              d="M78 67C81 65 82 68 81 71C80 75 76 73 77 70Z"
            />
          </g>
        )}

        <path
          className="acid-pool-rim"
          d="M23 11C48 13 102 8 127 11C135 12 139 15 140 20"
        />
        <path
          className="acid-pool-rim-bottom"
          d="M17 58C21 64 26 64 35 64H116"
        />
        <path className="acid-pool-seam" d="M10 28L12 43M140 33L139 42" />

        <path
          className="acid-pool-drip drip-one"
          d="M35 65C38 64 39 66 39 69C39 73 35 74 34 70C34 68 34 66 35 65Z"
        />
        <path
          className="acid-pool-drip drip-two"
          d="M116 65C117 64 120 64 120 66C120 68 119 70 117 70C115 70 114 66 116 65Z"
        />

        <circle
          className="acid-pool-escape escape-one"
          cx="124"
          cy="10"
          r="2.1"
        />
        <circle
          className="acid-pool-escape escape-two"
          cx="26"
          cy="10"
          r="1.7"
        />
        <path
          className="acid-pool-spark spark-one"
          d="M140 9L144 5M142 12L148 11"
        />
        <path className="acid-pool-spark spark-two" d="M9 58L3 60M10 61L7 65" />
        <path
          className="acid-pool-spark spark-three"
          d="M116 3V0M119 4L122 1"
        />
      </svg>
      <span className="acid-pool-copy">
        {hasRewards && (
          <span className="acid-pool-ready-dot" aria-hidden="true" />
        )}
        <span className="pool-button-label">Pool &amp; Rewards</span>
        <span className="acid-pool-ticker">{ticker}</span>
      </span>
    </button>
  );
});
