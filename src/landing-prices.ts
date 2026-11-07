import type { Row, Snapshot } from './client.ts';
import { DisplayClock } from './display-clock.ts';
import { receiveLivePrices, receiveSnapshotPrices, type LivePriceBook } from './live-market-prices.ts';

/** Read-only landing display, using the same clock and observation rules as trading. */
export class LandingPrices {
  private clock = new DisplayClock();
  private book: LivePriceBook = {};
  constructor(private elapsed = () => performance.now()) {}

  snapshot(snapshot: Snapshot) {
    if (!Number.isFinite(snapshot.serverTime) || snapshot.serverTime <= 0 || !Array.isArray(snapshot.feeds))
      throw Error('Landing price snapshot is invalid');
    this.clock.receive(snapshot, this.elapsed());
    this.book = receiveSnapshotPrices(this.book, snapshot.feeds, this.clock.now(undefined, this.elapsed()));
  }

  prices(updates: unknown) {
    this.book = receiveLivePrices(this.book, updates, this.clock.now(undefined, this.elapsed()));
  }

  read(): { feed?: Row; now: number } {
    const sol = this.book[2];
    return {
      now: this.clock.now(undefined, this.elapsed()),
      feed: sol ? { ...sol, key: 'landing-sol', sequence: sol.sourceSlot, erNative: true,
        displaySequence: sol.sourceSlot, displayObservations: sol.observations } : undefined,
    };
  }
}
