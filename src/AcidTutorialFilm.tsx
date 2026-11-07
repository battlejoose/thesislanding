import { useEffect, useId, useRef, useState } from "react";
import { SettlementIcon, type SettlementIconKind } from "./SettlementIcons.tsx";
import "./acid-tutorial-film.css";
import { usePlatformTokens } from './PlatformTokens.tsx';
import { platformCopy } from './platform-tokens.ts';

export type AcidTutorialChapter = "trade" | "fifo" | "loss" | "ownership";
type Point = [number, number];
type Route = [Point, Point, Point, Point];
const DURATION = 14;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const phase = (time: number, start: number, duration = 1.6) =>
  clamp((time - start) / duration);
const tint = {
  acid: "#d8ff68",
  ice: "#a4e7ff",
  mint: "#9bf4d1",
  bag: "#f1d99d",
  fire: "#ffb77d",
};
const stories: Record<
  AcidTutorialChapter,
  { title: string; description: string; captions: [number, string][] }
> = {
  trade: {
    title: "Keep your bag. Trade the move.",
    description:
      "Entry tokens enter on-chain escrow and stay unsold while the position is open. Their USD entry value sets exposure at the selected leverage. Trade BTC, ETH, SOL or ZEC against USD.",
    captions: [
      [0, "Your entry tokens enter on-chain escrow."],
      [3.1, "Your bag stays unsold while the position is open."],
      [6.1, "USD entry value sets your leveraged exposure."],
      [10, "Trade BTC, ETH, SOL or ZEC against USD."],
    ],
  },
  fifo: {
    title: "Losses flow to the oldest claim.",
    description:
      "Realized losses fund the ACIDPUMP payout pool. USD claims are settled oldest first; funded payouts arrive automatically in the market backing token at spot value. The second claim waits for the first.",
    captions: [
      [0, "Realized losses buy $ACIDPUMP for the payout pool."],
      [3, "The oldest USD claim is funded first."],
      [5.6, "Its funded payout arrives automatically in the market backing token at spot value."],
      [8.2, "Then the next claim moves to the front."],
    ],
  },
  loss: {
    title: "Losses fund the payout pool.",
    description:
      "Untouched collateral returns to your balance. One percent of the loss buys SOL for fees. With an empty queue, the USDC pool and PERPS reward allocations depend on pool size. Operations receives two percent in SOL, rising to twenty percent above two million dollars. One percent rewards pSDICE holders and one percent buys and burns PERPS. Above two million dollars, ten percent rewards pSDICE holders, four percent buys and burns SDICE, and five percent buys and burns PERPS. USDC is never burned. While claims are queued, 99 percent funds the payout pool and new revenue allocations pause.",
    captions: [
      [0, "Any untouched remainder returns to your trading balance."],
      [2.2, "Only the lost portion is sold."],
      [4.5, "Pool share: 90%, or 10% above $2M. PERPS rewards: 5%, or 50%. SOL operations: 1% each to two wallets, or 10% each."],
      [7.1, "Burns: 1% PERPS; above $2M, 5% PERPS + 4% SDICE."],
      [10, "Queued claims: 99% pool · 1% SOL; new revenue allocations pause."],
    ],
  },
  ownership: {
    title: "Your loss becomes ownership.",
    description:
      "Pool contributions, including consumed bet backing, earn aPUMP according to the protocol issuance rules. Stake aPUMP for ownership and a share of PERPS rewards, then claim those rewards to your wallet.",
    captions: [
      [0, "Your loss contribution earns $aPUMP."],
      [3.5, "Stake $aPUMP for platform ownership."],
      [6.6, "Stakers accrue their share of $PERPS revenue."],
      [10, "Claim your available rewards into your wallet."],
    ],
  },
};

function location(route: Route, t: number): Point {
  const u = 1 - t;
  return [0, 1].map(
    (axis) =>
      u ** 3 * route[0][axis] +
      3 * u ** 2 * t * route[1][axis] +
      3 * u * t ** 2 * route[2][axis] +
      t ** 3 * route[3][axis],
  ) as Point;
}
const routePath = (r: Route) => `M${r[0]}C${r[1]} ${r[2]} ${r[3]}`;

function Chip({ symbol, size = 6 }: { symbol: string; size?: number }) {
  const tokens = usePlatformTokens();
  symbol = platformCopy(symbol, tokens);
  const owned = symbol === tokens.secondary,
    acid = symbol === tokens.primary;
  const color = owned
    ? tint.ice
    : acid
      ? tint.acid
      : symbol === "SOL"
        ? tint.fire
        : symbol === "USDC"
          ? tint.mint
          : tint.bag;
  return (
    <g className="tutorial-chip" style={{ color }}>
      <circle r={size} fill="#102018" stroke="currentColor" strokeWidth="1.3" />
      {acid ? (
        <image
          href={tokens.primaryLogo}
          x={-size + 1}
          y={-size + 1}
          width={(size - 1) * 2}
          height={(size - 1) * 2}
        />
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
          fontSize={size * 1.12}
          fontWeight="800"
        >
          {owned ? tokens.secondary.slice(0, 1) : symbol === "USDC" ? "$" : symbol === "SOL" ? "≋" : "•"}
        </text>
      )}
    </g>
  );
}

function Flow({
  route,
  start,
  time,
  symbol = "ACIDPUMP",
  color = tint.acid,
  liquid = false,
  duration = 1.8,
  staticMode = false,
}: {
  route: Route;
  start: number;
  time: number;
  symbol?: string;
  color?: string;
  liquid?: boolean;
  duration?: number;
  staticMode?: boolean;
}) {
  const path = routePath(route),
    progress = phase(time, start, duration);
  const active = time >= start && time < start + duration + 1.2;
  const arrow = location(route, 0.65),
    tangent = location(route, 0.67);
  return (
    <g className="tutorial-flow" style={{ color }}>
      <path className="tutorial-flow-rail" d={path} />
      <path
        d="m-3-3 4 3-4 3"
        className="tutorial-flow-arrow"
        transform={`translate(${arrow}) rotate(${(Math.atan2(tangent[1] - arrow[1], tangent[0] - arrow[0]) * 180) / Math.PI})`}
      />
      {liquid && !staticMode && active && (
        <path
          className="tutorial-liquid-flow"
          d={path}
          pathLength="100"
          strokeDasharray="20 120"
          strokeDashoffset={20 - progress * 125}
          opacity={Math.sin(progress * Math.PI) * 0.9}
        />
      )}
      {!staticMode &&
        Array.from({ length: liquid ? 6 : 4 }, (_, index) => {
          const p = (time - start - index * 0.14) / duration;
          if (p < 0 || p > 1) return null;
          const point = location(route, p),
            opacity = Math.min(1, p * 14, (1 - p) * 14);
          return (
            <g key={index} transform={`translate(${point})`} opacity={opacity}>
              {symbol === "USD" ? (
                <path
                  d="m-4 0 4-4 4 4-4 4Z"
                  fill="#d9f7ff"
                  fillOpacity=".18"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
              ) : liquid && index % 2 ? (
                <>
                  <circle r="3" fill="currentColor" />
                  <circle cx="-1" cy="-1" r=".8" fill="#faffde" />
                </>
              ) : (
                <Chip symbol={symbol} />
              )}
            </g>
          );
        })}
    </g>
  );
}

function Burst({
  x,
  y,
  at,
  time,
  color = tint.acid,
  staticMode = false,
}: {
  x: number;
  y: number;
  at: number;
  time: number;
  color?: string;
  staticMode?: boolean;
}) {
  const p = (time - at) / 1.6;
  if (staticMode || p <= 0 || p >= 1) return null;
  return (
    <g transform={`translate(${x} ${y})`} style={{ color }} opacity={1 - p}>
      <circle
        r={7 + p * 28}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.4 * (1 - p)}
      />
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i * Math.PI) / 4,
          distance = 8 + p * (18 + (i % 3) * 5);
        return (
          <circle
            key={i}
            cx={Math.cos(angle) * distance}
            cy={Math.sin(angle) * distance}
            r={1.6 - p * 0.8}
            fill="currentColor"
          />
        );
      })}
    </g>
  );
}

function Icon({
  x,
  y,
  kind,
  color = tint.acid,
  size = 44,
  active = 0,
}: {
  x: number;
  y: number;
  kind: SettlementIconKind;
  color?: string;
  size?: number;
  active?: number;
}) {
  return (
    <g transform={`translate(${x} ${y})`} style={{ color }}>
      <ellipse
        cy={size * 0.43}
        rx={size * 0.57}
        ry="5"
        fill="currentColor"
        opacity={0.05 + active * 0.08}
      />
      <g transform={`translate(${-size / 2} ${-size / 2})`}>
        <SettlementIcon kind={kind} size={size} />
      </g>
    </g>
  );
}

function Pool({
  x,
  y,
  level,
  id,
  time,
  staticMode = false,
  size = 1,
}: {
  x: number;
  y: number;
  level: number;
  id: string;
  time: number;
  staticMode?: boolean;
  size?: number;
}) {
  const tokens = usePlatformTokens();
  const waterY = 17 - clamp(level) * 29,
    wiggle = staticMode ? 0 : Math.sin(time * 2.4) * 2.5;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${size})`}
      className="tutorial-pool"
    >
      <defs>
        <clipPath id={id}>
          <path d="M-26-12C-25 13-17 26 0 27C17 26 25 13 26-12Z" />
        </clipPath>
      </defs>
      <path
        d="M-26-12C-25 13-17 26 0 27C17 26 25 13 26-12Z"
        fill="#18260d"
        stroke="#bddd714d"
        strokeWidth="1.3"
      />
      <g clipPath={`url(#${id})`}>
        <path
          d={`M-34 ${waterY} Q-20 ${waterY - 6 + wiggle} -5 ${waterY} T27 ${waterY} L35 35H-35Z`}
          fill="#c7ff5060"
        />
        <path
          d={`M-34 ${waterY} Q-20 ${waterY - 6 + wiggle} -5 ${waterY} T27 ${waterY}`}
          fill="none"
          stroke="#e0ff88"
          strokeWidth="1.7"
        />
        {[0, 1, 2].map((i) => (
          <circle
            key={i}
            cx={-14 + i * 13}
            cy={staticMode ? 9 - i * 4 : 26 - ((time * 10 + i * 12) % 37)}
            r={i % 2 ? 1.5 : 2.1}
            fill="none"
            stroke="#e7ffac"
            strokeWidth=".8"
            opacity=".7"
          />
        ))}
      </g>
      <path
        d="M-29-12H29M-21-8V-1"
        stroke="#d1f68c"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <image href={tokens.primaryLogo} x="-12" y="-29" width="24" height="24" />
    </g>
  );
}

function Label({
  x,
  y = 139,
  title,
  sub,
  shortTitle,
  shortSub,
  color,
}: {
  x: number;
  y?: number;
  title: string;
  sub?: string;
  shortTitle?: string;
  shortSub?: string;
  color?: string;
}) {
  const tokens = usePlatformTokens();
  title = platformCopy(title, tokens);
  sub = sub === undefined ? sub : platformCopy(sub, tokens);
  shortTitle = shortTitle === undefined ? shortTitle : platformCopy(shortTitle, tokens);
  shortSub = shortSub === undefined ? shortSub : platformCopy(shortSub, tokens);
  return (
    <g textAnchor="middle">
      <text
        x={x}
        y={y}
        className="tutorial-node-label"
        style={color ? { fill: color } : undefined}
      >
        {shortTitle !== undefined ? (
          <>
            <tspan className="tutorial-full-label">{title}</tspan>
            <tspan className="tutorial-short-label">{shortTitle}</tspan>
          </>
        ) : (
          title
        )}
      </text>
      {(sub || shortSub) && (
        <text x={x} y={y + 17} className="tutorial-node-sub">
          {shortSub !== undefined ? (
            <>
              <tspan className="tutorial-full-label">{sub}</tspan>
              <tspan className="tutorial-short-label">{shortSub}</tspan>
            </>
          ) : (
            sub
          )}
        </text>
      )}
    </g>
  );
}

function Trade({
  time,
  id,
  staticMode,
}: {
  time: number;
  id: string;
  staticMode: boolean;
}) {
  const custody = phase(time, 1.7),
    exposure = phase(time, 5.6);
  const points: Point[] = [
    [261, 97],
    [270, 90],
    [279, 93],
    [288, 77],
    [297, 83],
    [306, 72],
    [315, 82],
    [324, 66],
    [333, 70],
    [342, 51],
    [350, 60],
  ];
  const chart = points
    .map((point, index) => `${index ? "L" : "M"}${point}`)
    .join("");
  return (
    <>
      <Flow
        route={[
          [69, 84],
          [93, 59],
          [118, 62],
          [139, 83],
        ]}
        start={0.5}
        time={time}
        color={tint.bag}
        symbol="MEME"
        staticMode={staticMode}
      />
      <Flow
        route={[
          [187, 83],
          [215, 59],
          [231, 65],
          [250, 79],
        ]}
        start={4.5}
        time={time}
        color={tint.ice}
        symbol="USD"
        staticMode={staticMode}
      />
      <Icon x={43} y={85} kind="bag" color={tint.bag} size={47} active={1} />
      <g transform="translate(162 84)" className="tutorial-escrow">
        <path
          d="M-22-9H22L19 25H-19Z"
          fill="#20341e"
          stroke="#a4dc8380"
          strokeWidth="1.4"
        />
        <path
          d="M-13-9V-18A13 13 0 0 1 13-18V-9"
          fill="none"
          stroke="#caff8e"
          strokeWidth="2.4"
        />
        <g opacity={staticMode ? 1 : custody} transform="translate(0 6)">
          <Chip symbol="MEME" size={10} />
        </g>
        <path
          d="m-7 28 5 5 12-13"
          fill="none"
          stroke="#abf3c0"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={custody}
        />
      </g>
      <g className="tutorial-chart">
        <path d="M255 44V111H359" stroke="#86ac7938" fill="none" />
        <path
          d="M255 66H357M255 88H357"
          stroke="#91b57a20"
          strokeDasharray="2 5"
        />
        <path
          d={`${chart}L350 110H261Z`}
          fill={`url(#${id}-chart)`}
          opacity={exposure}
        />
        <path
          d={chart}
          fill="none"
          stroke="#bdff79"
          strokeWidth="2.7"
          pathLength="100"
          strokeDasharray={`${staticMode ? 100 : exposure * 100} 100`}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {!staticMode && exposure > 0 && (
          <circle
            cx={points[Math.min(10, Math.floor(exposure * 10))][0]}
            cy={points[Math.min(10, Math.floor(exposure * 10))][1]}
            r="3.5"
            fill="#edffc8"
          />
        )}
        <text x="307" y="35" textAnchor="middle" className="tutorial-tag">
          1× — 1000×
        </text>
      </g>
      {[
        [402, 48, "BTC", "₿", "#f7c775"],
        [439, 77, "ETH", "◆", "#bdd1ff"],
        [428, 116, "SOL", "≋", "#9ff3cf"],
        [382, 148, "ZEC", "Z", "#e5d077"],
      ].map(([x, y, symbol, glyph, color], index) => (
        <g key={symbol}>
          <path
            d={`M357 79Q383 ${Number(y) - 6} ${x} ${y}`}
            fill="none"
            stroke={String(color)}
            strokeWidth=".8"
            opacity=".18"
          />
          <g
            transform={`translate(${x} ${y})`}
            opacity={
              0.5 + (staticMode ? 0.5 : phase(time, 7 + index * 0.7) * 0.5)
            }
          >
            <circle
              r="15"
              fill="#101c13"
              stroke={String(color)}
              strokeOpacity=".4"
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill={String(color)}
              fontSize="18"
              fontWeight="700"
            >
              {glyph}
            </text>
            <text
              x="0"
              y="28"
              textAnchor="middle"
              className="tutorial-market-label"
            >
              {symbol}
            </text>
          </g>
        </g>
      ))}
      <Label
        x={43}
        title="Your bag"
        sub="Entry token"
        shortTitle="Your bag"
        shortSub="Tokens"
        color={tint.bag}
      />
      <Label
        x={162}
        title="Held unsold"
        sub="On-chain escrow"
        shortTitle="Held"
        shortSub="Unsold"
        color={tint.mint}
      />
      <Label
        x={300}
        title="USD exposure"
        shortTitle="Exposure"
        shortSub="USD"
        color={tint.ice}
      />
      <Burst
        x={162}
        y={85}
        at={2.3}
        time={time}
        color={tint.mint}
        staticMode={staticMode}
      />
    </>
  );
}

function Fifo({
  time,
  id,
  staticMode,
}: {
  time: number;
  id: string;
  staticMode: boolean;
}) {
  const first = phase(time, 5.8),
    second = phase(time, 11),
    level = 0.15 + phase(time, 1.4) * 0.65 - first * 0.25 - second * 0.25;
  return (
    <>
      <Flow
        route={[
          [57, 92],
          [74, 80],
          [91, 79],
          [109, 90],
        ]}
        start={0.3}
        time={time}
        color={tint.bag}
        symbol="MEME"
        staticMode={staticMode}
      />
      <Flow
        route={[
          [152, 83],
          [174, 49],
          [181, 48],
          [204, 56],
        ]}
        start={2.5}
        time={time}
        liquid
        staticMode={staticMode}
      />
      <Flow
        route={[
          [253, 57],
          [316, 29],
          [378, 29],
          [413, 64],
        ]}
        start={4.8}
        duration={2}
        time={time}
        symbol="USDC"
        color={tint.mint}
        staticMode={staticMode}
      />
      <Flow
        route={[
          [152, 98],
          [185, 127],
          [258, 128],
          [296, 110],
        ]}
        start={7.8}
        time={time}
        liquid
        staticMode={staticMode}
      />
      <Flow
        route={[
          [344, 110],
          [381, 126],
          [401, 106],
          [418, 83],
        ]}
        start={10.1}
        time={time}
        symbol="USDC"
        color={tint.mint}
        staticMode={staticMode}
      />
      <Icon x={34} y={89} kind="bag" color={tint.bag} size={41} active={1} />
      <Pool
        x={132}
        y={88}
        level={level}
        id={`${id}-fifo-pool`}
        time={time}
        staticMode={staticMode}
        size={0.94}
      />
      {[
        [228, 59, 1, first],
        [320, 111, 2, second],
      ].map(([x, y, n, paid]) => (
        <g key={n} transform={`translate(${x} ${y})`}>
          <path
            d="M-23-24H17L25-16V23H-23Z"
            fill="#162217"
            stroke={paid > 0 ? tint.mint : "#dddc9670"}
            strokeWidth="1.3"
          />
          <path d="M17-24V-16H25M-17 13H17" stroke="#cbe09b44" fill="none" />
          <text
            y="5"
            textAnchor="middle"
            fontSize="25"
            fontWeight="800"
            fill={paid > 0 ? tint.mint : "#e7e0ad"}
          >
            #{n}
          </text>
          <path
            d="m-8 16 5 5 12-12"
            fill="none"
            stroke="#baff9a"
            strokeWidth="2"
            opacity={paid}
          />
          <text y="42" textAnchor="middle" className="tutorial-node-sub">
            {n === 1 ? "Oldest claim" : "Next claim"}
          </text>
        </g>
      ))}
      <Icon
        x={432}
        y={79}
        kind="wallet"
        color={tint.mint}
        size={49}
        active={first}
      />
      <Label x={34} y={141} title="Loss" color={tint.bag} />
      <Label x={132} y={141} title="Pool" sub="$ACIDPUMP" color={tint.acid} />
      <Label
        x={432}
        y={133}
        title="USDC paid"
        sub="Automatically"
        shortTitle="USDC"
        shortSub="Paid to you"
        color={tint.mint}
      />
      <Burst x={228} y={59} at={4.3} time={time} staticMode={staticMode} />
      <Burst
        x={432}
        y={79}
        at={6.7}
        time={time}
        color={tint.mint}
        staticMode={staticMode}
      />
      <Burst x={320} y={111} at={9.6} time={time} staticMode={staticMode} />
      <Burst
        x={432}
        y={79}
        at={11.9}
        time={time}
        color={tint.mint}
        staticMode={staticMode}
      />
    </>
  );
}

function Loss({
  time,
  id,
  staticMode,
}: {
  time: number;
  id: string;
  staticMode: boolean;
}) {
  const bought = phase(time, 4.3);
  return (
    <>
      <Flow
        route={[
          [35, 65],
          [16, 30],
          [56, 14],
          [102, 23],
        ]}
        start={0.2}
        time={time}
        color={tint.bag}
        symbol="MEME"
        staticMode={staticMode}
      />
      <Flow
        route={[
          [64, 84],
          [79, 66],
          [91, 67],
          [110, 83],
        ]}
        start={2.3}
        time={time}
        color={tint.bag}
        symbol="MEME"
        staticMode={staticMode}
      />
      <Flow
        route={[
          [63, 95],
          [78, 135],
          [100, 154],
          [134, 153],
        ]}
        start={4.3}
        time={time}
        color={tint.fire}
        symbol="SOL"
        staticMode={staticMode}
      />
      <Flow
        route={[
          [159, 78],
          [205, 28],
          [224, 33],
          [266, 41],
        ]}
        start={5}
        time={time}
        liquid
        staticMode={staticMode}
      />
      <Flow
        route={[
          [161, 84],
          [213, 79],
          [229, 86],
          [270, 91],
        ]}
        start={6.4}
        time={time}
        liquid
        color={tint.ice}
        staticMode={staticMode}
      />
      <Flow
        route={[
          [157, 92],
          [204, 143],
          [229, 143],
          [270, 141],
        ]}
        start={7.8}
        time={time}
        liquid
        color={tint.fire}
        staticMode={staticMode}
      />
      <Icon x={40} y={86} kind="bag" color={tint.bag} size={47} active={1} />
      <Label x={40} y={131} title="Your bag" color={tint.bag} />
      <Icon
        x={121}
        y={24}
        kind="wallet"
        color={tint.bag}
        size={29}
        active={phase(time, 1.8)}
      />
      <text x="143" y="28" className="tutorial-node-sub">
        <tspan className="tutorial-full-label">Untouched return</tspan>
        <tspan className="tutorial-short-label">Remainder back</tspan>
      </text>
      <g
        transform={`translate(136 83) rotate(${staticMode ? 0 : Math.min(bought, 1) * 360})`}
      >
        <Icon x={0} y={0} kind="swap" size={47} active={bought} />
      </g>
      <g transform="translate(136 82)" opacity={bought}>
        <Chip symbol="ACIDPUMP" size={10} />
      </g>
      <Label x={137} y={125} title="Token buys" color={tint.acid} />
      <g transform="translate(145 153)">
        <Chip symbol="SOL" size={11} />
      </g>
      <text x="163" y="158" className="tutorial-node-sub" fill={tint.fire}>
        1% SOL · fees
      </text>
      <Pool
        x={291}
        y={40}
        level={0.2 + phase(time, 6.2) * 0.6}
        id={`${id}-loss-pool`}
        time={time}
        staticMode={staticMode}
        size={0.67}
      />
      <Icon
        x={291}
        y={92}
        kind="stakers"
        color={tint.ice}
        size={35}
        active={phase(time, 7.8)}
      />
      <Icon
        x={291}
        y={142}
        kind="burn"
        color={tint.fire}
        size={36}
        active={phase(time, 9.2)}
      />
      {[
        [43, "", "Payout pool", tint.acid],
        [95, "", "PERPS stakers", tint.ice],
        [147, "", "SDICE / PERPS burns", tint.fire],
      ].map(([y, n, label, color]) => (
        <g key={String(label)}>
          <text
            x="320"
            y={Number(y)}
            className="tutorial-split-number"
            fill={String(color)}
          >
            {n}
          </text>
          <text x="320" y={Number(y)} className="tutorial-node-label">
            {label === "Payout pool" ? (
              <>
                <tspan className="tutorial-full-label">Payout pool</tspan>
                <tspan className="tutorial-short-label">Pool</tspan>
              </>
            ) : (
              label
            )}
          </text>
        </g>
      ))}
      <Burst x={291} y={40} at={6.8} time={time} staticMode={staticMode} />
      <Burst
        x={291}
        y={92}
        at={8.2}
        time={time}
        color={tint.ice}
        staticMode={staticMode}
      />
      <Burst
        x={291}
        y={142}
        at={9.6}
        time={time}
        color={tint.fire}
        staticMode={staticMode}
      />
    </>
  );
}

function Ownership({
  time,
  id,
  staticMode,
}: {
  time: number;
  id: string;
  staticMode: boolean;
}) {
  const earned = phase(time, 2.2),
    staked = phase(time, 4.8),
    rewards = phase(time, 7.5),
    claimed = phase(time, 10.7);
  return (
    <>
      <Flow
        route={[
          [60, 83],
          [88, 55],
          [111, 57],
          [125, 80],
        ]}
        start={0.5}
        time={time}
        color={tint.ice}
        symbol="aPUMP"
        staticMode={staticMode}
      />
      <Flow
        route={[
          [160, 82],
          [181, 62],
          [205, 62],
          [220, 82],
        ]}
        start={3}
        time={time}
        color={tint.ice}
        symbol="aPUMP"
        staticMode={staticMode}
      />
      <Flow
        route={[
          [257, 86],
          [282, 58],
          [305, 58],
          [318, 83],
        ]}
        start={5.7}
        time={time}
        liquid
        staticMode={staticMode}
      />
      <Flow
        route={[
          [356, 85],
          [379, 60],
          [400, 61],
          [413, 83],
        ]}
        start={8.5}
        duration={2.1}
        time={time}
        liquid
        staticMode={staticMode}
      />
      <Icon x={40} y={87} kind="bag" color={tint.bag} size={43} active={1} />
      <g transform="translate(142 85)">
        <circle r="25" fill="#19344155" stroke="#8fe1ff55" strokeWidth="1" />
        <Chip symbol="aPUMP" size={19} />
        <path
          d="m-23 22 4 9 6-8m24 0 6 8 4-9"
          stroke="#a4e7ff80"
          strokeWidth="2"
          fill="none"
        />
      </g>
      <Icon
        x={239}
        y={86}
        kind="stakers"
        color={tint.ice}
        size={46}
        active={staked}
      />
      <Pool
        x={336}
        y={86}
        level={0.2 + rewards * 0.6 - claimed * 0.35}
        id={`${id}-ownership-pool`}
        time={time}
        staticMode={staticMode}
        size={0.8}
      />
      <Icon
        x={434}
        y={85}
        kind="wallet"
        color={tint.mint}
        size={47}
        active={claimed}
      />
      <Label
        x={40}
        title="Loss"
        sub="Contributed"
        shortSub="Tokens"
        color={tint.bag}
      />
      <Label x={142} title="$aPUMP" sub="Ownership" color={tint.ice} />
      <Label x={239} title="Stake" sub="Your share" color={tint.ice} />
      <Label x={336} title="Rewards" sub="$PERPS" color={tint.acid} />
      <Label x={434} title="Wallet" sub="Claimed" color={tint.mint} />
      <Burst
        x={142}
        y={85}
        at={2.3}
        time={time}
        color={tint.ice}
        staticMode={staticMode}
      />
      <Burst
        x={239}
        y={86}
        at={4.8}
        time={time}
        color={tint.ice}
        staticMode={staticMode}
      />
      <Burst x={336} y={86} at={7.5} time={time} staticMode={staticMode} />
      <Burst
        x={434}
        y={85}
        at={10.6}
        time={time}
        color={tint.mint}
        staticMode={staticMode}
      />
      <path
        d="m137 45 4 4 8-9"
        stroke={tint.ice}
        strokeWidth="2.5"
        fill="none"
        opacity={earned}
      />
    </>
  );
}

/** One clock drives every droplet, chart point and caption, including pause. */
export function AcidTutorialFilm({
  chapter,
}: {
  chapter: AcidTutorialChapter;
}) {
  const id = `acid-film-${useId().replace(/:/g, "")}`;
  const root = useRef<HTMLElement>(null);
  const elapsed = useRef(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(
    document.visibilityState !== "hidden",
  );
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const tokens = usePlatformTokens();
  const rawStory = stories[chapter];
  const story = { ...rawStory, description: platformCopy(rawStory.description, tokens),
    captions: rawStory.captions.map(([at, text]) => [at, platformCopy(text, tokens)] as [number, string]) };
  const sceneTime = reduced ? DURATION : time;
  const caption = reduced
    ? story.captions[story.captions.length - 1][1]
    : [...story.captions].reverse().find(([at]) => sceneTime >= at)?.[1];
  useEffect(() => {
    elapsed.current = 0;
    setTime(0);
    setPlaying(true);
  }, [chapter]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    if (root.current) observer.observe(root.current);
    const visibility = () =>
      setPageVisible(document.visibilityState !== "hidden");
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    document.addEventListener("visibilitychange", visibility);
    media.addEventListener("change", motion);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      media.removeEventListener("change", motion);
    };
  }, []);
  useEffect(() => {
    if (!playing || !visible || !pageVisible || reduced) return;
    let frame = 0,
      last = performance.now(),
      lastDraw = last;
    const tick = (now: number) => {
      elapsed.current = Math.min(
        DURATION,
        elapsed.current + Math.min((now - last) / 1000, 0.1),
      );
      last = now;
      if (now - lastDraw >= 32 || elapsed.current >= DURATION) {
        setTime(elapsed.current);
        lastDraw = now;
      }
      if (elapsed.current >= DURATION) {
        setPlaying(false);
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, visible, pageVisible, reduced, chapter]);
  const replay = () => {
    elapsed.current = 0;
    setTime(0);
    setPlaying(true);
  };
  return (
    <figure
      className={`acid-tutorial-film acid-tutorial-${chapter}${reduced ? " tutorial-static" : ""}`}
      ref={root}
    >
      <div className="tutorial-film-top">
        <span>
          <i />
          Illustration
        </span>
        <div className="tutorial-film-controls">
          <button
            type="button"
            aria-label={
              playing ? `Pause ${chapter} tutorial` : `Play ${chapter} tutorial`
            }
            disabled={reduced}
            onClick={() =>
              time >= DURATION ? replay() : setPlaying((value) => !value)
            }
          >
            {playing && !reduced ? "Ⅱ" : "▶"}
          </button>
          <button
            type="button"
            aria-label={`Replay ${chapter} tutorial`}
            disabled={reduced}
            onClick={replay}
          >
            ↻
          </button>
        </div>
      </div>
      <svg
        className="tutorial-film-stage"
        viewBox="0 0 480 179"
        role="img"
        aria-labelledby={`${id}-title ${id}-description`}
      >
        <title id={`${id}-title`}>{story.title}</title>
        <desc id={`${id}-description`}>{story.description}</desc>
        <defs>
          <linearGradient id={`${id}-chart`} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#baff6a" stopOpacity=".2" />
            <stop offset="1" stopColor="#baff6a" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="tutorial-stage-floor" d="M8 171H471" />
        {chapter === "trade" ? (
          <Trade time={sceneTime} id={id} staticMode={reduced} />
        ) : chapter === "fifo" ? (
          <Fifo time={sceneTime} id={id} staticMode={reduced} />
        ) : chapter === "loss" ? (
          <Loss time={sceneTime} id={id} staticMode={reduced} />
        ) : (
          <Ownership time={sceneTime} id={id} staticMode={reduced} />
        )}
      </svg>
      <figcaption className="tutorial-film-caption">{caption}</figcaption>
      <div
        className="tutorial-film-timeline"
        role="progressbar"
        aria-label={`${chapter} illustration progress`}
        aria-valuemin={0}
        aria-valuemax={DURATION}
        aria-valuenow={Math.floor(sceneTime)}
      >
        <span style={{ transform: `scaleX(${sceneTime / DURATION})` }} />
        {story.captions.slice(1).map(([at]) => (
          <i key={at} style={{ left: `${(at / DURATION) * 100}%` }} />
        ))}
      </div>
    </figure>
  );
}
