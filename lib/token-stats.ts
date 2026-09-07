// Live market data for a build's token.
//
// The site is a static export with no server, so this runs in the browser.
// That rules out pump.fun's own API, which answers 403 to any request
// carrying an Origin header. DexScreener sends access-control-allow-origin:*.
//
// Two DexScreener endpoints are needed. The token-search endpoint only knows
// tokens that trade on a DEX, so a pump.fun token still on its bonding curve
// comes back empty there; the per-chain endpoint does list it.
export interface TokenStats {
  cap: string; change: string; up: boolean;
  // The token's own identity and links, so the card cites a real asset
  // rather than asserting figures with nothing to check them against.
  name?: string; symbol?: string; address?: string; image?: string;
  chart?: string; website?: string; twitter?: string; telegram?: string;
}

export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 4)}…${address.slice(-4)}` : address;
}

export function pumpFunUrl(address: string): string {
  return `https://pump.fun/coin/${address}`;
}

const BY_TOKEN = 'https://api.dexscreener.com/latest/dex/tokens/';
const BY_CHAIN = 'https://api.dexscreener.com/token-pairs/v1/';

export function formatCap(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  // Below $100K a rounded figure loses too much: $6,749 must not read "$7K".
  if (value >= 1e5) return `$${Math.round(value / 1e3)}K`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export function formatChange(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(2)}%`;
}

interface Social { url?: string; type?: string; }
interface Pair {
  liquidity?: { usd?: number } | null; marketCap?: number; fdv?: number;
  priceChange?: { h24?: number } | null; url?: string;
  baseToken?: { address?: string; name?: string; symbol?: string };
  info?: { imageUrl?: string; websites?: { url?: string }[]; socials?: Social[] } | null;
}

export function pickPair(pairs: Pair[]): Pair | null {
  if (!pairs.length) return null;
  // A token can trade in several pools; the deepest one carries the honest
  // price. A token still on a bonding curve reports no liquidity at all.
  return pairs.reduce((a, b) => (b.liquidity?.usd ?? 0) > (a.liquidity?.usd ?? 0) ? b : a);
}

export function toStats(pair: Pair | null): TokenStats | null {
  if (!pair) return null;
  const cap = pair.marketCap ?? pair.fdv;
  const change = pair.priceChange?.h24;
  if (typeof cap !== 'number' && typeof change !== 'number') return null;
  const socials = pair.info?.socials ?? [];
  const find = (type: string) => socials.find(s => s.type === type)?.url;
  return {
    cap: typeof cap === 'number' ? formatCap(cap) : '—',
    change: typeof change === 'number' ? formatChange(change) : '—',
    up: (change ?? 0) >= 0,
    name: pair.baseToken?.name,
    symbol: pair.baseToken?.symbol,
    address: pair.baseToken?.address,
    image: pair.info?.imageUrl,
    chart: pair.url,
    website: pair.info?.websites?.[0]?.url,
    twitter: find('twitter'),
    telegram: find('telegram'),
  };
}

async function json(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!response.ok) return null;
  return await response.json() as unknown;
}

export async function fetchTokenStats(address: string, chain = 'solana', signal?: AbortSignal): Promise<TokenStats|null> {
  try {
    const listed = await json(BY_TOKEN + address, signal) as { pairs?: Pair[] } | null;
    const fromListed = toStats(pickPair(listed?.pairs ?? []));
    if (fromListed) return fromListed;
    const onCurve = await json(`${BY_CHAIN}${chain}/${address}`, signal) as Pair[] | null;
    return toStats(pickPair(Array.isArray(onCurve) ? onCurve : []));
  } catch {
    // Offline, blocked, or rate limited: the card keeps its placeholder dashes.
    return null;
  }
}
