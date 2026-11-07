import type { Snapshot } from "./client.ts";

/** Markets accepting new positions; on-chain IDs never get reassigned. */
export const CORE_MARKETS = [
  { id: 0, symbol: "BTC", name: "Bitcoin" },
  { id: 1, symbol: "ZEC", name: "Zcash" },
  { id: 2, symbol: "SOL", name: "Solana" },
  { id: 3, symbol: "ETH", name: "Ethereum" },
] as const;

// Retain labels for existing positions and their settlement/history.
const RETIRED_MARKETS = [{ id: 4, symbol: "PUMP", name: "pump.fun" }] as const;
const ALL_MARKETS = [...CORE_MARKETS, ...RETIRED_MARKETS];

export function isActiveMarket(id: number): boolean {
  return CORE_MARKETS.some((market) => market.id === id);
}

export function hasRetiredPumpPosition(state: Pick<Snapshot, "markets" | "positions">): boolean {
  const market = state.markets.find((market) => market.id === 4);
  return !!market && state.positions.some((x) => x.market === market.key && x.state === 0);
}

/** Official pump.fun token on Solana mainnet, used as PUMP's price source. */
export const PUMP_MINT = "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn";

export function coreMarketSymbol(id: number): string | undefined {
  return ALL_MARKETS.find((market) => market.id === id)?.symbol;
}

export function coreMarketName(symbol: string): string {
  return (
    ALL_MARKETS.find((market) => market.symbol === symbol.toUpperCase())
      ?.name ?? symbol
  );
}
