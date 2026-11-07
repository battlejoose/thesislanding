import { memo, useMemo } from "react";
import type { Row } from "./client.ts";
import { priceTimeline, timelineLabel } from "./price-timeline.ts";
import "./price-timeline.css";

export const SimplePriceChart = memo(function SimplePriceChart({feed, symbol, reaction}: {
  feed?: Row; symbol: string; reaction?: {id: number; direction?: "up" | "down"} | null;
}) {
  const chart = useMemo(() => priceTimeline(feed), [feed]);
  return <div className="simple-price-chart" data-price-raw={feed?.price}
    data-price-sequence={feed?.displaySequence ?? feed?.sourceSlot ?? feed?.sequence}>
    <svg className={`sparkline ${chart && chart.trend > 0 ? "positive" : chart && chart.trend < 0 ? "negative" : ""}`}
      viewBox="0 0 300 24" preserveAspectRatio="none" role="img" aria-label={`${symbol} recent price trend, last 30 seconds`}>
      <title>Recent on-chain price observations · gaps indicate unavailable updates</title>
      {chart && <><path d={chart.path}/>
        <g className="simple-chart-live-point" data-direction={reaction?.direction}>
          {reaction?.direction && <circle key={reaction.id} className="simple-chart-tick-pulse" data-tick-id={reaction.id}
            cx={chart.lastX} cy={chart.lastY} r="2.5"/>}
          <circle cx={chart.lastX} cy={chart.lastY} r="2" fill="currentColor"/>
        </g>
      </>}
    </svg>
    <div className="price-timeline" aria-label="Chart timeline, minutes and seconds in your local time"
      title="Last 30 seconds · local time · source price timestamps">
      {chart?.ticks.map(tick => <span key={tick.time} className="price-timeline-tick"
        data-time={tick.time} data-wide-label={tick.time % 10 === 0} data-narrow-label={tick.time % 15 === 0}
        style={{left:`${tick.left}%`}}><i/><time dateTime={new Date(tick.time * 1000).toISOString()}
          title={new Date(tick.time * 1000).toLocaleTimeString()}>{timelineLabel(tick.time)}</time></span>)}
    </div>
  </div>;
});
