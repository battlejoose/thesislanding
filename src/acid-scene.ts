/** The scene owns no DOM, wallet, network or trading state. The same renderer
 * runs in a dedicated worker, with a main-thread fallback for older browsers. */
import { DecorationCadence } from './decoration-cadence.ts';
export type SceneCanvas = HTMLCanvasElement | OffscreenCanvas;
export type SceneSize = { width: number; height: number; mainWidth: number };
export type SceneActivity = { visible: boolean; reducedMotion: boolean };
export type SceneStats = Record<string, string>;
export type SceneOptions = SceneSize & SceneActivity & {
  seed: number;
  makeCanvas: () => SceneCanvas;
  diagnostics?: (stats: SceneStats) => void;
};
const GLYPHS = ".,:;~=+*oO@/\\|^()-";
const PALETTE = ["#208d12", "#43cc0c", "#80ff00", "#b9ff32", "#eeffb4", "#b8c6c2", "#f3fff9", "#66dcca"];
const HORIZON = 0.875, MAX_BUBBLES = 15, MAX_SMOKE = MAX_BUBBLES;
const TILE = 24, TAU = Math.PI * 2;
const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const fract = (value: number) => value - Math.floor(value);
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
type Mark = { x: number; y: number; glyph: number; color: number; alpha: number };
type BubbleInk = { dome: Mark[]; crown: Mark[]; ring: Mark[]; radius: number; size: number };
type SeaInk = { image: SceneCanvas; depth: number; row: number };
type BubbleLife = { x: number; depth: number; tier: number; scale: number; born: number; duration: number; gap: number; sway: number; popped: boolean; generation: number };
type Smoke = { active: boolean; x: number; depth: number; radius: number; born: number; duration: number; wind: number; curl: number; lift: number; phase: number; pattern: number };
type PuffMark = { x: number; y: number; fade: number; glyph: number };

export function createAcidScene(canvas: SceneCanvas, options: SceneOptions) {
    const context = canvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!context) throw Error("Canvas 2D unavailable");
    const sceneSeed = options.seed;
    let visible = options.visible, reducedMotion = options.reducedMotion;
    const stats: SceneStats = {};
    let randomState = sceneSeed;
    const random = () => {
      randomState = (randomState + 0x6d2b79f5) | 0;
      let t = Math.imul(randomState ^ (randomState >>> 15), 1 | randomState);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
    };
    const waveA = random() * TAU, waveB = random() * TAU, waveC = random() * TAU;
    const waveSpeed = 0.28 + random() * 0.16, waveCrossSpeed = 0.5 + random() * 0.2;
    const atlas = options.makeCanvas();
    atlas.width = GLYPHS.length * TILE;
    atlas.height = PALETTE.length * TILE;
    const ink = (atlas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D);
    ink.font = "bold 21px ui-monospace, SFMono-Regular, Consolas, monospace";
    ink.textAlign = "center";
    ink.textBaseline = "middle";
    PALETTE.forEach((color, row) => {
      ink.fillStyle = color;
      for (let i = 0; i < GLYPHS.length; i++)
        ink.fillText(GLYPHS[i], i * TILE + TILE / 2, row * TILE + TILE / 2);
    });
    const stamp = (x: number, y: number, glyph: number, color: number, size: number, alpha = 1) => {
      if (alpha < 0.055 || x < -size || x > width + size || y < -size || y > height + size) return;
      context.globalAlpha = alpha;
      context.drawImage(atlas, glyph * TILE, color * TILE, TILE, TILE,
        x - size / 2, y - size / 2, size, size);
    };

    let width = 0, height = 0, mobile = false;
    let frame = 0, time = 4.6, costAverage = 0, reducedDetail = false;
    const cadence = new DecorationCadence(30);
    let cellX = 12, cellY = 15, glyphSize = 19, cols = 0, seaRows = 0;
    let fade = new Float32Array(0), bubbles: BubbleInk[] = [], seaInk: SeaInk[] = [];
    const lives: BubbleLife[] = Array.from({ length: MAX_BUBBLES }, () => ({
      x: 0, depth: 0, tier: 0, scale: 1, born: 0, duration: 1, gap: 0, sway: 0, popped: false, generation: 0,
    }));
    const smoke: Smoke[] = Array.from({ length: MAX_SMOKE }, () => ({
      active: false, x: 0, depth: 0, radius: 0, born: 0, duration: 0, wind: 0, curl: 0, lift: 0, phase: 0, pattern: 0,
    }));
    const puffMarks: PuffMark[] = Array.from({ length: 28 }, (_, i) => {
      const radius = Math.sqrt((i + 0.5) / 28), angle = i * 2.399963;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius,
        fade: 1 - radius * 0.48, glyph: i % 4 === 0 ? 7 : i % 3 === 0 ? 6 : 3 };
    });
    let liveCount = 0, smokeCap = MAX_SMOKE, popCount = 0, activeSmoke = 0, generations = 0, cachePixels = 0;
    let diagnosticFrames = 0, diagnosticCount = 0, diagnosticSum = 0, diagnosticMax = 0;
    let diagnosticAt = -Infinity, diagnosticStart = performance.now();

    const makeBubble = (radius: number): BubbleInk => {
      const dome: Mark[] = [], crown: Mark[] = [], ring: Mark[] = [];
      const size = mobile ? 17 : 19;
      const dx = size * 0.59, dy = size * 0.76;
      // Loose interior punctuation and a bright O/@ edge describe a hollow dome.
      // No pixels, backing plane, filled paths or masked opaque silhouettes.
      for (let py = -radius * 0.86; py < 0; py += dy) {
        for (let px = -radius; px <= radius; px += dx) {
          const nx = px / radius, ny = py / (radius * 0.88);
          const distance = nx * nx + ny * ny;
          if (distance > 0.91) continue;
          const glint = (nx + 0.38) ** 2 + (ny + 0.4) ** 2 < 0.07;
          const shade = clamp(0.64 - nx * 0.23 - ny * 0.24);
          dome.push({ x: px, y: py, glyph: glint ? 10 : shade > 0.7 ? 6 : 2,
            color: glint ? 4 : shade > 0.65 ? 2 : 1,
            alpha: glint ? 1 : 0.48 + shade * 0.24 });
        }
      }
      // Sample the rounded upper contour directly, avoiding a flat cropped grid rim.
      const arcCount = Math.max(7, Math.ceil(Math.PI * radius / dx));
      for (let p = 0; p <= arcCount; p++) {
        const angle = p / arcCount * Math.PI, side = Math.cos(angle);
        dome.push({ x: side * radius, y: -Math.sin(angle) * radius * 0.88,
          glyph: Math.abs(side) < 0.5 ? 9 : side > 0.84 ? 16 : side < -0.84 ? 15 : side > 0 ? 12 : 11,
          color: side < 0.1 ? 3 : 2, alpha: 1 });
      }
      const count = Math.max(10, Math.ceil(radius * TAU / dx));
      for (let p = 0; p < count; p++) {
        const angle = p / count * TAU;
        const px = Math.cos(angle) * radius, py = Math.sin(angle) * radius * 0.25;
        ring.push({ x: px, y: py, glyph: Math.abs(Math.cos(angle)) > 0.87 ? Math.cos(angle) > 0 ? 16 : 15 : 4,
          color: 2, alpha: 0.87 });
        const spike = radius * (p % 4 === 0 ? 0.83 : p % 3 === 0 ? 0.44 : 0.13);
        const segments = Math.max(1, Math.ceil(spike / dy));
        for (let s = 0; s <= segments; s++) {
          const rise = s / segments;
          crown.push({ x: px + Math.cos(angle) * spike * rise * 0.26, y: py - spike * rise,
            glyph: s === segments ? 14 : p % 2 ? 11 : 12,
            color: rise > 0.6 ? 3 : 2, alpha: 1 });
        }
      }
      return { dome, crown, ring, radius, size };
    };

    const makeSea = () => {
      // Native-size rows cache the exact glyphs once. Runtime moves their
      // coordinates only: source and destination sizes always match 1:1.
      seaInk = [];
      const padding = 48;
      for (let row = 0; row < seaRows; row++) {
        const depth = row / Math.max(1, seaRows - 1);
        const image = options.makeCanvas();
        image.width = width + padding * 2;
        image.height = glyphSize + 4;
        const ctx = (image.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D);
        const rowPhase = depth * 13.2 + waveA;
        const sweep = Math.sin(depth * 5.5 + waveB) * 1.65;
        for (let col = -5; col < cols + 5; col++) {
          const x = (col + 0.5) * cellX, nx = x / width;
          const primary = Math.sin(nx * 15.5 + rowPhase + sweep);
          const crossed = Math.sin(nx * 7.1 - depth * 15.2 + waveB);
          const detail = Math.sin(nx * 28 + depth * 8.8 + waveC);
          const density = clamp(0.49 + primary * 0.25 + crossed * 0.18 + detail * 0.065);
          const pattern = ((col * 7 + row * 3) % 9 + 9) % 9;
          const glyph = density > 0.82 ? 8 : density > 0.64 ? 7 : density > 0.45 ? 6
            : density > 0.29 ? pattern < 4 ? 4 : 5 : pattern < 5 ? 2 : 0;
          const color = density > 0.79 ? 3 : density > 0.48 ? 2 : density > 0.27 ? 1 : 0;
          ctx.globalAlpha = (0.55 + density * 0.45) * fade[clamp(col, 0, cols - 1)];
          ctx.drawImage(atlas, glyph * TILE, color * TILE, TILE, TILE,
            padding + x - glyphSize / 2, 2, glyphSize, glyphSize);
        }
        seaInk.push({ image, row, depth });
      }
    };

    const renewBubble = (life: BubbleLife, index: number, initial: boolean) => {
      // All randomness is sampled at birth, never while drawing a frame.
      life.tier = index % bubbles.length;
      life.x = 0.06 + random() * 0.88;
      life.depth = 0.1 + random() * 0.75;
      life.scale = 0.76 + random() * 0.32;
      life.duration = 6.4 + random() * 5.4;
      life.gap = 0.35 + random() * 1.1;
      life.sway = random() * TAU;
      life.popped = false;
      life.generation = ++generations;
      const phase = initial ? reducedMotion && index % 4 === 0 ? 0.84 : random() * 0.66 : 0;
      life.born = time - phase * life.duration;
    };
    const emitSmoke = (slot: number, x: number, depth: number, radius: number, born: number, maxDuration: number) => {
      // Each bubble owns a slot. Its cloud fades before that bubble can pop
      // again, so an unrelated burst never truncates or teleports a tendril.
      const event = smoke[slot];
      event.active = true;
      event.x = x / width;
      event.depth = depth;
      event.radius = radius;
      event.born = born;
      event.duration = Math.min(6.2 + random() * 2.2, maxDuration);
      event.wind = (random() - 0.5) * 0.27;
      event.curl = 0.018 + random() * 0.013;
      event.lift = 20 + random() * 9;
      event.phase = random() * TAU;
      event.pattern = Math.floor(random() * 7);
      popCount++;
    };
    const paintMarks = (item: BubbleInk, marks: Mark[], x: number, y: number, sx: number, sy: number, alpha: number, sizeScale: number) => {
      if (alpha < 0.06) return;
      for (const mark of marks)
        stamp(x + mark.x * sx, y + mark.y * sy, mark.glyph, mark.color,
          item.size * sizeScale, alpha * mark.alpha);
    };
    const drawSmoke = (horizon: number, seaDepth: number) => {
      activeSmoke = 0;
      for (let i = 0; i < smokeCap; i++) {
        const event = smoke[i];
        if (!event.active) continue;
        const age = time - event.born;
        if (age >= event.duration) { event.active = false; continue; }
        if (age < 0) continue;
        activeSmoke++;
        const x = event.x * width, y = horizon + event.depth * seaDepth;
        const radius = Math.min(event.radius, mobile ? 68 : 90);
        const glyph = mobile ? 15 : 17;
        // A single local cloud blossoms from this pop before releasing strands.
        const puffAge = age / 1.9;
        if (puffAge < 1) {
          const envelope = smooth(age * 6) * (1 - smooth(puffAge));
          const expansion = 0.24 + smooth(puffAge) * 0.88;
          for (let p = 0; p < puffMarks.length; p++) {
            const mark = puffMarks[p];
            const px = x + mark.x * (12 + radius * expansion) + event.wind * age * 8;
            const py = y - age * 17 - radius * 0.12 + mark.y * (8 + radius * expansion * 0.48);
            stamp(px, py, mark.glyph, p % 8 === event.pattern ? 7 : p % 11 === 0 ? 2 : p % 3 === 0 ? 5 : 6,
              glyph, envelope * mark.fade * 0.93);
          }
        }
        // Two coherent, branching ribbons share a rising spine. Their feet
        // remain at the emission until the puff ends; no independent snow drift.
        const head = Math.min(height * 0.38, age * event.lift + smooth(age) * (12 + radius * 0.35));
        const tail = Math.max(0, (age - 2.6) * event.lift * 0.8);
        const extent = head - tail;
        const lifeFade = smooth(age * 2.8) * smooth((event.duration - age) / 1.8);
        const segments = Math.min(reducedDetail ? 12 : 18, Math.max(4, Math.ceil(extent / 10)));
        for (let strand = 0; strand < 2; strand++) {
          for (let point = 0; point <= segments; point++) {
            const u = point / segments;
            const rise = tail + extent * u;
            const branching = strand ? smooth((u - 0.16) * 2.6) : 0;
            const curl = Math.sin(rise * event.curl - age * 0.34 + event.phase);
            const bend = Math.sin(rise * event.curl * 0.51 + event.phase) * rise * 0.055;
            const px = x + event.wind * rise + bend + curl * (4 + rise * 0.065)
              + branching * Math.sin(rise * event.curl * 1.25 + event.phase + 1.2) * (9 + rise * 0.05);
            const py = y - rise;
            const envelope = Math.pow(Math.sin(u * Math.PI), 0.45) * lifeFade;
            const mark = (point + event.pattern) % 5 === 0 ? 4 : point % 3 === 0 ? 6 : 3;
            stamp(px, py, mark, strand ? 5 : 6, glyph, envelope * (strand ? 0.64 : 0.86));
            if (strand === 0)
              stamp(px + 4.5, py + glyph * 0.12, point % 3 === 0 ? 6 : 3,
                5, glyph, envelope * 0.4);
            if (point % 2 === 0)
              stamp(px + (strand ? 1 : -1) * (5 + Math.sin(rise * 0.03) * 3), py + 2,
                point % 3 === 0 ? 1 : 2, point % 7 === event.pattern ? 1 : 7,
                glyph * 0.95, envelope * 0.55);
          }
        }
      }
    };

    const draw = () => {
      const started = performance.now();
      context.clearRect(0, 0, width, height);
      const horizon = height * HORIZON, seaDepth = height - horizon;
      // Dense readable interference bands sway as cached native-aspect rows.
      // This replaces thousands of individual per-frame atlas submissions.
      for (const row of seaInk) {
        const current = Math.sin(time * waveSpeed + row.depth * 3.9 + waveA) * 24
          + Math.sin(time * waveCrossSpeed - row.depth * 7.4 + waveB) * 8;
        const bob = Math.sin(time * waveCrossSpeed + row.depth * 9.2 + waveC) * (0.25 + row.depth * 1.15);
        context.globalAlpha = 0.92 + Math.sin(time * 0.43 - row.depth * 6.8) * 0.08;
        context.drawImage(row.image, 48 + current, 0, width, row.image.height,
          0, horizon + row.row * cellY + bob, width, row.image.height);
      }
      // A fixed pool of lifecycles renews locations/size/timing after each pop.
      for (let i = 0; i < liveCount; i++) {
        const life = lives[i];
        if (time >= life.born + life.duration + life.gap) renewBubble(life, i, false);
        const phase = (time - life.born) / life.duration;
        if (phase < 0 || phase >= 1) continue;
        const item = bubbles[life.tier];
        const x = life.x * width + Math.sin(time * 0.27 + life.sway) * 2.5;
        const y = horizon + life.depth * seaDepth;
        const scale = life.scale;
        const growth = Math.sin(clamp(phase / 0.68) * Math.PI / 2);
        const burst = clamp((phase - 0.68) / 0.32);
        if (!life.popped && phase >= 0.68) {
          life.popped = true;
          const popTime = life.born + life.duration * 0.68;
          const popX = life.x * width + Math.sin(popTime * 0.27 + life.sway) * 2.5;
          const earliestNextPop = life.duration * 0.32 + life.gap + 6.4 * 0.68;
          emitSmoke(i, popX, life.depth, item.radius * scale, popTime, earliestNextPop - 0.2);
        }
        const ripple = scale * (0.43 + growth * 0.62 + burst * 0.82);
        paintMarks(item, item.ring, x, y, ripple, ripple,
          0.78 * (1 - burst) * smooth(phase * 9), 0.9);
        if (burst < 0.1) {
          const domeScale = scale * (0.14 + growth * 0.86);
          paintMarks(item, item.dome, x, y, domeScale * (1 + burst * 1.7), domeScale * (1 - burst * 8),
            smooth(phase * 7) * (1 - smooth(burst * 10)), Math.max(0.5, domeScale));
        }
        if (burst > 0) {
          const splash = Math.sin(Math.PI * burst);
          paintMarks(item, item.crown, x, y, scale * (1 + burst * 0.2), scale * (0.12 + splash * 0.9),
            smooth(burst * 12) * smooth((1 - burst) * 2.8), scale);
          const radius = item.radius * scale;
          const dropCount = radius < 18 ? 3 : reducedDetail ? 4 : 7;
          for (let p = 0; p < dropCount; p++) {
            const angle = p / dropCount * TAU + life.sway;
            const travel = radius * (0.6 + burst * (0.6 + fract(p * 0.381) * 0.7));
            const px = x + Math.cos(angle) * travel;
            const py = y + Math.sin(angle) * radius * 0.23
              - radius * (Math.sin(burst * Math.PI) * (0.7 + fract(p * 0.713) * 0.8));
            stamp(px, py, p % 3 === 0 ? 8 : 7, p % 3 === 0 ? 4 : 3, mobile ? 15 : 17,
              smooth(burst * 16) * (1 - smooth(burst)));
          }
        }
      }
      drawSmoke(horizon, seaDepth);
      context.globalAlpha = 1;
      const cost = performance.now() - started;
      costAverage = costAverage * 0.96 + cost * 0.04;
      if (costAverage > 7) reducedDetail = true;
      else if (costAverage < 3) reducedDetail = false;
      if (options.diagnostics) {
        const now = performance.now();
        diagnosticFrames++; diagnosticCount++; diagnosticSum += cost;
        diagnosticMax = Math.max(diagnosticMax, cost);
        if (now - diagnosticAt >= 1_000) {
          stats.fxFrames = String(diagnosticFrames);
          stats.fxAvgMs = (diagnosticSum / diagnosticCount).toFixed(3);
          stats.fxMaxMs = diagnosticMax.toFixed(3);
          stats.fxFps = (diagnosticCount * 1_000 / Math.max(1_000, now - diagnosticStart)).toFixed(1);
          stats.fxGlyphCells = String(cols * seaRows);
          stats.fxCacheMb = (cachePixels * 4 / 1_048_576).toFixed(2);
          stats.fxHorizonRatio = String(HORIZON);
          stats.fxActiveSmoke = String(activeSmoke);
          stats.fxSmokeCap = String(smokeCap);
          stats.fxPopCount = String(popCount);
          stats.fxBubbleGenerations = String(generations);
          stats.fxActiveBubbles = String(liveCount);
          stats.fxSeed = sceneSeed.toString(16).padStart(8, "0");
          stats.fxQuality = reducedDetail ? "balanced" : "full";
          options.diagnostics(stats);
          diagnosticAt = diagnosticStart = now;
          diagnosticCount = diagnosticSum = diagnosticMax = 0;
        }
      }
    };

    const resize = (rect: SceneSize) => {
      const cacheStarted = performance.now();
      const scale = Math.min(1, 1_440 / Math.max(1, rect.width), 1_000 / Math.max(1, rect.height));
      const nextWidth = Math.max(1, Math.round(rect.width * scale)), nextHeight = Math.max(1, Math.round(rect.height * scale));
      if (width === nextWidth && height === nextHeight) return;
      width = nextWidth; height = nextHeight;
      canvas.width = width; canvas.height = height;
      context.imageSmoothingEnabled = true;
      const nextMobile = rect.width < 760;
      const rebuildBubbles = bubbles.length === 0 || nextMobile !== mobile;
      mobile = nextMobile;
      cellX = mobile ? 10.5 : 12;
      cellY = mobile ? 14 : 15.5;
      glyphSize = mobile ? 18 : 20;
      cols = Math.ceil(width / cellX);
      seaRows = Math.ceil(height * (1 - HORIZON) / cellY) + 1;
      fade = new Float32Array(cols);
      const mainWidth = rect.mainWidth * scale;
      for (let col = 0; col < cols; col++) {
        const edge = Math.abs((col + 0.5) * cellX - width / 2) - mainWidth / 2;
        fade[col] = mobile ? 0.83 : 0.66 + clamp((edge + 20) / 70) * 0.34;
      }
      makeSea();
      if (rebuildBubbles) bubbles = Array.from({ length: 5 }, (_, band) => {
        const depth = (band + 0.42) / 5;
        return makeBubble(8 + depth * depth * (mobile ? 70 : 103));
      });
      const nextCount = mobile ? 10 : MAX_BUBBLES;
      smokeCap = nextCount;
      for (let i = smokeCap; i < MAX_SMOKE; i++) smoke[i].active = false;
      for (let i = liveCount; i < nextCount; i++) renewBubble(lives[i], i, true);
      liveCount = nextCount;
      cachePixels = atlas.width * atlas.height;
      for (const row of seaInk) cachePixels += row.image.width * row.image.height;
      costAverage = 0; reducedDetail = false;
      if (options.diagnostics) stats.fxCacheBuildMs = (performance.now() - cacheStarted).toFixed(2);
      draw();
    };
    const tick = (now: number) => {
      frame = 0;
      if (!visible || reducedMotion) return;
      const elapsed = cadence.advance(now);
      if (elapsed !== null) { time += elapsed; draw(); }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      cancelAnimationFrame(frame); frame = 0; cadence.reset(performance.now());
      if (visible && !reducedMotion) frame = requestAnimationFrame(tick);
      else if (reducedMotion) draw();
    };
    resize(options); resume();
    return {
      resize,
      activity(next: SceneActivity) {
        visible = next.visible; reducedMotion = next.reducedMotion; resume();
      },
      dispose() { cancelAnimationFrame(frame); frame = 0; },
    };
}
