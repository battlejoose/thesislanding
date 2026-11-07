import { memo, useId, type CSSProperties } from "react";
import "./active-position-acid.css";

type BubbleStyle = CSSProperties & {
  "--bubble-x": string;
  "--bubble-bottom": string;
  "--bubble-size": string;
  "--bubble-rise": string;
  "--bubble-drift": string;
  "--bubble-delay": string;
  "--bubble-duration": string;
};

// Tall trails stay in the empty side gutters. Bottom fizz only clears the puddle.
const bubbles = [
  ["5px", "9%", 5, 38, 2, -1.4, 4.7],
  ["7px", "39%", 3, 32, -2, -3.8, 5.6],
  ["4px", "70%", 4, 25, 1, -2.1, 6.2],
  ["calc(100% - 8px)", "12%", 4, 39, -1, -0.7, 5.4],
  ["calc(100% - 6px)", "42%", 3, 27, -2, -4.2, 6.6],
  ["calc(100% - 8px)", "73%", 5, 23, 2, -2.7, 5.1],
  ["9%", "3px", 4, 16, 3, -3.2, 4.9],
  ["21%", "2px", 3, 13, -3, -0.9, 3.9],
  ["34%", "4px", 5, 16, 2, -4.4, 5.8],
  ["46%", "2px", 3, 12, -2, -2.4, 4.6],
  ["59%", "3px", 4, 15, 3, -1.7, 5.3],
  ["72%", "2px", 3, 13, -3, -3.9, 4.2],
  ["85%", "3px", 5, 18, 2, -1.1, 5.7],
  ["94%", "2px", 3, 14, -1, -2.9, 4.5],
] as const;

/** A shallow liquid chamber behind an active trade, never above its controls. */
export const ActivePositionAcid = memo(function ActivePositionAcid() {
  const id = useId().replace(/:/g, "");
  const liquid = `position-acid-liquid-${id}`;
  const reflection = `position-acid-reflection-${id}`;

  return (
    <div className="active-position-acid" aria-hidden="true">
      <div className="position-acid-bottom-glow" />
      <svg
        className="position-acid-puddle"
        viewBox="0 0 480 28"
        preserveAspectRatio="none"
        focusable="false"
      >
        <defs>
          <linearGradient id={liquid} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#DFFF65" stopOpacity=".17" />
            <stop offset=".5" stopColor="#BFFF3D" stopOpacity=".42" />
            <stop offset="1" stopColor="#B9F738" stopOpacity=".72" />
          </linearGradient>
          <linearGradient id={reflection} x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#B4EA48" stopOpacity="0" />
            <stop offset=".17" stopColor="#E8FFA8" stopOpacity=".7" />
            <stop offset=".52" stopColor="#D6FF74" stopOpacity=".12" />
            <stop offset=".85" stopColor="#E8FFA8" stopOpacity=".65" />
            <stop offset="1" stopColor="#B4EA48" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          className="position-acid-wave position-acid-wave-back"
          d="M-90 18C-50 13-15 25 24 18S97 23 137 17S208 24 249 17S319 23 358 18S430 23 470 17S535 22 573 17V38H-90Z"
          fill="#BFF54A"
        />
        <path
          className="position-acid-wave"
          d="M-90 20C-47 14-11 24 29 19S101 24 141 19S214 24 254 18S327 24 367 19S439 25 478 19S538 23 573 19V38H-90Z"
          fill={`url(#${liquid})`}
        />
        <path
          className="position-acid-wave position-acid-meniscus"
          d="M-90 20C-47 14-11 24 29 19S101 24 141 19S214 24 254 18S327 24 367 19S439 25 478 19S538 23 573 19"
        />
        <path
          className="position-acid-reflection"
          d="M12 26H468"
          stroke={`url(#${reflection})`}
        />
      </svg>
      {bubbles.map(([x, bottom, size, rise, drift, delay, duration], index) => (
        <i
          key={index}
          className="position-acid-bubble"
          style={
            {
              "--bubble-x": x,
              "--bubble-bottom": bottom,
              "--bubble-size": `${size}px`,
              "--bubble-rise": `${-rise}px`,
              "--bubble-drift": `${drift}px`,
              "--bubble-delay": `${delay}s`,
              "--bubble-duration": `${duration}s`,
            } as BubbleStyle
          }
        />
      ))}
    </div>
  );
});
