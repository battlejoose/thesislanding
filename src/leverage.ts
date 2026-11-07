// A non-linear travel scale; contract leverage remains an integer from 1–1000.
export const LEVERAGE_NODES = [
  { at: 0, value: 1 },
  { at: 0.0625, value: 5 },
  { at: 0.125, value: 10 },
  { at: 0.25, value: 25 },
  { at: 0.5, value: 100 },
  { at: 0.75, value: 500 },
  { at: 1, value: 1000 },
] as const;

export function leveragePosition(value: number) {
  const leverage = Math.max(1, Math.min(1000, value));
  for (let i = 1; i < LEVERAGE_NODES.length; i++) {
    const lo = LEVERAGE_NODES[i - 1],
      hi = LEVERAGE_NODES[i];
    if (leverage <= hi.value)
      return (
        lo.at +
        ((leverage - lo.value) / (hi.value - lo.value)) * (hi.at - lo.at)
      );
  }
  return 1;
}

export function leverageAt(position: number) {
  const at = Math.max(0, Math.min(1, position));
  for (let i = 0; i < LEVERAGE_NODES.length; i++) {
    const node = LEVERAGE_NODES[i];
    const gap = Math.min(
      node.at - (LEVERAGE_NODES[i - 1]?.at ?? -1),
      (LEVERAGE_NODES[i + 1]?.at ?? 2) - node.at,
    );
    // Smaller magnets around the tightly spaced low-leverage nodes.
    if (Math.abs(at - node.at) <= Math.min(0.025, gap * 0.28))
      return node.value;
  }
  for (let i = 1; i < LEVERAGE_NODES.length; i++) {
    const lo = LEVERAGE_NODES[i - 1],
      hi = LEVERAGE_NODES[i];
    if (at <= hi.at)
      return Math.round(
        lo.value + ((at - lo.at) / (hi.at - lo.at)) * (hi.value - lo.value),
      );
  }
  return 1000;
}
