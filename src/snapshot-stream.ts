import type { Snapshot } from "./client.ts";
import { applyRowPatch, ROW_FIELDS, type RowPatch } from './snapshot-rows.ts';

type State = Record<string, unknown> & { serverTime: number };
export type SnapshotPatch = { base: number; set: State; remove: string[]; rows?: Record<string, RowPatch> };

/** One baseline per connection. HTTP fallbacks never become a patch baseline. */
export class SnapshotStream {
  private current?: State;
  full(value: State) { this.current = value; return value; }
  patch(value: SnapshotPatch): State {
    if (!this.current || value.base !== this.current.serverTime ||
        !Number.isSafeInteger(value.set?.serverTime) || value.set.serverTime <= value.base ||
        !Array.isArray(value.remove)) throw Error("Snapshot stream needs resynchronization");
    const next = { ...this.current, ...value.set };
    for (const key of value.remove) delete next[key];
    if (value.rows !== undefined) {
      if (!value.rows || typeof value.rows !== 'object' || Array.isArray(value.rows)) throw Error('Invalid row patches');
      for (const [key, patch] of Object.entries(value.rows)) {
        if (!ROW_FIELDS.has(key) || Object.hasOwn(value.set, key) || value.remove.includes(key)) throw Error('Conflicting row patch');
        next[key] = applyRowPatch(this.current[key], patch);
      }
    }
    this.current = next;
    return next;
  }
}

/** Decode only changed fields, preserving references to unchanged account arrays. */
export function listenForSnapshots(source: EventSource, accept: (snapshot: Snapshot) => void) {
  const stream = new SnapshotStream();
  const receive = (event: MessageEvent, patch: boolean) => {
    try {
      const value = JSON.parse(event.data);
      accept((patch ? stream.patch(value) : stream.full(value)) as unknown as Snapshot);
    } catch {
      // Never apply a patch to an unrelated HTTP snapshot or silently skip a gap.
      source.dispatchEvent(new Event("resync"));
    }
  };
  source.addEventListener("message", event => receive(event, false));
  source.addEventListener("state-patch", event => receive(event as MessageEvent, true));
}
