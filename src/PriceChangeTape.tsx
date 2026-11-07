import { memo, useEffect, useState, type CSSProperties } from "react";
import { formatChange } from "./market-view.ts";
import {
  initialPriceTape, receivePriceChanges,
  PRICE_TAPE_ROWS, type PriceChange,
} from "./price-tape.ts";

export const PriceChangeTape = memo(function PriceChangeTape({ changes }: { changes: PriceChange[] }) {
  const [tape, setTape] = useState(() => initialPriceTape(changes));
  const [animate, setAnimate] = useState(() =>
    !document.hidden && !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Derive the next row before this render commits, so the headline and tape
  // change in the same paint instead of using an independent replay timer.
  const next = receivePriceChanges(tape, changes);
  if (next !== tape) setTape(animate ? next : initialPriceTape(changes));

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setAnimate(!document.hidden && !motion.matches);
    motion.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      motion.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <ol
      key={tape.step}
      className={`price-changes${animate && tape.step ? " moving" : ""}`}
      aria-label="Latest price updates"
      style={{ "--tick-duration": "150ms" } as CSSProperties}
    >
      {tape.shown.map((change, index) => (
        <li key={change.key} data-price-sequence={change.key}
          aria-hidden={index >= PRICE_TAPE_ROWS || undefined}
          className={change.fraction === 0 ? "unchanged" : change.fraction > 0 ? "positive" : "negative"}>
          <span aria-hidden="true">{change.fraction === 0 ? "" : change.fraction > 0 ? "▴" : "▾"}</span>
          <span className="tick-value">{change.fraction === 0 ? "+-0.00%" : formatChange(change.fraction)}</span>
          {index === 0 && animate && tape.step > 0 && (
            <span className="tick-sparks" aria-hidden="true">
              {[[9,-6],[15,0],[8,7],[-6,-5],[-7,6]].map(([x,y], index) =>
                <i key={index} style={{"--spark-x":`${x}px`,"--spark-y":`${y}px`} as CSSProperties} />)}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
});
