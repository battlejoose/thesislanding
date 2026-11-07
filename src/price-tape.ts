export type PriceChange = { key: string; fraction: number };
export type PriceTape = {
  newest: string | null;
  shown: PriceChange[];
  step: number;
};

export const PRICE_TAPE_ROWS = 6;

export function initialPriceTape(changes: PriceChange[]): PriceTape {
  return {
    newest: changes[0]?.key ?? null,
    shown: changes.slice(0, PRICE_TAPE_ROWS),
    step: 0,
  };
}

/** Push the newest observed move with the price render. Never replay a batch
 * after the headline price has already jumped to its final value. */
export function receivePriceChanges(state: PriceTape, changes: PriceChange[]): PriceTape {
  if (!changes.length) return state;
  if (state.newest === null) return initialPriceTape(changes);
  const next = changes[0];
  if (BigInt(next.key) <= BigInt(state.newest)) return state;
  return {
    newest: next.key,
    // The seventh row exits through the clipped bottom during the push.
    shown: [next, ...state.shown].slice(0, PRICE_TAPE_ROWS + 1),
    step: state.step + 1,
  };
}
