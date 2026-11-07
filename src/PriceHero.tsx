import { memo, useMemo, useState, type CSSProperties } from "react";
import { Coin } from "./components.tsx";
import { PriceChangeTape } from "./PriceChangeTape.tsx";
import { SimplePriceChart } from "./SimplePriceChart.tsx";
import { isFresh } from "./math.ts";
import {
  observationTape,
  priceChanges,
  marketCapUsd,
  formatLiveMarketValue,
} from "./market-view.ts";
import type { Row } from "./client.ts";
import {thesisPreview} from './app-url.ts';
import "./acid-price-fx.css";

// One fixed little splash, reused for price changes. The tuple is x/y travel,
// droplet size and rotation: deliberately irregular, like a tiny acid reaction.
const priceDroplets = [
  [-18, -24, 5, -28],
  [4, -34, 4, 16],
  [24, -20, 6, 42],
  [33, 1, 3, 80],
  [21, 19, 4, 126],
  [-6, 24, 3, 178],
  [-27, 12, 5, -112],
] as const;

export const PriceHero = memo(function PriceHero({
  feed,
  symbol,
  now,
}: {
  feed?: Row;
  symbol: string;
  now: number;
}) {
  const community = (feed?.id ?? 0) >= 100;
  const cap = marketCapUsd(feed);
  const value = community ? cap : feed ? Number(feed.price) / 1e12 : null;
  const text = formatLiveMarketValue(value, community);
  const [whole, cents] = text.split(".");
  const microCents = cents?.slice(2) ?? "";
  const width = [...`${whole}${cents ? "." + cents.slice(0, 2) : ""}`].reduce(
    (n, c) => n + (c === "," || c === "." ? 0.25 : 0.6),
    0,
  ) + microCents.length * 0.24;
  const points = useMemo(() => observationTape(feed), [feed]);
  const changes = useMemo(() => priceChanges(points), [points]);
  const fresh = isFresh(feed, now) && (!community || cap !== null);
  const [reaction, setReaction] = useState<{
    symbol: string;
    text: string;
    value: number | null;
    id: number;
    direction?: "up" | "down";
  }>({ symbol, text, value, id: 0 });
  if (reaction.symbol !== symbol || reaction.value !== value || reaction.text !== text) {
    const animate = reaction.symbol === symbol && value !== null && reaction.value !== null &&
      value !== reaction.value && fresh && !document.hidden &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Start the reaction in the same paint as the new number, not in a later
    // effect. Repeated snapshots and clock ticks cannot restart the animation.
    setReaction({symbol,text,value,id:reaction.id+1,
      direction:animate ? value! > reaction.value! ? "up" : "down" : undefined});
  }
  const burst = reaction.direction ? reaction : null;

  return (
    <section
      className="price-hero"
      aria-label={`${symbol} ${community ? "market cap" : "price"}`}
      style={{ "--value-em": width } as CSSProperties}
    >
      <div className="hero-main">
        {community && (
          <span
            className="mc-label"
            title="Source token price × on-chain total supply"
          >
            Market cap
          </span>
        )}
        <div
          className="hero-value acid-price-reaction"
          data-price-direction={burst?.direction}
          data-price-raw={feed?.price}
        >
          <Coin symbol={symbol} />
          <strong
            key={burst?.id ?? "quiet"}
            className={burst ? "acid-price-number--reacting" : undefined}
          >
            {whole}
            {cents && <span className="cents">.{cents.slice(0, 2)}</span>}
            {microCents && <span className="micro-cents">{microCents}</span>}
          </strong>
          {burst && (
            <span
              key={`splash-${burst.id}`}
              className="acid-price-splash"
              aria-hidden="true"
            >
              <i className="acid-price-pop" />
              <i className="acid-price-ring" />
              {priceDroplets.map(([x, y, size, rotation], index) => (
                <i
                  key={index}
                  className="acid-price-droplet"
                  style={
                    {
                      "--drop-x": `${x}px`,
                      "--drop-y": `${y}px`,
                      "--drop-size": `${size}px`,
                      "--drop-turn": `${rotation}deg`,
                      "--drop-delay": `${index * 9}ms`,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          )}
        </div>
      </div>
      <div className="hero-caption">
        <div className="hero-market-status">
          <span className={fresh ? "status live" : "status"} />
          <b>${symbol}</b>
          <span aria-hidden="true">·</span>
          <span className="hero-live-label">
            {thesisPreview?'sample price':fresh ? (community ? "live MC" : "live price") : "awaiting price"}
          </span>
        </div>
        <SimplePriceChart feed={feed} symbol={symbol} reaction={burst} />
      </div>
      <PriceChangeTape key={`${symbol}-${feed?.key ?? ""}`} changes={changes} />
    </section>
  );
});
