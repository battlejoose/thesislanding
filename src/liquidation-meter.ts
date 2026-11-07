export interface MeterState {
  known: boolean;
  fill: number;
  multiple: number;
  heat: number;
  danger: boolean;
  liquidated: boolean;
  priceMove: number | null;
  liquidationMove: number | null;
}

export function positionMeterState(
  position: {
    state: number;
    entry: string;
    bust: string;
    entryValue: string;
    exit: string;
    profit: string;
    loss: string;
    margin: string;
    long: boolean;
  },
  live: { price: string; pnl: bigint; fresh: boolean; liquidatable: boolean },
) {
  const closed = position.state !== 0;
  const margin = BigInt(position.margin);
  const settledPnl =
    BigInt(position.profit) > 0n
      ? BigInt(position.profit)
      : margin > 0n
        ? (-BigInt(position.loss) * BigInt(position.entryValue)) / margin
        : 0n;
  return liquidationMeter({
    entry: BigInt(position.entry),
    bust: BigInt(position.bust),
    margin: BigInt(position.entryValue),
    price: BigInt(closed ? position.exit : live.price),
    pnl: closed ? settledPnl : live.pnl,
    long: position.long,
    fresh: closed || live.fresh,
    liquidatable: !closed && live.liquidatable,
    liquidated: position.state === 2,
  });
}

export function priceMovePercent(move: number | null): string {
  if (move === null || !Number.isFinite(move)) return "—";
  const percent = Math.abs(move) * 100;
  const sign = move < 0 ? "−" : "+";
  if (percent > 0 && percent < 0.005) return `${sign}<0.01%`;
  return `${sign}${percent.toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

/** Loss distance uses the contract's boundary; gains use collateral-adjusted, net P&L. */
export function liquidationMeter(input: {
  entry: bigint;
  bust: bigint;
  margin: bigint;
  price: bigint;
  pnl: bigint;
  long: boolean;
  fresh: boolean;
  liquidatable?: boolean;
  liquidated?: boolean;
}): MeterState {
  const { entry, bust, price, margin, pnl, long } = input;
  const move = (p: bigint) =>
    entry > 0n && p > 0n ? Number(p - entry) / Number(entry) : null;
  const base = { liquidationMove: move(bust), liquidated: !!input.liquidated };
  if (input.liquidated)
    return {
      ...base,
      known: true,
      fill: 0,
      multiple: 0,
      heat: 0,
      danger: true,
      priceMove: move(price),
    };
  if (!input.fresh || entry <= 0n || price <= 0n || margin <= 0n)
    return {
      ...base,
      known: false,
      fill: 0,
      multiple: 0,
      heat: 0,
      danger: false,
      priceMove: null,
    };
  const hit = input.liquidatable || (long ? price <= bust : price >= bust);
  const multiple = hit ? 0 : Math.max(0, 1 + Number(pnl) / Number(margin));
  const adverse = long ? price < entry : price > entry;
  const distance = long ? entry - bust : bust - entry;
  const remaining = long ? price - bust : bust - price;
  const rawFill =
    adverse && distance > 0n
      ? Number(remaining) / Number(distance) / 2
      : multiple / 2;
  const fill = hit ? 0 : Math.max(0, Math.min(1, rawFill));
  return {
    ...base,
    known: true,
    fill,
    multiple,
    heat: Math.min(1, Math.log2(Math.max(1, multiple / 2)) / 2),
    danger: fill <= 0.15,
    priceMove: move(price),
  };
}
