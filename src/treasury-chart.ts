import type { PoolHistoryPoint } from './client.ts';

/** Solid paths contain recorded quotes only. Dashed connectors are visual guides
 * across missing quotes; they never fill, replace or extrapolate observations. */
export function treasuryChart(points: PoolHistoryPoint[]) {
  const sorted = [...new Map(points.filter(p => Number.isFinite(p.at) && p.at > 0)
    .map(p => [p.at, p])).values()].sort((a, b) => a.at - b.at);
  const valid = (p: PoolHistoryPoint): p is { at: number; value: number } =>
    p.value !== null && Number.isFinite(p.value) && p.value >= 0;
  const values = sorted.filter(valid);
  if (!values.length) return null;
  const first = sorted[0].at, last = sorted[sorted.length - 1].at;
  const peak = Math.max(...values.map(p => p.value));
  const magnitude = peak > 0 ? 10 ** Math.floor(Math.log10(peak)) : 1;
  const ceiling = peak > 0 ? ([1, 2, 2.5, 5, 10].find(n => n * magnitude >= peak) ?? 10) * magnitude : 1;
  const x = (at: number) => first === last ? 500 : (at - first) / (last - first) * 1000;
  const y = (value: number) => 18 + (1 - value / ceiling) * 262;
  const coordinate = (p: {at: number; value: number}) => `${x(p.at).toFixed(3)},${y(p.value).toFixed(3)}`;
  const paths: Array<{line: string; area: string}> = [];
  const interruptions: Array<{line: string; from: number; to: number}> = [];
  const isolated: Array<{x: number; y: number; at: number; value: number}> = [];
  let segment: Array<{at: number; value: number}> = [];
  let previous: {at: number; value: number} | undefined;
  let missing = false;
  const finish = () => {
    if (segment.length > 1) {
      const line = segment.map((p, i) => `${i ? 'L' : 'M'}${coordinate(p)}`).join(' ');
      paths.push({line, area: `${line} L${x(segment.at(-1)!.at).toFixed(3)},300 L${x(segment[0].at).toFixed(3)},300 Z`});
    } else if (segment.length) {
      const p = segment[0];
      isolated.push({...p, x: x(p.at) / 10, y: y(p.value) / 3});
    }
    segment = [];
  };
  for (const point of sorted) {
    if (!valid(point)) { finish(); missing = true; continue; }
    if (missing && previous) interruptions.push({line: `M${coordinate(previous)} L${coordinate(point)}`, from: previous.at, to: point.at});
    segment.push(point);
    previous = point;
    missing = false;
  }
  finish();
  const latest = values[values.length - 1];
  return {first, last, paths, interruptions, isolated, latest,
    ticks: [ceiling, ceiling / 2, 0].map(value => ({value, y: y(value) / 3})),
    latestX: x(latest.at) / 10, latestY: y(latest.value) / 3,
    count: values.length, gaps: values.length !== sorted.length,
    single: first === last, hasCurrent: latest.at === last};
}
