import type {
  Connection,
  SignatureResult,
  SignatureStatus,
} from "@solana/web3.js";

export type ConfirmedSignatureResult = SignatureResult & { slot?: number };

type StatusConnection = Pick<Connection, "getSignatureStatuses">;
export type SignatureStatusReader = (
  signatures: string[],
  signal: AbortSignal,
) => ReturnType<Connection["getSignatureStatuses"]>;
type StatusRead = {
  signature: string;
  signal: AbortSignal;
  resolve: (value: SignatureStatus | null) => void;
  reject: (error: unknown) => void;
};
const statusQueues = new WeakMap<StatusConnection, StatusRead[]>();
const statusReaders = new WeakMap<StatusConnection, SignatureStatusReader>();

/** web3.js does not expose cancellation on getSignatureStatuses. Server
 * transports register their public, signal-aware adapter so finished websocket
 * watchers can remove queued HTTP work and stop rate-limit retries. */
export function registerSignatureStatusReader(
  connection: StatusConnection,
  reader: SignatureStatusReader,
) {
  statusReaders.set(connection, reader);
  return () => {
    if (statusReaders.get(connection) === reader)
      statusReaders.delete(connection);
  };
}

/** Concurrent closes share one status RPC per connection, including fallback
 * polling. A single task turn batches arrivals without adding a poll interval. */
export function readSignatureStatus(
  connection: StatusConnection,
  signature: string,
  signal: AbortSignal,
) {
  return new Promise<SignatureStatus | null>((resolve, reject) => {
    let settled = false;
    const settle = (value: SignatureStatus | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      if (error !== undefined) reject(error);
      else resolve(value);
    };
    const abort = () => settle(null);
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    let queue = statusQueues.get(connection);
    if (!queue) {
      statusQueues.set(connection, (queue = []));
      setTimeout(() => {
        const queued = statusQueues.get(connection) ?? [];
        statusQueues.delete(connection);
        const live = queued.filter((read) => !read.signal.aborted);
        for (const read of queued) if (read.signal.aborted) read.resolve(null);
        const signatures = [...new Set(live.map((read) => read.signature))];
        for (let offset = 0; offset < signatures.length; offset += 256) {
          const batch = signatures.slice(offset, offset + 256);
          const members = live.filter((read) => batch.includes(read.signature));
          const controller = new AbortController();
          const cancelIfUnused = () => {
            if (members.every((member) => member.signal.aborted))
              controller.abort();
          };
          for (const member of members)
            member.signal.addEventListener("abort", cancelIfUnused);
          const reader =
            statusReaders.get(connection) ??
            ((keys: string[]) => connection.getSignatureStatuses(keys));
          void reader(batch, controller.signal)
            .then((response) => {
              const results = new Map(
                batch.map((key, index) => [key, response.value[index] ?? null]),
              );
              for (const member of members)
                member.resolve(results.get(member.signature) ?? null);
            })
            .catch((error) => {
              for (const member of members) member.reject(error);
            })
            .finally(() => {
              for (const member of members)
                member.signal.removeEventListener("abort", cancelIfUnused);
            });
        }
      }, 0);
    }
    queue.push({
      signature,
      signal,
      resolve: (value) => settle(value),
      reject: (error) => settle(null, error),
    });
  });
}

/** Confirm real chain execution: websocket first, immediate HTTP check + fallback.
 * Never resubmits a transaction or treats an RPC failure as a failed trade. */
export function waitForSignature(
  connection: Pick<
    Connection,
    "onSignature" | "removeSignatureListener" | "getSignatureStatuses"
  >,
  signature: string,
  timeoutMs = 90_000,
  pollMs = 1000,
  signal?: AbortSignal,
  initialPollDelayMs = 0,
): Promise<ConfirmedSignatureResult> {
  return new Promise((resolve, reject) => {
    const reads = new AbortController();
    let stopped = false;
    let subscription: number | undefined;
    let websocketDelivered = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let hasWebsocket = true;
    const removeSubscription = () => {
      if (subscription === undefined || websocketDelivered) return;
      const id = subscription;
      subscription = undefined;
      try {
        void connection.removeSignatureListener(id).catch(() => {});
      } catch {}
    };
    const cleanup = () => {
      stopped = true;
      clearTimeout(timeout);
      clearTimeout(pollTimer);
      signal?.removeEventListener("abort", abort);
      reads.abort();
      removeSubscription();
    };
    const finish = (result: ConfirmedSignatureResult) => {
      if (stopped) return;
      cleanup();
      resolve(result);
    };
    const abort = () => {
      if (stopped) return;
      cleanup();
      reject(new DOMException("Confirmation watcher stopped", "AbortError"));
    };
    if (signal?.aborted) {
      abort();
      return;
    }
    signal?.addEventListener("abort", abort, { once: true });
    timeout = setTimeout(() => {
      if (stopped) return;
      cleanup();
      reject(
        Error(
          "Confirmation pending; check transaction before retrying: " +
            signature,
        ),
      );
    }, timeoutMs);
    try {
      subscription = connection.onSignature(
        signature,
        (result, context) => {
          // web3.js removes a signature subscription after this callback.
          // Removing it here too produces a duplicate-unsubscribe warning.
          websocketDelivered = true;
          finish({
            ...result,
            ...(Number.isFinite(context?.slot) ? { slot: context.slot } : {}),
          });
        },
        "confirmed",
      );
      // Some adapters can deliver an already-known result inline.
      if (stopped) removeSubscription();
    } catch {
      hasWebsocket = false;
      /* HTTP fallback. */
    }
    const poll = async () => {
      if (stopped) return;
      try {
        const status = await readSignatureStatus(connection, signature, reads.signal);
        if (
          status &&
          (status.confirmationStatus === "confirmed" ||
            status.confirmationStatus === "finalized")
        ) {
          finish({
            err: status.err,
            ...(Number.isFinite(status.slot) ? { slot: status.slot } : {}),
          });
          return;
        }
      } catch {
        /* A transport error does not establish a transaction failure. */
      }
      if (!stopped) pollTimer = setTimeout(poll, pollMs);
    };
    if (stopped) return;
    if (hasWebsocket && initialPollDelayMs > 0)
      pollTimer = setTimeout(poll, initialPollDelayMs);
    else void poll();
  });
}
