import type { Row } from "./client.ts";

export type LiveMarketPrice = {
  id: number;
  price: string;
  publishTime: number;
  sourceSlot: string;
};
type LiveHistory = LiveMarketPrice & { observations: { sequence: string; price: string; publishTime: number }[] };
export const DISPLAY_HISTORY_LIMIT = 256;
export type LivePriceBook = Partial<Record<number, LiveHistory>>;

/** A display cache only. Never writes transaction snapshots, balances, risk
 * cursors or confirmed outcomes. Source slots order the existing US ER stream. */
export function receiveLivePrices(book: LivePriceBook, updates: unknown, now = Date.now()): LivePriceBook {
  if (!Array.isArray(updates) || updates.length > 4) return book;
  let next = book;
  for (const update of updates) {
    try {
      if (!update || !Number.isInteger(update.id) || update.id < 0 || update.id > 3 ||
          typeof update.price !== "string" || !/^\d{1,19}$/.test(update.price) ||
          typeof update.sourceSlot !== "string" || !/^\d{1,20}$/.test(update.sourceSlot) ||
          !Number.isSafeInteger(update.publishTime) || update.publishTime <= 0 ||
          now / 1000 - update.publishTime > 3 || update.publishTime > now / 1000 + 2 ||
          BigInt(update.price) <= 0n || BigInt(update.sourceSlot) <= 0n) continue;
      const previous = next[update.id];
      if (previous && (BigInt(update.sourceSlot) <= BigInt(previous.sourceSlot) || update.publishTime < previous.publishTime)) continue;
      // Keep source times for the simple chart's time axis. One unchanged-price
      // observation per second preserves flat periods without inventing ticks.
      const observations = previous && previous.price === update.price && previous.publishTime === update.publishTime ? previous.observations :
        [...(previous?.observations ?? []), { sequence: update.sourceSlot, price: update.price, publishTime: update.publishTime }].slice(-DISPLAY_HISTORY_LIMIT);
      next = { ...next, [update.id]: { id:update.id, price:update.price, publishTime:update.publishTime, sourceSlot:update.sourceSlot, observations } };
    } catch { /* Invalid live data must never displace the account snapshot. */ }
  }
  return next;
}

export function displayMarketFeed(feed: Row, book: LivePriceBook, now = Date.now()): Row {
  const live = book[feed.id];
  // Retain the last observed value during a pause, with its original timestamp.
  // isFresh labels it stale; falling back to an older price invents a move.
  if (!live || live.publishTime > now / 1000 + 2) return feed;
  if (live.publishTime < Number(feed.publishTime) || BigInt(live.sourceSlot) < BigInt(feed.sourceSlot ?? 0)) {
    // A coherent snapshot can beat a coalesced stream frame. Keep that newer
    // price in the same display history so its arrival doesn't remount the tape.
    if (!feed.sourceSlot) return feed;
    const observations = live.observations.at(-1)?.price === feed.price && live.observations.at(-1)?.publishTime === Number(feed.publishTime) ? live.observations :
      [...live.observations, {sequence:String(feed.sourceSlot), price:String(feed.price), publishTime:Number(feed.publishTime)}].slice(-DISPLAY_HISTORY_LIMIT);
    return {...feed, displaySequence:String(feed.sourceSlot), displayObservations:observations};
  }
  return { ...feed, price: live.price, publishTime: live.publishTime,
    displaySequence: live.sourceSlot, displayObservations: live.observations };
}

/** Snapshot fallback and SSE share one monotonic display history. The
 * transaction snapshot remains untouched and retains its own risk history. */
export function receiveSnapshotPrices(book: LivePriceBook, feeds: Row[], now = Date.now()): LivePriceBook {
  return receiveLivePrices(book, feeds.filter(feed => feed.id >= 0 && feed.id <= 3).map(feed => ({
    id: feed.id, price: String(feed.price), publishTime: Number(feed.publishTime), sourceSlot: String(feed.sourceSlot),
  })), now);
}
