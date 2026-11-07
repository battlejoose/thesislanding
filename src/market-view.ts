import type { Row } from "./client.ts";

export function formatMarketValue(value: number | null, marketCap = false) {
  if (value === null) return "—";
  return (
    "$" +
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: marketCap ? 0 : 2,
      maximumFractionDigits: marketCap ? 0 : value >= 1 ? 2 : 8,
    }).format(value)
  );
}

export function formatLiveMarketValue(value: number | null, marketCap = false) {
  if (marketCap) return formatMarketValue(value, true);
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  const digits = Math.max(2, Math.min(8, 8 - Math.floor(Math.log10(value))));
  return "$" + new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(value);
}

export function observationTape(feed?: Row) {
  if (!feed) return [];
  const end = BigInt(feed.displaySequence ?? feed.sequence);
  // The on-chain ring wraps in place. Never chart its physical account order.
  const points = ((feed.displayObservations ?? feed.observations) as { sequence: string; price: string }[])
    .filter(
      (p) =>
        BigInt(p.sequence) > 0n &&
        BigInt(p.sequence) <= end &&
        BigInt(p.price) > 0n,
    )
    .slice()
    .sort((a, b) => (BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1))
    .map((p) => ({ key: p.sequence, value: Number(p.price) / 1e12 }));
  // Chart history coalesces equal prices within a source second. The tape also
  // shows the latest delivered quote, so each fresh slot can visibly tick zero.
  // This uses the received sequence, never a timer that invents observations.
  if (feed.displaySequence && end > 0n && (!points.length || end > BigInt(points.at(-1)!.key)) && BigInt(feed.price) > 0n)
    points.push({key:String(end),value:Number(feed.price)/1e12});
  return points;
}

export function priceChanges(points: ReturnType<typeof observationTape>) {
  const changes: { key: string; fraction: number }[] = [];
  let newer: (typeof points)[number] | undefined;
  for (let i = points.length - 1; i >= 0 && changes.length < 6; i--) {
    const p = points[i];
    if (newer)
      changes.push({ key: newer.key, fraction: newer.value / p.value - 1 });
    newer = p;
  }
  return changes;
}

export function marketCapUsd(feed?: Row): number | null {
  if (!feed?.sourceSupply || !Number.isInteger(feed.sourceDecimals))
    return null;
  const value =
    Number(BigInt(feed.price) * BigInt(feed.sourceSupply)) /
    10 ** (12 + feed.sourceDecimals);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function sparkPath(points: ReturnType<typeof observationTape>) {
  if (points.length < 2) return "";
  const min = Math.min(...points.map((p) => p.value));
  const max = Math.max(...points.map((p) => p.value));
  return points
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${(2 + (i / (points.length - 1)) * 116).toFixed(1)},${(max > min ? 22 - ((p.value - min) / (max - min)) * 20 : 12).toFixed(1)}`,
    )
    .join(" ");
}

export function formatChange(fraction: number) {
  const magnitude = Math.abs(fraction * 100);
  if (!Number.isFinite(magnitude)) return "—";
  if (magnitude === 0) return "0.00%";
  // ER observations can be far smaller than one basis point. Keep two
  // significant digits for tiny moves, with a bounded width for the tape.
  const decimals = Math.min(5, Math.max(2, 1 - Math.floor(Math.log10(magnitude))));
  return `${fraction > 0 ? "+" : "−"}${magnitude < 0.00001 ? "<0.00001" : magnitude.toFixed(decimals)}%`;
}
