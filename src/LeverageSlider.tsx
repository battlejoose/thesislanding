import { useId, type CSSProperties, type KeyboardEvent } from "react";
import { LEVERAGE_NODES, leverageAt, leveragePosition } from "./leverage.ts";
import "./acid-leverage.css";

export function LeverageSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const position = leveragePosition(value);
  const liquidId = `acid-leverage-${id.replace(/:/g, "")}`;
  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    let next: number;
    switch (event.key) {
      // Bypass magnets for keyboard fine adjustment so a node never traps focus.
      case "ArrowRight":
      case "ArrowUp":
        next = value + 1;
        break;
      case "ArrowLeft":
      case "ArrowDown":
        next = value - 1;
        break;
      case "Home":
        next = 1;
        break;
      case "End":
        next = 1000;
        break;
      case "PageUp":
        next = LEVERAGE_NODES.find((n) => n.value > value)?.value ?? 1000;
        break;
      case "PageDown":
        next =
          [...LEVERAGE_NODES].reverse().find((n) => n.value < value)?.value ??
          1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(Math.max(1, Math.min(1000, next)));
  }
  return (
    <div className="leverage-control">
      <div className="leverage-liquid" aria-hidden="true">
        <div
          className="leverage-liquid-level"
          style={{ height: `${4 + position * 100}%` }}
        >
          <svg
            viewBox="0 0 320 100"
            preserveAspectRatio="none"
            focusable="false"
          >
            <defs>
              <linearGradient id={liquidId} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#BFFF46" stopOpacity="0.32" />
                <stop offset="0.48" stopColor="#88C825" stopOpacity="0.2" />
                <stop offset="1" stopColor="#C8FF39" stopOpacity="0.46" />
              </linearGradient>
            </defs>
            <path
              className="leverage-liquid-wave leverage-liquid-wave-back"
              d="M-70 10C-35-1 1 22 35 10S105 22 140 10S210 22 245 10S315 22 350 10S415 20 450 9V110H-70Z"
              fill="#C8FF39"
            />
            <path
              className="leverage-liquid-wave"
              d="M-70 10C-35-1 1 22 35 10S105 22 140 10S210 22 245 10S315 22 350 10S415 20 450 9V110H-70Z"
              fill={`url(#${liquidId})`}
            />
            <path
              className="leverage-liquid-wave leverage-liquid-meniscus"
              d="M-70 10C-35-1 1 22 35 10S105 22 140 10S210 22 245 10S315 22 350 10S415 20 450 9"
            />
            <g className="leverage-liquid-bubbles">
              <circle cx="19" cy="91" r="3.3" />
              <circle cx="71" cy="72" r="2.1" />
              <circle cx="137" cy="88" r="3.8" />
              <circle cx="217" cy="76" r="2.7" />
              <circle cx="273" cy="94" r="4" />
              <circle cx="306" cy="64" r="2.1" />
            </g>
          </svg>
        </div>
      </div>
      <div className="leverage-heading">
        <output className="leverage-value" htmlFor={id}>
          {value}
          <span>×</span>
        </output>
        <span className="input-title">Leverage</span>
      </div>
      <div
        className="leverage-slider"
        style={{ "--leverage-progress": `${position * 100}%` } as CSSProperties}
      >
        <div className="leverage-track" aria-hidden="true">
          <span className="leverage-fill" />
          {LEVERAGE_NODES.map((node) => (
            <span
              key={node.value}
              className={`leverage-node${value >= node.value ? " reached" : ""}${value === node.value ? " snapped" : ""}`}
              style={{ left: `${node.at * 100}%` }}
            />
          ))}
        </div>
        <input
          id={id}
          className="leverage-range"
          type="range"
          min="0"
          max="1600"
          step="1"
          value={Math.round(position * 1600)}
          aria-label="Leverage"
          aria-valuetext={`${value}× leverage`}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(leverageAt(Number(e.target.value) / 1600))}
          onKeyDown={keyDown}
        />
      </div>
      <div className="leverage-limits" aria-hidden="true">
        <span>1×</span>
        <span>1000×</span>
      </div>
      <span id={`${id}-hint`} className="sr-only">
        Snaps to 1×, 5×, 10×, 25×, 100×, 500× and 1000×. Arrow keys adjust by
        1×. Page Up and Page Down jump between nodes.
      </span>
    </div>
  );
}
