import { appFetch as fetch } from "./app-url.ts";
import type { Snapshot } from "./client.ts";

/** A stalled response must not block the existing stream fallback forever.
 * This reads the server's shared cache; it does not query RPC or send a trade. */
export async function readStateSnapshot(fetcher = fetch, timeoutMs = 3_000): Promise<Snapshot> {
  const response = await fetcher("/api/state?compact=2", {
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw Error("Connection interrupted");
  return response.json();
}
