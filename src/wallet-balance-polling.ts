/** Share periodic reads, but let a confirmed action request a read that starts
 * after an older request. Concurrent action refreshes share that follow-up. */
export class WalletBalanceRefresh {
  private pending?: Promise<void>;

  constructor(private read: () => Promise<void>) {}

  run(afterCurrent = false): Promise<void> {
    if (this.pending) {
      return afterCurrent
        ? this.pending.catch(() => {}).then(() => this.run())
        : this.pending;
    }
    const pending = Promise.resolve().then(this.read);
    this.pending = pending;
    const clear = () => {
      if (this.pending === pending) this.pending = undefined;
    };
    void pending.then(clear, clear);
    return pending;
  }
}

type Visibility = {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
};
type PollClock = {
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(timer: unknown): void;
};

const realClock: PollClock = {
  setInterval: (callback, intervalMs) => setInterval(callback, intervalMs),
  clearInterval: (timer) => clearInterval(timer as ReturnType<typeof setInterval>),
};

/** Balance polling is only useful while the page is visible. Explicit action
 * refreshes remain independent and may finish after a wallet opens another tab. */
export function startWalletBalancePolling({
  refresh,
  intervalMs,
  visibility,
  clock = realClock,
}: {
  refresh: (afterCurrent?: boolean) => Promise<void>;
  intervalMs: number;
  visibility: Visibility;
  clock?: PollClock;
}) {
  let stopped = false;
  let timer: unknown;
  const poll = (afterCurrent = false) => {
    if (!stopped && !visibility.hidden)
      void refresh(afterCurrent).catch(() => {});
  };
  const changed = () => {
    if (timer !== undefined) clock.clearInterval(timer);
    timer = undefined;
    if (stopped || visibility.hidden) return;
    // A request left over from before the tab was hidden may be stale.
    poll(true);
    timer = clock.setInterval(poll, intervalMs);
  };
  visibility.addEventListener("visibilitychange", changed);
  changed();
  return () => {
    stopped = true;
    if (timer !== undefined) clock.clearInterval(timer);
    visibility.removeEventListener("visibilitychange", changed);
  };
}
