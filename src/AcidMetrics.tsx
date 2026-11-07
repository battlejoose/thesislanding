import { PlatformTokenSvgImage } from './PlatformTokenImage.tsx';
import { useId, useMemo, type CSSProperties } from "react";
import { Coin } from "./components.tsx";
import type { MetricsModel } from "./metrics-model.ts";
import { treasuryChart } from './treasury-chart.ts';
import "./acid-metrics.css";
import { usePlatformTokens } from './PlatformTokens.tsx';
import { sdiceSkin } from './app-url.ts';
import { RewardDie } from './RewardDie.tsx';

const numbers = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const dollars = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function number(value: number | null | undefined, ready: boolean, usd = false) {
  return ready &&
    value !== null &&
    value !== undefined &&
    Number.isFinite(value)
    ? `${usd ? "$" : ""}${(usd ? dollars : numbers).format(value)}`
    : "—";
}
const digits = (value: string) =>
  ({ "--metrics-digits": Math.max(4, value.length) }) as CSSProperties;
const wallet = (address: string) =>
  address.length > 11
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address || "Unknown";
const timeLabel = (at: number, includeDate = false) =>
  new Date(at).toLocaleString("en-US", {
    ...(includeDate
      ? { month: "short" as const, day: "numeric" as const }
      : {}),
    hour: "numeric",
    minute: "2-digit",
  });

function Fact({
  label,
  unit,
  value,
  tone = "",
  description,
  note,
  usdValue,
  usdLabel,
  usdDescription,
  compactLabel,
  icon = "activity",
}: {
  label: string;
  unit?: string;
  value: string;
  tone?: string;
  description?: string;
  note?: string;
  usdValue?: string;
  usdLabel?: string;
  usdDescription?: string;
  compactLabel?: string;
  icon?: string;
}) {
  return (
    <div className={`metrics-fact ${tone}`}>
      <span className="metrics-fact-icon" aria-hidden="true">
        <MetricIcon kind={icon} />
      </span>
      <dt
        title={description}
        aria-label={description ? `${label}. ${description}` : undefined}
      >
        <span className={compactLabel ? "metrics-label-full" : undefined}>
          {label}
        </span>
        {compactLabel && (
          <span className="metrics-label-compact">{compactLabel}</span>
        )}
        {unit && <small>{unit}</small>}
      </dt>
      <dd title={value} style={digits(value)}>
        {value}
      </dd>
      {usdValue && <span className="metrics-fact-usd" title={usdDescription}>
        <b style={digits(usdValue)}>{usdValue}</b><small>{usdLabel ?? 'USD'}</small>
      </span>}
      {note && <span className="metrics-fact-note">{note}</span>}
    </div>
  );
}

function MetricIcon({ kind }: { kind: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {kind === "volume" ? (
        <>
          <path d="M4 16V9m5 7V5m5 11v-6m5 6V3M3 21h18" />
          <path d="m16 4 3-1 2 3" />
        </>
      ) : kind === "leverage" ? (
        <>
          <path d="m4 19 7-7 4 3 6-11m-6 0h6v6" />
          <path d="M4 5v5m-2-2h5" />
        </>
      ) : kind === "bets" ? (
        <>
          <rect x="3" y="4" width="14" height="14" rx="3" />
          <path d="M8 21h10a3 3 0 0 0 3-3V8M7 9h6m-6 4h4" />
        </>
      ) : kind === "rewards" ? (
        <>
          <path d="m12 3 3 5 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1Z" />
          <path d="m9 12 2 2 4-4" />
        </>
      ) : kind === "burn" ? (
        <path d="M12 2c2 6-4 7-2 11 2-1 3-3 4-5 1 4 6 5 5 10-1 3-4 4-7 4s-7-2-7-6c0-5 6-8 7-14Z" />
      ) : kind === "queue" ? (
        <>
          <path d="M6 3h12M6 21h12M8 3c0 5 0 6 4 9-4 3-4 4-4 9m8-18c0 5 0 6-4 9 4 3 4 4 4 9" />
        </>
      ) : (
        <>
          <path d="M2 12h5l3-8 4 16 3-8h5" />
          <circle cx="17" cy="12" r="2" />
        </>
      )}
    </svg>
  );
}

/** A small decorative acid reservoir. Transform-only bubbles, no render loop. */
function MetricsReactor() {
  const tokens = usePlatformTokens();
  const id = `pulse-reservoir-${useId().replace(/:/g, "")}`;
  return (
    <svg
      className="metrics-reactor"
      viewBox="0 0 150 76"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={id}
          x1="75"
          y1="40"
          x2="75"
          y2="75"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8bffe4" stopOpacity=".85" />
          <stop offset="1" stopColor="#3fe0ce" stopOpacity=".15" />
        </linearGradient>
        <clipPath id={`${id}-token`}><circle cx="75" cy="35" r="21" /></clipPath>
      </defs>
      <ellipse
        cx="75"
        cy="62"
        rx="69"
        ry="11"
        fill="#3fe0ce10"
        stroke="#3fe0ce"
        strokeOpacity=".2"
      />
      <path
        d="M15 47c12 2 17-3 30-2s17 5 30 2 18-1 31 0 21-4 29 0l-7 16c-35 9-71 9-106 0Z"
        fill={`url(#${id})`}
        stroke="#6af4d9"
        strokeWidth="1.2"
      />
      <path
        className="metrics-reactor-wave"
        d="M20 49q15-5 30 0t30 0 30 0 20 0"
        stroke="#efffba"
        strokeWidth="1.5"
      />
      {sdiceSkin && !tokens.venueMint ? <g className="metrics-pool-die" transform="translate(37 -44) scale(1.45)"><RewardDie id={`${id}-green`} /></g> :
        <PlatformTokenSvgImage x="54" y="14" width="42" height="42" clipPath={`url(#${id}-token)`} />}
      {[
        { x: 30, y: 48, r: 3 },
        { x: 118, y: 49, r: 4 },
        { x: 42, y: 51, r: 2 },
        { x: 106, y: 45, r: 2.5 },
      ].map((b, i) => (
        <circle
          className="metrics-reactor-bubble"
          key={i}
          cx={b.x}
          cy={b.y}
          r={b.r}
          stroke={i % 2 ? "#62ffd2" : "#dcff6b"}
          style={{ animationDelay: `${-i * 0.9}s` }}
        />
      ))}
      <path
        d="m24 31 2-4 2 4-2 3Zm98-9 2-4 2 4-2 3Z"
        fill="#c8ff49"
        className="metrics-reactor-fizz"
      />
    </svg>
  );
}

type HistoryPoint = { at: number; value: number | null };

/** Recorded quotes stay solid; missing intervals use explicitly labelled guides. */
function TreasuryHistory({
  points,
  fresh,
}: {
  points: HistoryPoint[];
  fresh: boolean;
}) {
  const id = `metrics-chart-${useId().replace(/:/g, "")}`;
  const chart = useMemo(() => treasuryChart(points), [points]);
  if (!chart)
    return (
      <div className="metrics-history-empty">
        <span className="metrics-empty-chart-mark" aria-hidden="true">
          ⌁
        </span>
        <strong>History starts as data arrives</strong>
        <span>Recorded USD treasury quotes appear here</span>
      </div>
    );
  const showDate =
    new Date(chart.first).toDateString() !==
    new Date(chart.last).toDateString();
  return (
    <div
      className="metrics-history"
      role="img"
      aria-label={`Recorded treasury USD estimates from ${new Date(chart.first).toLocaleString()} to ${new Date(chart.last).toLocaleString()}. ${chart.count} quoted samples.${chart.gaps ? " Dotted connectors indicate missing quotes, not recorded values." : ""}`}
    >
      <div
        className="metrics-history-y"
        aria-hidden="true"
        style={{
          width: `${Math.max(...chart.ticks.map((tick) => number(tick.value, true, true).length)) * 0.6}em`,
        }}
      >
        {chart.ticks.map((tick) => (
          <span key={tick.value} style={{ top: `${tick.y}%` }}>
            {number(tick.value, true, true)}
          </span>
        ))}
      </div>
      <div className="metrics-history-plot">
        {chart.ticks.map((tick) => (
          <i
            key={tick.value}
            className="metrics-history-grid"
            style={{ top: `${tick.y}%` }}
            aria-hidden="true"
          />
        ))}
        <svg
          viewBox="0 0 1000 300"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient
              id={id}
              gradientUnits="userSpaceOnUse"
              x1="0"
              y1="0"
              x2="1000"
              y2="0"
            >
              <stop stopColor="#3fe0ce" />
              <stop offset=".65" stopColor="#7ef3c9" />
              <stop offset="1" stopColor="#d4ff94" />
            </linearGradient>
            <linearGradient id={`${id}-fill`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="300">
              <stop stopColor="#3fe0ce" stopOpacity=".12" />
              <stop offset="1" stopColor="#3fe0ce" stopOpacity="0" />
            </linearGradient>
          </defs>
          {chart.paths.map((path, index) => (
            <g key={index}>
              <path d={path.area} fill={`url(#${id}-fill)`} />
              <path
                d={path.line}
                className="metrics-history-halo"
                stroke={`url(#${id})`}
              />
              <path
                className="metrics-history-line"
                d={path.line}
                stroke={`url(#${id})`}
              />
            </g>
          ))}
          {chart.interruptions.map(gap => (
            <path key={gap.from} className="metrics-history-bridge" d={gap.line}>
              <title>{`Quotes unavailable between ${timeLabel(gap.from, true)} and ${timeLabel(gap.to, true)}. Dotted guide connects recorded samples.`}</title>
            </path>
          ))}
        </svg>
        {chart.isolated.filter(point => point.at !== chart.latest.at).map(point => (
          <span key={point.at} className="metrics-history-sample" style={{left: `${point.x}%`, top: `${point.y}%`}}
            title={`${number(point.value, true, true)} at ${timeLabel(point.at, true)}`} />
        ))}
        <span
          className={`metrics-history-dot${fresh && chart.hasCurrent ? " metrics-history-live" : ""}`}
          style={{ left: `${chart.latestX}%`, top: `${chart.latestY}%` }}
          title={`${number(chart.latest.value, true, true)} at ${new Date(chart.latest.at).toLocaleString()}`}
          aria-hidden="true"
        />
        {chart.count === 1 && (
          <span className="metrics-single-sample">First recorded quote</span>
        )}
      </div>
      <div
        className={`metrics-history-time${chart.single ? " metrics-history-one-time" : ""}`}
      >
        <time dateTime={new Date(chart.first).toISOString()}>
          {timeLabel(chart.first, showDate)}
        </time>
        {!chart.single && (
          <time dateTime={new Date(chart.last).toISOString()}>
            {timeLabel(chart.last, showDate)}
          </time>
        )}
      </div>
      {chart.gaps && (
        <span className="metrics-history-gap-note"><i /> Dotted sections: quotes unavailable</span>
      )}
    </div>
  );
}

/** Recorded history and persistent counters; missing totals are never zero-filled. */
export function AcidMetrics({ model, cluster = 'devnet', onLeaderboard }: { model: MetricsModel; cluster?: string; onLeaderboard?: () => void }) {
  const tokens = usePlatformTokens();
  const claims = model.queue;
  const poolValue = number(model.poolUsd, model.ready, true),
    poolTokens = number(model.poolTokens, model.ready);
  const pending = number(model.queueUsd, model.ready, true);
  const queueEmpty =
    model.ready && model.queueComplete && model.queueCount === 0;
  const burnPartial =
    model.ready && model.burnedTokens !== null && !model.burnComplete;
  const partialVolume = model.ready && !model.volumeComplete;
  return (
    <div
      className={`acid-metrics ${model.ready ? "metrics-ready" : "metrics-loading"}`}
    >
      <div className="metrics-topline">
        <span>Liquidity · rewards · ownership</span>
        {onLeaderboard&&<button className="metrics-leaderboard" onClick={onLeaderboard}>Leaderboard ↗</button>}
        <span className={`metrics-live-badge ${model.stale ? "is-stale" : ""}`}>
          <i />
          {!model.ready
            ? "SYNCING"
            : model.stale
              ? "RECONNECTING"
              : cluster === 'mainnet-beta' ? "LIVE ON MAINNET" : "LIVE ON DEVNET"}
        </span>
      </div>
      <section
        className="metrics-treasury-history"
        aria-label="Payout pool treasury history"
      >
        <header className="metrics-treasury-heading">
          <div>
            <span className="metrics-eyebrow">
              Payout pool <small>USD value</small>
            </span>
            <strong className="metrics-pool-value" style={digits(poolValue)}>
              {poolValue}
            </strong>
          </div>
          <div className="metrics-pool-token">
            <MetricsReactor />
            <span className="metrics-price-status">
              {!model.ready
                ? "Loading"
                : model.stale || !model.quoteFresh
                  ? "Updating price"
                  : "Shared liquidity"}
            </span>
            <span className="metrics-pool-balance" title={`${poolTokens} $${tokens.primary}`}>
              <Coin symbol={tokens.primary} />
              <b style={digits(poolTokens)}>{poolTokens}</b>
              <small>${tokens.primary}</small>
            </span>
          </div>
        </header>
        <TreasuryHistory
          points={model.poolHistory ?? []}
          fresh={model.ready && model.quoteFresh && !model.stale}
        />
        <div className="metrics-chart-caption">
          <span>
            <i />
            Payout liquidity over time
          </span>
          <span>24H · USD ESTIMATE</span>
        </div>
      </section>

      <section className="metrics-totals" aria-label="Platform totals">
        <dl className="metrics-facts">
          <Fact
            label="Bet volume"
            unit="USD"
            value={number(model.betVolumeUsd, model.ready, true)}
            tone="metrics-ice metrics-volume"
            icon="volume"
            description="Original USD collateral value across recorded bets, including recovered history. Never repriced at today's token prices."
          />
          <Fact
            label="Leveraged bet volume"
            compactLabel="Leveraged volume"
            unit="USD"
            value={number(model.leveragedVolumeUsd, model.ready, true)}
            tone="metrics-lime metrics-volume"
            icon="leverage"
            description="Original USD entry value multiplied by each bet's leverage, summed across recorded bets."
          />
          <Fact
            label="Total bets"
            value={number(model.trades, model.ready)}
            icon="bets"
            usdValue={number(model.betVolumeUsd, model.ready, true)}
            usdLabel="bet value"
            usdDescription="Total original USD bet value, before leverage."
          />
          <Fact
            label="Open bets"
            value={number(model.openPositions, model.ready)}
            tone="metrics-ice"
            usdValue={number(model.openNotionalUsd, model.ready, true)}
            usdLabel="leveraged"
            usdDescription="Combined USD leveraged value of all open bets."
          />
          <Fact
            label="Rewards paid"
            unit={`$${tokens.primary}`}
            value={number(model.rewardsPaidTokens, model.ready)}
            usdValue={number(model.rewardsPaidUsd, model.ready, true)}
            usdLabel="current USD"
            usdDescription="Estimated value of claimed reward tokens at the current token price, not their historical USD payout value."
            tone="metrics-lime"
            icon="rewards"
            description={`Confirmed ${tokens.primary} rewards claimed by stakers; excludes unclaimed or reserved rewards.`}
          />
          <Fact
            label="Tokens burned"
            compactLabel="Burned"
            unit={`$${tokens.primary}`}
            value={number(model.burnedTokens, model.ready)}
            usdValue={number(model.burnedUsd, model.ready, true)}
            usdLabel="current USD"
            usdDescription="Estimated value of verified burned tokens at the current token price, not their historical USD value."
            tone="metrics-ember"
            icon="burn"
            description={`Actual burned ${tokens.primary} amounts from recorded settlement receipts, never inferred from today's allocation percentage.`}
            note={burnPartial ? "Partial history" : undefined}
          />
        </dl>
        {(!model.ready || partialVolume) && (
          <p className="metrics-history-note">
            {!model.ready ? "Loading confirmed totals…" : "Recorded volume"}
            {partialVolume && model.historyCoverage && (
              <span>
                {" "}
                · {numbers.format(model.historyCoverage.recordedTrades)} /{" "}
                {numbers.format(model.historyCoverage.totalTrades)} bets
                verified · partial history
              </span>
            )}
          </p>
        )}
      </section>

      <section
        className="metrics-fifo"
        aria-label="First in first out payout queue"
      >
        <header>
          <div>
            <h3>
              <MetricIcon kind="queue" />
              FIFO queue{" "}
              <span>
                {model.ready ? numbers.format(model.queueCount) : "—"}
              </span>
            </h3>
            <small>
              {model.ready && !model.queueComplete
                ? "Refreshing queue"
                : "First in. First paid."}
            </small>
          </div>
          <strong
            className="metrics-queue-total"
            title={pending}
            style={digits(pending)}
          >
            {pending}
            <small>AWAITING PAYOUT</small>
          </strong>
        </header>
        <ol className="metrics-queue-list" tabIndex={0} aria-label="Scrollable FIFO claims">
          {claims.map((claim) => (
            <li
              key={claim.key}
              title={`Sequence ${claim.sequence} · ${claim.owner}`}
            >
              <span className="metrics-queue-place">#{claim.sequence}</span>
              <span className="metrics-queue-owner">{wallet(claim.owner)}</span>
              <strong style={digits(number(claim.remainingUsd, true, true))}>
                {number(claim.remainingUsd, true, true)}
              </strong>
            </li>
          ))}
          {!claims.length && (
            <li className="metrics-queue-empty">
              <span className="metrics-queue-clear-mark" aria-hidden="true">
                <svg viewBox="0 0 40 40" fill="none">
                  <circle
                    cx="20"
                    cy="20"
                    r="17"
                    stroke="currentColor"
                    strokeOpacity=".2"
                  />
                  <path
                    d="m12 20 5 5 11-11"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    className="metrics-queue-orbit"
                    cx="20"
                    cy="3"
                    r="2"
                    fill="currentColor"
                  />
                </svg>
              </span>
              <span>
                {queueEmpty
                  ? "Queue clear"
                  : model.ready
                    ? "Refreshing queue"
                    : "Loading on-chain data…"}
              </span>
              {queueEmpty && (
                <small>No pending claims. Ready for the next win.</small>
              )}
            </li>
          )}
        </ol>
        <footer>
          <span>
            {!model.queueComplete && model.ready
              ? "Refreshing queue · oldest first"
              : "Losses fund the pool. The pool pays winners."}
          </span>
          <span className="metrics-auto-usdc"><Coin symbol="USDC" /> Auto payouts</span>
        </footer>
      </section>
    </div>
  );
}
