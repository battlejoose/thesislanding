import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./wallet-effects.css";

const sparks = [
  [12, 28, -9, -12, -35], [32, 10, -5, -14, -15],
  [68, 10, 6, -14, 20], [88, 28, 10, -10, 45],
  [88, 72, 9, 12, 135], [68, 90, 5, 14, 160],
  [32, 90, -6, 14, 195], [12, 72, -10, 10, 225],
];

/** Pointer tracking is separate from hit testing: the toast never intercepts
 * the click, even during its normal-opacity entrance animation. */
export function ActivityToastStack({ side, entries }: {
  side: "left" | "right"; entries: { id: string; content: ReactNode }[];
}) {
  const root = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<CSSProperties>({ visibility: "hidden" });
  useLayoutEffect(() => {
    const column = document.querySelector("main");
    if (!column) return;
    const place = () => {
      const bounds = column.getBoundingClientRect();
      const padding = parseFloat(getComputedStyle(column).paddingTop) || 12;
      setPlacement({
        visibility: "visible", top: Math.max(8, padding),
        left: side === "left" ? bounds.left : undefined,
        right: side === "right" ? document.documentElement.clientWidth - bounds.right : undefined,
        width: Math.max(0, bounds.width / 2 - 6),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(column);
    window.addEventListener("resize", place);
    return () => { observer.disconnect(); window.removeEventListener("resize", place); };
  }, [side]);
  useEffect(() => {
    let frame = 0;
    let pointer: { x: number; y: number } | undefined;
    const update = () => {
      frame = 0;
      for (const node of root.current?.children ?? []) {
        const box = node.getBoundingClientRect();
        node.classList.toggle("is-hovered", !!pointer && pointer.x >= box.left && pointer.x <= box.right && pointer.y >= box.top && pointer.y <= box.bottom);
      }
    };
    const move = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(update);
    };
    const leave = () => { pointer = undefined; update(); };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);
  return createPortal(<div ref={root} className={`wallet-change-stack toast-stack-${side}`} style={placement}>
    {entries.map((entry, index) => <div className="wallet-change-toast" key={entry.id}
      role="status" style={{ transform: `translateY(${index * (side === "left" ? 42 : 34)}px)` }}>
      <span className="toast-arrival-fx" aria-hidden="true">
        <span className="toast-arrival-flash" />
        {sparks.map(([x, y, dx, dy, angle], i) => <i className="toast-arrival-spark" key={i}
          style={{ left: `${x}%`, top: `${y}%`, "--spark-x": `${dx}px`, "--spark-y": `${dy}px`,
            "--spark-angle": `${angle}deg`, animationDelay: `${i % 3 * 25}ms` } as CSSProperties} />)}
      </span>
      {entry.content}
    </div>)}
  </div>, document.body);
}
