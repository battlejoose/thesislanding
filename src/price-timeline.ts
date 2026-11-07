import type { Row } from "./client.ts";

export const SIMPLE_CHART_SECONDS = 30;
export const SIMPLE_CHART_WIDTH = 300;
export const SIMPLE_CHART_INSET = 6;
type Point = { time: number; value: number };

/** Display-only time axis. Untimed ring entries are never assigned guessed dates. */
export function priceTimeline(feed?: Row) {
  const end = Number(feed?.publishTime);
  if (!Number.isSafeInteger(end) || end <= 0 || !Number.isFinite(Number(feed?.price)) || Number(feed?.price) <= 0) return null;
  const start = end - SIMPLE_CHART_SECONDS;
  const history = (feed?.displayObservations ?? feed?.observations ?? []) as { price: string; publishTime?: number }[];
  const points: Point[] = history.map(row => ({ time: Number(row.publishTime), value: Number(row.price) / 1e12 }))
    .filter(row => Number.isSafeInteger(row.time) && row.time >= start - 3 && row.time <= end && Number.isFinite(row.value) && row.value > 0)
    .sort((a, b) => a.time - b.time);
  const latest = { time: end, value: Number(feed!.price) / 1e12 };
  if (points.at(-1)?.time !== end || points.at(-1)?.value !== latest.value) points.push(latest);
  const low = Math.min(...points.map(point => point.value)), high = Math.max(...points.map(point => point.value));
  const y = (value: number) => high > low ? 21 - (value - low) / (high - low) * 18 : 12;
  // Keep the newest vertical segment and its live marker inside the viewport.
  // Source timestamps have second precision; several real updates can share x.
  const x = (time: number) => SIMPLE_CHART_INSET + (time - start) / SIMPLE_CHART_SECONDS * (SIMPLE_CHART_WIDTH - SIMPLE_CHART_INSET * 2);
  const path = points.map((point, index) =>
    `${index && point.time - points[index - 1].time <= 3 ? "L" : "M"}${x(point.time).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");
  const ticks: { time: number; left: number }[] = [];
  for (let time = Math.floor(start / 5) * 5; time <= end + 5; time += 5) ticks.push({ time, left: x(time) / SIMPLE_CHART_WIDTH * 100 });
  return { start, end, path, lastX: x(end), lastY: y(latest.value), trend: latest.value - points[0].value, ticks };
}

export function timelineLabel(time: number) {
  const date = new Date(time * 1000);
  return `${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
}
