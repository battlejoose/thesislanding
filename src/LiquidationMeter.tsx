import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { Row } from "./client.ts";
import { formatMarketValue } from "./market-view.ts";
import {
  positionMeterState,
  priceMovePercent,
  type MeterState,
} from "./liquidation-meter.ts";
import "./liquidation-meter.css";

/** CSS-only particles are bounded per card; all movement respects reduced-motion preferences. */
export function LiquidationMeter({
  state: s,
  price,
  liquidationPrice,
  frozen = false,
}: {
  state: MeterState;
  price: string;
  liquidationPrice: string;
  frozen?: boolean;
}) {
  const burning = s.known && s.multiple >= 2 && !s.liquidated && !frozen;
  const color = !s.known
    ? "var(--muted)"
    : s.danger
      ? "#f45252"
      : s.fill >= 1
        ? "#35e99a"
        : s.fill >= 0.5
          ? `hsl(${48 + (s.fill - 0.5) * 206} 75% 72%)`
          : `hsl(${s.fill * 96} 80% 69%)`;
  const flames = burning ? 3 + Math.floor(s.heat * 5) : 0;
  const sparks = burning ? 3 + Math.floor(s.heat * 11) : 0;
  const style = {
    "--meter-fill": s.fill,
    "--meter-color": color,
    "--meter-heat": s.heat,
    "--marker-color":
      s.fill > 0.5 ? "#63d6a3" : s.fill < 0.5 ? "#f27870" : "var(--muted)",
    "--fire-speed": `${0.85 - s.heat * 0.5}s`,
  } as CSSProperties;
  return (
    <span
      className={`ws-meter${s.danger ? " is-danger" : ""}${burning ? " is-burning" : ""}${s.liquidated ? " is-liquidated" : ""}${!s.known ? " is-unknown" : ""}${frozen ? " is-frozen" : ""}`}
      style={style}
      role="meter"
      aria-label="Position value and liquidation distance"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={s.known ? Math.round(s.fill * 100) : undefined}
      aria-valuetext={
        !s.known
          ? "Waiting for a price"
          : `${s.liquidated ? "Liquidated. " : ""}${frozen ? "Closed at" : "Current price"} ${price}, ${priceMovePercent(s.priceMove)} from entry; liquidation price ${liquidationPrice}, at ${priceMovePercent(s.liquidationMove)}. ${s.multiple.toFixed(2)} times the initial stake. Empty at liquidation, half at entry, full at double.`
      }
    >
      {s.liquidationMove !== null && (
        <span
          className={`ws-meter-limit ${s.liquidationMove > 0 ? "positive" : "negative"}`}
          aria-hidden="true"
        >
          <span className="ws-meter-quote" title="Liquidation price">
            {liquidationPrice}
          </span>
          <span>{priceMovePercent(s.liquidationMove)}</span>
          <svg
            viewBox="0 0 12 12"
            className={s.liquidationMove > 0 ? "is-up" : "is-down"}
          >
            <path d="M6 10V2M2.5 5.5 6 2l3.5 3.5" />
          </svg>
        </span>
      )}
      <span className="ws-meter-track" aria-hidden="true">
        <span className="ws-meter-fill" />
        <span className="ws-meter-mid" />
      </span>
      {s.known && (
        <span className="ws-meter-marker" aria-hidden="true">
          <span className="ws-meter-marker-label">
            <span
              className="ws-meter-quote"
              title={frozen ? "Closing price" : "Current price"}
            >
              {price}
            </span>
            <span>{priceMovePercent(s.priceMove)}</span>
          </span>
          <svg viewBox="0 0 8 5">
            <path d="M0 0h8L4 5Z" />
          </svg>
        </span>
      )}
      {burning && (
        <span className="ws-meter-fire" aria-hidden="true">
          {Array.from({ length: flames }, (_, i) => (
            <svg
              key={`f${i}`}
              viewBox="0 0 20 30"
              style={
                {
                  left: `${8 + (i * 82) / Math.max(1, flames - 1)}%`,
                  "--i": i,
                } as CSSProperties
              }
            >
              <path d="M10 29C-2 28 1 17 7 11c1 4 2 4 3 5 3-6-3-8 1-15 3 8 10 13 7 22-1 4-4 6-8 6Z" />
              <path
                className="ws-flame-core"
                d="M10 28c-5-2-5-6-2-10 0 3 2 3 3 4 2-2 3-4 2-7 6 7 2 12-3 13Z"
              />
            </svg>
          ))}
          {Array.from({ length: sparks }, (_, i) => (
            <i
              key={`s${i}`}
              style={
                {
                  left: `${8 + ((i * 37) % 84)}%`,
                  "--i": i,
                  "--drift": `${((i % 3) - 1) * (6 + s.heat * 8)}px`,
                } as CSSProperties
              }
            />
          ))}
        </span>
      )}
      {s.liquidated && !frozen && (
        <span className="ws-meter-blood" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ "--i": i } as CSSProperties} />
          ))}
        </span>
      )}
    </span>
  );
}

/** Only a live open-to-liquidated transition plays the dissolve; history stays quiet. */
export function PositionLiquidationMeter({
  position,
  price,
  pnl,
  fresh,
  liquidatable,
}: {
  position: Row;
  price: string;
  pnl: bigint;
  fresh: boolean;
  liquidatable: boolean;
}) {
  const previous = useRef(position.state);
  const [dissolving, setDissolving] = useState(false);
  useEffect(() => {
    const justLiquidated = previous.current === 0 && position.state === 2;
    previous.current = position.state;
    if (!justLiquidated) return;
    setDissolving(true);
    const timer = setTimeout(() => setDissolving(false), 1600);
    return () => clearTimeout(timer);
  }, [position.state]);
  const state = positionMeterState(
    {
      state: position.state,
      entry: position.entry,
      bust: position.bust,
      entryValue: position.entryValue,
      exit: position.exit,
      profit: position.profit,
      loss: position.loss,
      margin: position.margin,
      long: position.long,
    },
    { price, pnl, fresh, liquidatable },
  );
  const formatPrice = (value: string) =>
    formatMarketValue(Number(value) / 1e12);
  return (
    <div className="liquidation-cell">
      <LiquidationMeter
        state={state}
        price={formatPrice(position.state ? position.exit : price)}
        liquidationPrice={formatPrice(position.bust)}
        frozen={position.state !== 0 && !dissolving}
      />
    </div>
  );
}
