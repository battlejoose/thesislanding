// Live market data for a build's token.
//
// The site is a static export with no server, so this runs in the browser.
// DexScreener is used rather than pump.fun's own API: pump.fun answers 403 to
// any request carrying an Origin header, so it cannot be called from a page.
export interface TokenStats { cap: string; change: string; up: boolean; }

const ENDPOINT = 'https://api.dexscreener.com/latest/dex/tokens/';

export function formatCap(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${Math.round(value / 1e3)}K`;
  return `$${Math.round(value)}`;
}

export function formatChange(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`;
}

interface Pair { liquidity?: { usd?: number }; marketCap?: number; fdv?: number; priceChange?: { h24?: number }; }

export async function fetchTokenStats(address: string, signal?: AbortSignal): Promise<TokenStats|null> {
  try {
    const response = await fetch(ENDPOINT + address, { signal, headers: { accept: 'application/json' } });
    if (!response.ok) return null;
    const body = await response.json() as { pairs?: Pair[] };
    const pairs = body.pairs ?? [];
    if (!pairs.length) return null;
    // A token can trade in several pools; the deepest one carries the honest price.
    const best = pairs.reduce((a, b) => (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a);
    const cap = best.marketCap ?? best.fdv;
    const change = best.priceChange?.h24;
    if (typeof cap !== 'number' && typeof change !== 'number') return null;
    return {
      cap: typeof cap === 'number' ? formatCap(cap) : '—',
      change: typeof change === 'number' ? formatChange(change) : '—',
      up: (change ?? 0) >= 0,
    };
  } catch {
    // Offline, blocked, or rate limited: the card keeps its placeholder dashes.
    return null;
  }
}
