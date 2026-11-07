import { useEffect, useRef } from "react";

export type LiquidReactorProps = {
  /** Decorative fill only; do not use this as a monetary progress indicator. */
  level?: number;
  pulse?: string | number;
  tone?: "acid" | "ice";
  className?: string;
};

/** A bounded liquid surface, not a fluid solver: two wave paths, 26 bubbles and
 * at most 18 droplets. Animation stays outside React and stops off screen. */
export function LiquidReactor({
  level = 0.42,
  pulse,
  tone = "acid",
  className = "",
}: LiquidReactorProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const current = useRef({ level, pulse, tone });
  current.current = { level, pulse, tone };

  useEffect(() => {
    const element = canvas.current;
    const ctx = element?.getContext("2d", { alpha: true });
    if (!element || !ctx) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 1, height = 1, raf = 0, last = 0, elapsed = 0;
    let visible = true, dead = false, burst = 0;
    let shownLevel = motion.matches ? current.current.level : 0.04;
    let previousPulse = current.current.pulse;
    let gradient: CanvasGradient;
    let gradientTone = "";
    let diagnosticFrames = 0, diagnosticCount = 0, diagnosticSum = 0, diagnosticMax = 0;
    let diagnosticAt = -Infinity, diagnosticStart = performance.now();
    const bubbles = Array.from({ length: 26 }, (_, i) => ({
      x: ((i * 71 + 13) % 101) / 101,
      phase: ((i * 37 + 19) % 97) / 97,
      size: 1.25 + (i % 5) * 0.64,
      speed: 0.055 + (i % 4) * 0.013,
    }));

    function makeGradient() {
      gradientTone = current.current.tone;
      gradient = ctx!.createLinearGradient(0, height * 0.27, 0, height);
      if (gradientTone === "ice") {
        gradient.addColorStop(0, "rgba(139,244,235,0.2)");
        gradient.addColorStop(0.56, "rgba(54,211,176,0.2)");
        gradient.addColorStop(1, "rgba(31,138,112,0.58)");
      } else {
        gradient.addColorStop(0, "rgba(235,255,108,0.40)");
        gradient.addColorStop(0.5, "rgba(171,229,42,0.28)");
        gradient.addColorStop(1, "rgba(127,185,20,0.58)");
      }
    }

    function surface(x: number, y: number, t: number, back = false) {
      const amplitude = motion.matches ? 1.5 : 3.3 + burst * 5;
      return y + Math.sin(x * 0.026 + t * (back ? -1.1 : 1.5)) * amplitude
        + Math.sin(x * 0.056 - t * 1.8) * amplitude * 0.37
        + Math.cos(x * 0.009 + t) * 2.7;
    }

    function draw(dt = 0) {
      if (dead) return;
      const diagnosticStarted = import.meta.env.DEV ? performance.now() : 0;
      const settings = current.current;
      if (gradientTone !== settings.tone) makeGradient();
      if (settings.pulse !== previousPulse) {
        previousPulse = settings.pulse;
        burst = motion.matches ? 0 : 1;
      }
      elapsed += dt;
      const target = Math.min(0.8, Math.max(0.06, settings.level));
      shownLevel = motion.matches ? target : shownLevel + (target - shownLevel) * Math.min(1, dt * 2.8);
      burst = Math.max(0, burst - dt * 0.5);
      const t = motion.matches ? 0 : elapsed;
      const y = height * (1 - shownLevel) - burst * 9;
      const color = settings.tone === "ice" ? "#9fffe6" : "#ddff6d";
      ctx!.clearRect(0, 0, width, height);

      // Rear and front surfaces keep the liquid dimensional without a filter.
      for (let layer = 0; layer < 2; layer++) {
        ctx!.beginPath();
        for (let x = 0; x <= width + 6; x += 6) {
          const sy = surface(x, y + (layer ? 0 : -5), t, !layer);
          if (x === 0) ctx!.moveTo(x, sy); else ctx!.lineTo(x, sy);
        }
        ctx!.lineTo(width, height);
        ctx!.lineTo(0, height);
        ctx!.closePath();
        ctx!.fillStyle = layer ? gradient : (settings.tone === "ice" ? "#4ac8af20" : "#c7fb5525");
        ctx!.fill();
      }

      // Bubbles have deterministic orbits, eliminating allocations and physics.
      for (const bubble of bubbles) {
        const progress = (bubble.phase + t * bubble.speed) % 1;
        const x = bubble.x * width + Math.sin(t * 1.3 + bubble.phase * 9) * 5;
        const top = surface(x, y, t);
        const by = height + 4 - progress * (height - top + 5);
        const r = bubble.size * (0.66 + progress * 0.34);
        ctx!.globalAlpha = 0.12 + progress * 0.51;
        ctx!.strokeStyle = color;
        ctx!.lineWidth = 0.8;
        ctx!.beginPath();
        ctx!.arc(x, by, r, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.fillStyle = color;
        ctx!.fillRect(x - r * 0.35, by - r * 0.6, 1, 1);
      }
      ctx!.globalAlpha = 1;
      // Thin luminous meniscus, foam and occasional droplets above the surface.
      ctx!.beginPath();
      for (let x = 0; x <= width + 6; x += 6) {
        const sy = surface(x, y, t);
        if (!x) ctx!.moveTo(x, sy); else ctx!.lineTo(x, sy);
      }
      ctx!.strokeStyle = color;
      ctx!.lineWidth = 1.3;
      ctx!.stroke();
      for (let i = 0; i < 18; i++) {
        const x = (((i * 53 + 11) % 101) / 101 * width + t * 5) % width;
        const phase = (t * 0.42 + i * 0.137) % 1;
        const jump = !motion.matches && (i % 3 === 0 || burst > 0) ? Math.sin(phase * Math.PI) * (5 + burst * 23) : 0;
        ctx!.globalAlpha = 0.23 + Math.sin(phase * Math.PI) * 0.48;
        ctx!.fillStyle = color;
        ctx!.beginPath();
        ctx!.arc(x, surface(x, y, t) - jump, 0.7 + (i % 3) * 0.45, 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      if (import.meta.env.DEV) {
        const now = performance.now();
        const cost = now - diagnosticStarted;
        diagnosticFrames++;
        diagnosticCount++;
        diagnosticSum += cost;
        diagnosticMax = Math.max(diagnosticMax, cost);
        if (now - diagnosticAt >= 1_000) {
          element!.dataset.fxFrames = String(diagnosticFrames);
          element!.dataset.fxAvgMs = (diagnosticSum / diagnosticCount).toFixed(3);
          element!.dataset.fxMaxMs = diagnosticMax.toFixed(3);
          element!.dataset.fxFps = (diagnosticCount * 1_000 / Math.max(1_000, now - diagnosticStart)).toFixed(1);
          diagnosticAt = diagnosticStart = now;
          diagnosticCount = diagnosticSum = diagnosticMax = 0;
        }
      }
    }

    function tick(now: number) {
      raf = 0;
      if (dead || !visible || document.hidden || motion.matches) return;
      if (now - last >= 1000 / 30) {
        const dt = last ? Math.min((now - last) / 1000, 0.08) : 1 / 30;
        last = now;
        draw(dt);
      }
      raf = requestAnimationFrame(tick);
    }
    function resume() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      draw();
      if (!dead && visible && !document.hidden && !motion.matches) raf = requestAnimationFrame(tick);
    }
    function resize() {
      const bounds = element!.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      element!.width = Math.round(width * ratio);
      element!.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      makeGradient();
      draw();
    }
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(element);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      resume();
    });
    intersection.observe(element);
    document.addEventListener("visibilitychange", resume);
    motion.addEventListener("change", resume);
    resize();
    resume();
    return () => {
      dead = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", resume);
      motion.removeEventListener("change", resume);
    };
  }, []);

  return <canvas ref={canvas} className={`liquid-reactor ${className}`} aria-hidden="true" style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none" }} />;
}
