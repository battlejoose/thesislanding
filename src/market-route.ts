/** Created markets live under /m/<SYMBOL>/ on the same origin. The markets
 * supervisor forwards that prefix to the market's own server, so this page's
 * existing "/api/..." and "/deployment.json" requests are rewritten once here
 * instead of at every call site. Market listing/creation stays at the root. */
export function marketPrefix(pathname: string, search = ""): string {
  const match = /^(\/perps)?\/m\/([A-Za-z0-9]{2,12})(?=\/|$)/.exec(pathname);
  if (match) return `${match[1]??''}/m/${match[2].toUpperCase()}`;
  // Branded hosting already serves this static page. Keep venue API routing
  // explicit without depending on a new website catch-all deployment.
  const selected = new URLSearchParams(search).getAll('market');
  return /^\/perps\/trade\/?$/.test(pathname) && selected.length === 1 && /^[A-Za-z0-9]{2,12}$/.test(selected[0])
    ? `/perps/m/${selected[0].toUpperCase()}` : "";
}
export const sharedMarketApi=(url:string)=>/^\/api\/(?:markets(?:[/?]|$)|registration\/|wallet\/activation(?:[/?]|$))/.test(url);
export function marketUrl(prefix: string, url: string): string {
  if (!prefix || !url.startsWith("/") || url.startsWith(prefix + "/")) return url;
  if (sharedMarketApi(url)) return url;
  if (url.startsWith("/api/") || url === "/deployment.json" || url.startsWith("/deployment.json?")) return prefix + url;
  return url;
}
/** The path a market page would have at the root, used for page routing. */
export function marketPath(pathname: string): string {
  const prefix = marketPrefix(pathname);
  return prefix ? pathname.slice(prefix.length) || "/" : pathname;
}
/** Browser pages retain /perps; backend service routes are /m/<TOKEN>. */
export function marketServiceUrl(pathname:string,url:string,search="") {
  return marketUrl(marketPrefix(pathname,search).replace(/^\/perps/,''),url);
}
export function brandedMarketPath(path: string): string {
  const match = /^\/m\/([A-Za-z0-9]{2,12})\/?$/.exec(path);
  return match ? `/trade?market=${match[1].toUpperCase()}` : path === '/' ? '/trade' : path;
}
export function installMarketRouting(target: Window & typeof globalThis = window): string {
  const prefix = marketPrefix(target.location.pathname,target.location.search);
  if (!prefix) return "";
  const fetcher = target.fetch.bind(target);
  target.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") return fetcher(marketUrl(prefix, input), init);
    if (input instanceof URL && input.origin === target.location.origin)
      return fetcher(new URL(marketUrl(prefix, input.pathname) + input.search, input.origin), init);
    return fetcher(input, init);
  }) as typeof fetch;
  const Source = target.EventSource;
  if (Source) target.EventSource = class extends Source {
    constructor(url: string | URL, options?: EventSourceInit) {
      super(typeof url === "string" ? marketUrl(prefix, url) : url, options);
    }
  } as typeof EventSource;
  return prefix;
}
