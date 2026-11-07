import { apiUrl } from "./app-url.ts";
/** Let native EventSource reconnect normally. Recover terminal HTTP failures
 * and connections that stay silent or stuck reconnecting. */
export function startEventStream(
  attach: (source: EventSource) => void,
  create = () => new EventSource(apiUrl("/api/events?compact=2")),
  initialDelayMs = 1000,
  staleAfterMs = 12_000,
) {
  let stopped = false;
  let source: EventSource;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let delay = initialDelayMs;
  let lastFrame = Date.now();
  const connect = () => {
    if (stopped) return;
    retry = undefined;
    const current = source = create();
    lastFrame = Date.now();
    for (const name of ["message", "state-patch", "prices", "heartbeat"])
      current.addEventListener(name, () => { if (current === source) lastFrame = Date.now(); });
    attach(current);
    current.addEventListener("open", () => {
      if (current !== source) return;
      delay = initialDelayMs;
      lastFrame = Date.now();
    });
    current.addEventListener("error", () => {
      if (stopped || current !== source || current.readyState !== 2 || retry) return;
      current.close();
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 10_000);
    });
    current.addEventListener("resync", () => {
      if (stopped || current !== source || retry) return;
      current.close();
      retry = setTimeout(connect, initialDelayMs);
    });
  };
  connect();
  const watchdog = setInterval(() => {
    if (!stopped && source.readyState !== 2 && Date.now() - lastFrame > staleAfterMs)
      source.dispatchEvent(new Event("resync"));
  }, Math.max(5, Math.min(1000, staleAfterMs / 2)));
  return () => {
    stopped = true;
    clearTimeout(retry);
    clearInterval(watchdog);
    source.close();
  };
}
