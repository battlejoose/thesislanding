import { PlatformTokenSvgImage } from './PlatformTokenImage.tsx';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { SettlementIcon } from "./SettlementIcons.tsx";
import { usePlatformTokens } from './PlatformTokens.tsx';
import "./reward-celebration.css";

type Point = { x: number; y: number };
type Geometry = {
  width: number;
  height: number;
  path: string;
  source: Point;
  destination: Point;
  bannerTop: number;
};
type Props = {
  kind: "stake" | "claim";
  amount: string;
  symbol: string;
  root: RefObject<HTMLDivElement>;
  treasury: RefObject<HTMLElement>;
  source: RefObject<HTMLElement>;
  destination: RefObject<HTMLElement>;
  onDismiss: () => void;
  onReplay?: () => void;
};

const STORY_MS = 6600;

/** The route is measured from the real balances; it never replaces those values. */
export function RewardCelebration({
  kind,
  amount,
  symbol,
  root,
  treasury,
  source,
  destination,
  onDismiss,
  onReplay,
}: Props) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [run, setRun] = useState(0);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const pathId = `reward-flow-${useId().replace(/:/g, "")}`;
  const callback = useRef(onDismiss);
  callback.current = onDismiss;
  const isStake = kind === "stake";
  const tokens = usePlatformTokens();
  const ticker = isStake ? `$${tokens.secondary}` : `$${symbol.replace(/^\$/, "")}`;

  useLayoutEffect(() => {
    const measure = () => {
      const element = root.current;
      const area = element?.getBoundingClientRect();
      const bank = treasury.current?.getBoundingClientRect();
      const mouth = source.current?.querySelector("[data-reward-beaker-mouth]");
      const from = (mouth ?? source.current)?.getBoundingClientRect();
      const to = destination.current
        ?.querySelector(".rewards-number")
        ?.getBoundingClientRect();
      if (
        !element ||
        !area ||
        !bank ||
        !from ||
        !to ||
        !area.width ||
        !area.height
      )
        return;
      // DOM rectangles include CSS zoom/ancestor transforms. The overlay's
      // positioning and SVG viewBox use its local CSS pixels instead.
      const width = element.clientWidth,
        height = element.clientHeight;
      if (!width || !height) return;
      const scaleX = area.width / width,
        scaleY = area.height / height;
      const point = (rect: DOMRect): Point => ({
        x: Math.min(width - 5, (rect.right - area.left) / scaleX - 2),
        y: (rect.top - area.top + rect.height / 2) / scaleY,
      });
      const a = {
          x: (from.left - area.left + from.width / 2) / scaleX,
          y: (from.top - area.top + from.height / 2) / scaleY,
        },
        b = point(to);
      const lane = isStake
        ? Math.min(width / 2 - 7, Math.max(a.x, b.x) + 20)
        : width - 7;
      const shoulder = Math.min(lane, a.x + 18);
      const path = `M${a.x} ${a.y} C${shoulder} ${a.y - 5},${lane} ${a.y + 10},${lane} ${a.y + 28} L${lane} ${Math.max(a.y + 28, b.y - 24)} C${lane} ${b.y},${b.x + 12} ${b.y},${b.x} ${b.y}`;
      const next = {
        width,
        height,
        path,
        source: a,
        destination: b,
        bannerTop: (bank.bottom - area.top) / scaleY - 46,
      };
      setGeometry((previous) =>
        previous &&
        previous.width === next.width &&
        previous.height === next.height &&
        previous.path === next.path &&
        previous.bannerTop === next.bannerTop
          ? previous
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (root.current) observer.observe(root.current);
    if (source.current) observer.observe(source.current);
    if (destination.current) observer.observe(destination.current);
    const sourceMouth = source.current?.querySelector("[data-reward-beaker-mouth]");
    const destinationNumber =
      destination.current?.querySelector(".rewards-number");
    if (sourceMouth) observer.observe(sourceMouth);
    if (destinationNumber) observer.observe(destinationNumber);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [root, treasury, source, destination, isStake, amount, run]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (reduced) return;
    const timer = window.setTimeout(() => callback.current(), STORY_MS);
    return () => window.clearTimeout(timer);
  }, [run, reduced]);

  if (!geometry) return null;
  return (
    <div
      className={`reward-celebration reward-celebration-${kind}${reduced ? " reward-celebration-reduced" : ""}`}
    >
      <div
        className="reward-confirmed-receipt"
        style={{ top: geometry.bannerTop }}
      >
        <div className="reward-receipt-icon">
          <SettlementIcon kind={isStake ? "ownership" : "wallet"} size={27} />
        </div>
        <div className="reward-receipt-copy" role="status">
          <span>
            {isStake ? "Available → Staked" : "Available → Your wallet"}
            <i>Confirmed</i>
          </span>
          <strong
            title={`+${amount} ${ticker}`}
            style={
              {
                "--receipt-chars": amount.length + ticker.length,
              } as CSSProperties
            }
          >
            +{amount} <small>{ticker}</small>
          </strong>
        </div>
        <div className="reward-receipt-controls">
          {!reduced && (
            <button
              type="button"
              onClick={() => {
                setRun((value) => value + 1);
                onReplay?.();
              }}
              aria-label="Replay reward transfer"
            >
              ↻
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss reward confirmation"
          >
            ×
          </button>
        </div>
      </div>
      {!reduced && (
        <svg
          key={run}
          className="reward-transfer-art"
          viewBox={`0 0 ${geometry.width} ${geometry.height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <path id={`${pathId}-${run}`} d={geometry.path} />
          </defs>
          <path className="reward-flow-guide" d={geometry.path} />
          <path
            className="reward-flow-liquid"
            d={geometry.path}
            pathLength="100"
          />
          <path
            className="reward-flow-highlight"
            d={geometry.path}
            pathLength="100"
          />
          <g transform={`translate(${geometry.source.x},${geometry.source.y})`}>
            <circle className="reward-source-ripple" r="9" />
            <circle className="reward-source-dot" r="3" />
          </g>
          {Array.from({ length: 7 }, (_, index) => (
            <g key={index} opacity="0">
              <animateMotion
                begin={`${0.45 + index * 0.16}s`}
                dur="1.75s"
                fill="freeze"
                calcMode="paced"
              >
                <mpath href={`#${pathId}-${run}`} />
              </animateMotion>
              <animate
                attributeName="opacity"
                values="0;1;1;0"
                keyTimes="0;.06;.9;1"
                begin={`${0.45 + index * 0.16}s`}
                dur="1.75s"
                fill="freeze"
              />
              {index % 2 ? (
                <>
                  <circle r="2.8" fill="currentColor" />
                  <circle cx="-1" cy="-1" r="0.8" fill="#fffde3" />
                </>
              ) : (
                <g className="reward-flow-token">
                  <circle r="6" />
                  <PlatformTokenSvgImage
                    secondary={isStake}
                    reward={!isStake}
                    x="-4.5"
                    y="-4.5"
                    width="9"
                    height="9"
                  />
                </g>
              )}
            </g>
          ))}
          <g
            transform={`translate(${geometry.destination.x},${geometry.destination.y})`}
          >
            {[0, 1, 2].map((index) => (
              <circle
                key={index}
                className="reward-arrival-ring"
                r="8"
                style={
                  { "--ring-delay": `${2.2 + index * 0.35}s` } as CSSProperties
                }
              />
            ))}
            <circle className="reward-arrival-core" r="5" />
            {Array.from({ length: 16 }, (_, index) => {
              const angle = (index / 16) * Math.PI * 2;
              const distance = 18 + (index % 4) * 6;
              return (
                <g
                  key={index}
                  className="reward-arrival-particle"
                  style={
                    {
                      "--particle-x": `${Math.cos(angle) * distance}px`,
                      "--particle-y": `${Math.sin(angle) * distance}px`,
                      "--particle-delay": `${2.2 + (index % 4) * 0.12}s`,
                    } as CSSProperties
                  }
                >
                  {index % 3 === 0 ? (
                    <path d="M-2.5 0H2.5M0-2.5V2.5" />
                  ) : (
                    <circle r={index % 2 ? 1.7 : 1} />
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      )}
    </div>
  );
}
