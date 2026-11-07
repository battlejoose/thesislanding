import { appFetch as fetch } from "./app-url.ts";
import type { Connection, SignatureResult } from "@solana/web3.js";
import {
  waitForSignature,
  type ConfirmedSignatureResult,
} from "./confirmation.ts";

type ConfirmationConnection = Pick<
  Connection,
  "onSignature" | "removeSignatureListener" | "getSignatureStatuses"
>;

/** Only the server's exact-signature, confirmed-chain result is accepted.
 * Pending, malformed responses and transport errors are never failed trades. */
function confirmedResult(
  value: unknown,
  signature: string,
): ConfirmedSignatureResult | undefined {
  if (!value || typeof value !== "object") return;
  const event = value as {
    signature?: string;
    status?: string;
    slot?: number;
    error?: { err?: SignatureResult["err"] };
  };
  if (event.signature !== signature) return;
  const slot = Number.isFinite(event.slot) ? { slot: event.slot } : {};
  if (event.status === "confirmed" && event.error?.err == null)
    return { err: null, ...slot };
  if (event.status === "failed" && event.error?.err != null)
    return { err: event.error.err, ...slot };
}

/** SSE may beat the submit HTTP response. Retain a small, short-lived cache so
 * subscribing after receipt of the signature does not miss its confirmation. */
export class SponsoredConfirmationEvents {
  private results = new Map<
    string,
    { result: ConfirmedSignatureResult; receivedAt: number }
  >();
  private listeners = new Map<
    string,
    Set<(result: ConfirmedSignatureResult) => void>
  >();
  constructor(private now = Date.now) {}

  record(value: unknown) {
    if (!value || typeof value !== "object") return;
    const signature = (value as { signature?: unknown }).signature;
    if (typeof signature !== "string" || !signature || signature.length > 200)
      return;
    const result = confirmedResult(value, signature);
    if (!result) return;
    this.prune();
    this.results.set(signature, { result, receivedAt: this.now() });
    while (this.results.size > 128)
      this.results.delete(this.results.keys().next().value!);
    for (const listener of [...(this.listeners.get(signature) ?? [])])
      listener(result);
  }

  subscribe(
    signature: string,
    listener: (result: ConfirmedSignatureResult) => void,
  ) {
    this.prune();
    const cached = this.results.get(signature);
    if (cached) {
      listener(cached.result);
      return () => {};
    }
    let group = this.listeners.get(signature);
    if (!group) this.listeners.set(signature, (group = new Set()));
    group.add(listener);
    return () => {
      group!.delete(listener);
      if (!group!.size) this.listeners.delete(signature);
    };
  }

  private prune() {
    const cutoff = this.now() - 120_000;
    for (const [signature, entry] of this.results)
      if (entry.receivedAt < cutoff) this.results.delete(signature);
  }
}

interface SponsoredConfirmationOptions {
  timeoutMs?: number;
  pollMs?: number;
  fallbackDelayMs?: number;
  initialPollDelayMs?: number;
  fetchStatus?: (signature: string, signal: AbortSignal) => Promise<unknown>;
}

type StatusRequest = {
  signature: string;
  signal: AbortSignal;
  resolve: (value: unknown) => void;
};
let statusQueue: StatusRequest[] | undefined;

function fetchSponsoredStatus(signature: string, signal: AbortSignal) {
  return new Promise<unknown>((resolve) => {
    const abort = () => resolve(undefined);
    signal.addEventListener("abort", abort, { once: true });
    const done = (value: unknown) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    };
    if (!statusQueue) {
      statusQueue = [];
      setTimeout(() => {
        const queued = statusQueue ?? [];
        statusQueue = undefined;
        const live = queued.filter((request) => !request.signal.aborted);
        for (const request of queued)
          if (request.signal.aborted) request.resolve(undefined);
        const signatures = [
          ...new Set(live.map((request) => request.signature)),
        ];
        for (let offset = 0; offset < signatures.length; offset += 32) {
          const batch = signatures.slice(offset, offset + 32);
          const members = live.filter((request) =>
            batch.includes(request.signature),
          );
          const controller = new AbortController();
          const cancelIfUnused = () => {
            if (members.every((request) => request.signal.aborted))
              controller.abort();
          };
          for (const member of members)
            member.signal.addEventListener("abort", cancelIfUnused);
          void fetch(
            "/api/sponsor/status?signatures=" +
              encodeURIComponent(batch.join(",")),
            { cache: "no-store", signal: controller.signal },
          )
            .then(async (response) => {
              const body = response.ok ? await response.json() : null;
              const statuses: unknown[] = Array.isArray(body?.transactions)
                ? body.transactions
                : [];
              for (const member of members)
                member.resolve(
                  statuses.find(
                    (value) =>
                      value &&
                      typeof value === "object" &&
                      (value as { signature?: unknown }).signature ===
                        member.signature,
                  ),
                );
            })
            .catch(() => {
              for (const member of members) member.resolve(undefined);
            })
            .finally(() => {
              for (const member of members)
                member.signal.removeEventListener("abort", cancelIfUnused);
            });
        }
      }, 0);
    }
    statusQueue.push({ signature, signal, resolve: done });
  });
}

/** Prefer the server's existing confirmation watcher, shared over SSE. Poll its
 * cached status if an event was missed; use the browser RPC only as a fallback. */
export function waitForSponsoredSignature(
  connection: ConfirmationConnection,
  signature: string,
  events: SponsoredConfirmationEvents,
  options: SponsoredConfirmationOptions = {},
): Promise<ConfirmedSignatureResult> {
  const timeoutMs = options.timeoutMs ?? 90_000;
  const pollMs = options.pollMs ?? 400;
  const fallbackDelayMs = options.fallbackDelayMs ?? 1200;
  const initialPollDelayMs = options.initialPollDelayMs ?? 200;
  const fetchStatus = options.fetchStatus ?? fetchSponsoredStatus;
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const controller = new AbortController();
    let stopped = false;
    let unsubscribe = () => {};
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      stopped = true;
      clearTimeout(timeout);
      clearTimeout(pollTimer);
      clearTimeout(fallbackTimer);
      unsubscribe();
      controller.abort();
    };
    const finish = (result: ConfirmedSignatureResult) => {
      if (stopped) return;
      cleanup();
      resolve(result);
    };
    unsubscribe = events.subscribe(signature, finish);
    if (stopped) {
      unsubscribe();
      return;
    }
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
    fallbackTimer = setTimeout(() => {
      if (stopped) return;
      void waitForSignature(
        connection,
        signature,
        Math.max(1, timeoutMs - (Date.now() - started)),
        1000,
        controller.signal,
      )
        .then(finish)
        .catch(() => {
          // Cancellation or an ambiguous RPC timeout cannot disprove execution.
          // The overall deadline remains responsible for the pending message.
        });
    }, fallbackDelayMs);
    const poll = async () => {
      if (stopped) return;
      try {
        const result = confirmedResult(
          await fetchStatus(signature, controller.signal),
          signature,
        );
        if (result) {
          finish(result);
          return;
        }
      } catch {
        /* SSE or the independent RPC fallback may still establish execution. */
      }
      if (!stopped) {
        const elapsed = Date.now() - started;
        const delay =
          elapsed >= 10_000
            ? Math.max(pollMs, 3000)
            : elapsed >= 2000
              ? Math.max(pollMs, 1000)
              : pollMs;
        pollTimer = setTimeout(poll, delay);
      }
    };
    pollTimer = setTimeout(poll, initialPollDelayMs);
  });
}
