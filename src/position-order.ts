import type { Row } from "./client.ts";
import { crossed } from "./math.ts";
import { positionPnl } from "./economics.ts";
import { collateralUsd } from "./collateral-value.ts";
import { relativeCollateralValue } from "./relative-collateral.ts";
import { HISTORY_LIMIT } from "./history-limit.ts";

/** The exact USD P&L shown on the card. Prices never affect card ordering. */
export function displayedPositionPnl(
  position: Row,
  feed?: Row,
  collateralQuote?: Row,
): bigint | null {
  try {
    if (position.erPending && feed) feed = { ...feed, price: position.exit, observations: [] };
    const entryValue = BigInt(position.entryValue);
    if (position.state !== 0) {
      return BigInt(position.profit) > 0n
        ? BigInt(position.profit)
        : (-BigInt(position.loss) * entryValue) / BigInt(position.margin);
    }
    if (!feed || BigInt(feed.price) <= 0n || BigInt(position.entry) <= 0n)
      return null;
    const currentValue = collateralQuote
      ? collateralUsd(BigInt(position.margin), collateralQuote)
      : entryValue;
    const entryPnl = positionPnl(position,
      entryValue,
      BigInt(position.entry),
      BigInt(feed.price),
      position.leverage,
      position.long,
    );
    if (crossed(position, feed)) return -entryValue;
    if (entryPnl <= 0n) return entryPnl;
    // Winners keep their stake. Only the current full-bag quote can reduce
    // profit; collateral appreciation and old historical dips cannot raise it.
    if (position.coreBacked) {
      if (!collateralQuote) return null;
      return positionPnl(position,currentValue<entryValue?currentValue:entryValue,BigInt(position.entry),BigInt(feed.price),position.leverage,position.long);
    }
    if (position.collateralHistoryIncomplete) return null;
    const low = position.collateralLow === undefined ? entryValue : BigInt(position.collateralLow);
    const priceFloor = position.collateralEntryPrice !== undefined && collateralQuote
      ? relativeCollateralValue(entryValue, BigInt(position.collateralEntryPrice), BigInt(collateralQuote.id === 103 ? collateralQuote.solPrice : collateralQuote.price))
      : entryValue;
    const basis = [entryValue,currentValue,low,priceFloor].reduce((a,b)=>a<b?a:b);
    return positionPnl(position,
      basis,
      BigInt(position.entry),
      BigInt(feed.price),
      position.leverage,
      position.long,
    );
  } catch {
    return null;
  }
}

const integer = (value: unknown) => {
  try {
    return BigInt(String(value ?? "0"));
  } catch {
    return 0n;
  }
};
const descending = (a: bigint, b: bigint) => (a > b ? -1 : a < b ? 1 : 0);

/** Newest active trades first, then newest closes. Initial close stories keep
 * their original open-time place until the story is dismissed or expires. */
export function orderPositions<T extends Row>(
  positions: readonly T[],
  retainedClosingKeys: ReadonlySet<string> = new Set(),
): T[] {
  return [...positions].sort((a, b) => {
    const aOpen = a.state === 0 || retainedClosingKeys.has(a.key);
    const bOpen = b.state === 0 || retainedClosingKeys.has(b.key);
    if (aOpen !== bOpen) return aOpen ? -1 : 1;
    if (!aOpen) {
      const closed = descending(integer(a.closedAt), integer(b.closedAt));
      if (closed) return closed;
    }
    return (
      descending(integer(a.openedAt), integer(b.openedAt)) ||
      descending(integer(a.nonce), integer(b.nonce)) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
    );
  });
}

type RetainedClose = { sawReceipt: boolean; fallbackUntil: number };
/** Keep the latest completed history without hiding live trades or unpaid
 * settlements. Preserve the caller's ordering, including close animations. */
export function limitPositionHistory<T extends Row>(positions: readonly T[]): T[] {
  const pending = (row: T) => row.state === 0 || row.erPending || integer(row.remaining) > 0n;
  const recent = new Set(orderPositions(positions.filter(row => !pending(row)))
    .slice(0, HISTORY_LIMIT).map(row => row.key));
  return positions.filter(row => pending(row) || recent.has(row.key));
}

export interface PositionOrderState {
  owner: string;
  observed: ReadonlyMap<string, number>;
  retained: ReadonlyMap<string, RetainedClose>;
}

/** Pure presentation state: opening an old replay never pins history again.
 * A short fallback bridges the render where a close is first seen and the
 * effect that opens its receipt, so a card cannot jump down and back up. */
export function advancePositionOrder(
  previous: PositionOrderState | undefined,
  positions: readonly Row[],
  receipts: Readonly<Record<string, number>>,
  now: number,
  owner: string,
): PositionOrderState {
  const prior = previous?.owner === owner ? previous : undefined;
  const observed = new Map<string, number>();
  const retained = new Map<string, RetainedClose>();
  for (const position of positions) {
    observed.set(position.key, position.state);
    if (position.state === 0) continue;
    let closing = prior?.retained.get(position.key);
    if (!closing && prior?.observed.get(position.key) === 0)
      closing = { sawReceipt: false, fallbackUntil: now + 12_000 };
    if (!closing) continue;
    if ((receipts[position.key] ?? 0) > now) {
      retained.set(position.key, { ...closing, sawReceipt: true });
    } else if (!closing.sawReceipt && closing.fallbackUntil > now) {
      retained.set(position.key, closing);
    }
  }
  return { owner, observed, retained };
}
