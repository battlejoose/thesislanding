import type { Snapshot } from './client.ts';

/** Display time follows the server timestamp plus monotonic elapsed time.
 * A user's wall clock must not invalidate a newly published quote. Record on
 * receipt, before visibility buffering, so hidden/disconnected tabs still age.
 * This clock is never used to authorize a transaction or value collateral. */
export class DisplayClock {
  private received = new WeakMap<Snapshot, number>();
  private latest?: Snapshot;
  receive(snapshot: Snapshot, elapsed = performance.now()) {
    if (!this.received.has(snapshot)) this.received.set(snapshot, elapsed);
    this.latest = snapshot;
  }
  now(snapshot = this.latest, elapsed = performance.now()): number {
    const received = snapshot && this.received.get(snapshot);
    if (!snapshot || received === undefined || !Number.isFinite(snapshot.serverTime) || snapshot.serverTime <= 0) return Infinity;
    return snapshot.serverTime + Math.max(0, elapsed - received);
  }
}
