// Tracks the three independent WebGL subsystems the page waits on before it
// reveals itself. Each reports once, on success OR failure: a stage that
// cannot start must still settle, or the loading screen would never lift.
export type Stage = 'typography' | 'world' | 'gallery';
export const STAGES: readonly Stage[] = ['typography', 'world', 'gallery'];

export interface BootState { settled: readonly Stage[]; done: boolean; }
export const idle: BootState = { settled: [], done: false };

export function settle(state: BootState, stage: Stage): BootState {
  if (state.done || state.settled.includes(stage)) return state;
  const settled = [...state.settled, stage];
  return { settled, done: STAGES.every(s => settled.includes(s)) };
}

// Used by the watchdog and by browsers with no WebGL at all, where no stage
// will ever report. Boot is one-way: once lifted it never re-arms, so a later
// failure cannot drop a loading screen back over a page the reader is using.
export function finish(state: BootState): BootState {
  return state.done ? state : { settled: state.settled, done: true };
}

export function progress(state: BootState): number {
  return state.done ? 1 : state.settled.length / STAGES.length;
}

const captions: Record<Stage, string> = {
  typography: 'Setting the type',
  world: 'Raising the skyline',
  gallery: 'Framing the builds',
};

export function caption(state: BootState): string {
  if (state.done) return 'Ready';
  const next = STAGES.find(stage => !state.settled.includes(stage));
  return next ? captions[next] : 'Ready';
}
