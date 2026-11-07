/** One server response order across HTTP reads and websocket frames, including
 * separate account updates whose Solana context slots happen to be equal. */
export function nextSnapshotTime(previous: number, now = Date.now()): number {
  return Math.max(now, previous + 1);
}

/** Do not seed this with the browser's locally-created empty snapshot: clocks
 * can differ and the first real server response must always be accepted. */
export class SnapshotOrder {
  private latest: number | undefined;

  accept(snapshot: { serverTime?: unknown }): boolean {
    const timestamp = snapshot.serverTime;
    // Legacy local fixtures can omit timestamps or initialize them to zero.
    // They cannot roll back a stream that has already supplied an ordered frame.
    if (timestamp === undefined || timestamp === null || timestamp === 0)
      return this.latest === undefined;
    if (
      typeof timestamp !== "number" ||
      !Number.isSafeInteger(timestamp) ||
      timestamp < 0 ||
      (this.latest !== undefined && timestamp <= this.latest)
    )
      return false;
    this.latest = timestamp;
    return true;
  }
}
