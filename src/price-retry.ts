export const PRICE_WAIT_MS = 3_000;
export type PriceAction = "open" | "close";
export const priceTimeoutMessage = (action: PriceAction) => action === "open"
  ? "Prices aren't ready yet. Bet not placed. Your tokens remain available for trading or withdrawal; please try again."
  : "Prices aren't ready yet. Close not submitted; please try again.";

/** The server must prove either no submission or a confirmed atomic ER price
 * failure. A signature with unknown status never permits another transaction. */
export function canRetryPrice(error: unknown) {
  const e = error as { notSubmitted?: unknown; confirmedFailed?: unknown; failedSignature?: unknown; retryablePrice?: unknown; signature?: unknown } | null;
  return e?.retryablePrice === true && !e.signature && (e.notSubmitted === true ||
    (e.confirmedFailed === true && typeof e.failedSignature === "string" && /^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(e.failedSignature)));
}

export function priceWaitExpired() {
  return Object.assign(Error("Price waiting window expired; nothing was submitted"), {
    notSubmitted: true, priceWaitExpired: true,
  });
}

export type PriceAttempt = {
  deadline: number;
  remainingMs: () => number;
  assertBeforeSubmit: () => void;
};

/** One shared deadline for readiness, preparation and safe preflight retries.
 * Never race/cancel the mutating request: once submitted, confirmation can take
 * longer than this window and must keep following the original transaction. */
export async function withPriceRetries<T>(
  action: PriceAction,
  attempt: (window: PriceAttempt) => Promise<T>,
  options: {
    now?: () => number;
    pause?: (ms: number) => Promise<void>;
    onWait?: () => void;
    assertActive?: () => void;
  } = {},
) {
  const now = options.now ?? Date.now;
  const pause = options.pause ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const deadline = now() + PRICE_WAIT_MS;
  const window: PriceAttempt = {
    deadline,
    remainingMs: () => Math.max(0, deadline - now()),
    assertBeforeSubmit: () => {
      options.assertActive?.();
      if (now() >= deadline) throw priceWaitExpired();
    },
  };
  while (now() < deadline) {
    window.assertBeforeSubmit();
    try {
      return await attempt(window);
    } catch (error) {
      const e = error as { notSubmitted?: unknown; priceWaitExpired?: unknown; signature?: unknown } | null;
      if (e?.notSubmitted === true && e.priceWaitExpired === true && !e.signature) break;
      if (!canRetryPrice(error)) throw error;
      options.onWait?.();
      // Reuse the live stream; no extra price polling. Pace rejected attempts.
      const remaining = window.remainingMs();
      if (remaining > 0) await pause(Math.min(200, remaining));
    }
  }
  throw Error(priceTimeoutMessage(action));
}
