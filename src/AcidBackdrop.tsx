import { sdiceSkin, thesisSkin } from "./app-url.ts";
import { memo, useEffect, useRef } from "react";
import type { createAcidScene, SceneSize } from "./acid-scene.ts";
import type { SceneMessage } from "./acid-scene.worker.ts";
import "./acid-backdrop.css";

/** Only viewport/lifecycle messages cross to the animation worker, never trading data. */
export const AcidBackdrop = memo(function AcidBackdrop() {
  if (thesisSkin) return <div className="thesis-wall" aria-hidden="true"><span className="thesis-wall-grid"/></div>;
  return sdiceSkin ? <div className="sdice-street-wall" aria-hidden="true"><span>SDICE</span><i>↑</i><b>↓</b></div> : <AnimatedAcidBackdrop />;
});
const AnimatedAcidBackdrop = memo(function AnimatedAcidBackdrop() {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false, visible = true, fallingBack = false;
    let worker: Worker | undefined, scene: ReturnType<typeof createAcidScene> | undefined;
    let startup: ReturnType<typeof setTimeout> | undefined;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    // A fresh canvas per effect also supports StrictMode's setup/cleanup replay:
    // transferControlToOffscreen can only be called once per element.
    const attachCanvas = () => {
      const next = document.createElement("canvas");
      next.className = "acid-ascii-field";
      host.replaceChildren(next);
      return next;
    };
    let canvas = attachCanvas();
    const size = (): SceneSize => {
      const rect = host.getBoundingClientRect();
      return { width: rect.width, height: rect.height,
        mainWidth: host.closest("main")?.getBoundingClientRect().width ?? 600 };
    };
    const activity = () => ({ visible: visible && !document.hidden, reducedMotion: motion.matches });
    const send = (message: SceneMessage) => worker?.postMessage(message);
    const fallback = async () => {
      if (disposed || fallingBack) return;
      fallingBack = true;
      clearTimeout(startup);
      worker?.terminate(); worker = undefined;
      // A transferred canvas cannot be reused on the main thread.
      canvas = attachCanvas();
      try {
        const { createAcidScene } = await import("./acid-scene.ts");
        if (disposed) return;
        scene = createAcidScene(canvas, {
          ...size(), ...activity(), seed, makeCanvas: () => document.createElement("canvas"),
          diagnostics: import.meta.env.DEV ? stats => Object.assign(canvas.dataset, stats) : undefined,
        });
        canvas.dataset.fxRenderer = "main";
      } catch { /* A browser without Canvas 2D retains the black backdrop. */ }
    };
    const resize = () => {
      const next = size();
      scene?.resize(next); send({ type: "resize", size: next });
    };
    const resume = () => {
      const next = activity();
      scene?.activity(next); send({ type: "activity", activity: next });
    };
    try {
      if (!canvas.transferControlToOffscreen || typeof Worker === "undefined") throw Error("Worker canvas unavailable");
      worker = new Worker(new URL("./acid-scene.worker.ts", import.meta.url), { type: "module" });
      worker.onerror = event => { event.preventDefault(); void fallback(); };
      worker.onmessage = ({ data }) => {
        if (disposed) return;
        if (data.type === "ready") { clearTimeout(startup); canvas.dataset.fxRenderer = "worker"; }
        else if (data.type === "failed") void fallback();
        else if (import.meta.env.DEV && data.type === "stats") Object.assign(canvas.dataset, data.stats);
      };
      const offscreen = canvas.transferControlToOffscreen();
      worker.postMessage({ type: "init", canvas: offscreen, seed, size: size(), activity: activity() } satisfies SceneMessage, [offscreen]);
      startup = setTimeout(() => void fallback(), 5000);
    } catch { void fallback(); }
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; resume(); });
    intersection.observe(host);
    document.addEventListener("visibilitychange", resume);
    motion.addEventListener("change", resume);
    return () => {
      disposed = true; clearTimeout(startup); worker?.terminate(); scene?.dispose();
      observer.disconnect(); intersection.disconnect();
      document.removeEventListener("visibilitychange", resume);
      motion.removeEventListener("change", resume);
      host.replaceChildren();
    };
  }, []);
  return <div ref={hostRef} className="acid-backdrop" aria-hidden="true" />;
});
