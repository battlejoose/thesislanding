import { PlatformTokenSvgImage } from './PlatformTokenImage.tsx';
import { memo, useId, type CSSProperties } from "react";
import "./reward-beaker.css";
import { usePlatformTokens } from './PlatformTokens.tsx';
import { appPath, sdiceSkin, thesisSkin } from './app-url.ts';
import { RewardDie } from './RewardDie.tsx';

type RewardBeakerProps = {
  tone: "teal" | "lime";
  active: boolean;
  onClick?: () => void;
  /** A confirmed transfer key; changing it replays the pour. */
  pourKey?: string;
};

/** Fixed-size glass indicators: reward changes never move the surrounding UI. */
export const RewardBeaker = memo(function RewardBeaker({ tone, active, onClick, pourKey }: RewardBeakerProps) {
  const tokens = usePlatformTokens();
  const id = useId().replace(/:/g, "");
  const chamber = `reward-beaker-chamber-${id}`;
  const glass = `reward-beaker-glass-${id}`;
  const liquid = `reward-beaker-liquid-${id}`;
  const air = `reward-beaker-air-${id}`;
  const filled = active || Boolean(pourKey);
  const status = tone === "teal"
    ? `Staking: ${active ? "tokens available to stake" : "no tokens available to stake"}`
    : `Revenue rewards: ${active ? "rewards available to claim" : "no rewards available to claim"}`;
  const label = `${status}${onClick ? ". Open pool and rewards" : ""}`;
  const Vessel = onClick ? "button" : "div";

  return (
    <Vessel
      type={onClick ? "button" : undefined}
      role={onClick ? undefined : "img"}
      className={`reward-beaker reward-beaker--${tone}${active ? " is-active" : ""}${pourKey ? " is-pouring" : ""}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {active && <span className="reward-beaker-claim" aria-hidden="true">CLAIM NOW</span>}
      <svg key={pourKey ?? "idle"} className="reward-beaker-vessel" viewBox="0 0 52 80" fill="none" aria-hidden="true" focusable="false">
        <g className="reward-beaker-body">
          <defs>
            <linearGradient id={glass} x1="8" y1="42" x2="45" y2="42" gradientUnits="userSpaceOnUse">
              <stop stopColor="currentColor" stopOpacity=".17" />
              <stop offset=".26" stopColor="currentColor" stopOpacity=".025" />
              <stop offset=".75" stopColor="currentColor" stopOpacity=".045" />
              <stop offset="1" stopColor="currentColor" stopOpacity=".2" />
            </linearGradient>
            <linearGradient id={liquid} x1="26" y1="42" x2="26" y2="71" gradientUnits="userSpaceOnUse">
              <stop stopColor="currentColor" stopOpacity=".75" />
              <stop offset="1" stopColor="currentColor" stopOpacity=".24" />
            </linearGradient>
            <clipPath id={chamber}>
              <path d="M10 21H41V63C41 68 38 71 33 71H18C13 71 10 68 10 63Z" />
            </clipPath>
            <clipPath id={air}><rect x="11" y="24" width="29" height="18" /></clipPath>
          </defs>

          {filled && <path className="reward-beaker-aura" d="M8 21V63C8 70 12 73 18 73H33C40 73 43 69 43 63V21" />}
          <path className="reward-beaker-glass" d="M8 21V63C8 70 12 73 18 73H33C40 73 43 69 43 63V21" fill={`url(#${glass})`} />

          {filled && (
            <g clipPath={`url(#${chamber})`}>
              <g className="reward-beaker-fill">
                <path className="reward-beaker-wave reward-beaker-wave-back" d="M-16 46Q-10 43-4 46T20 46T44 46T68 46V77H-16Z" />
                <path className="reward-beaker-wave" d="M-16 46Q-10 43-4 46T20 46T44 46T68 46V77H-16Z" fill={`url(#${liquid})`} />
                <path className="reward-beaker-wave reward-beaker-surface" d="M-16 46Q-10 43-4 46T20 46T44 46T68 46" />
                <g className="reward-beaker-bubbles">
                  <circle cx="15" cy="66" r="1.3" />
                  <circle cx="34" cy="68" r="1.8" />
                  <circle cx="23" cy="62" r="1" />
                  <circle cx="37" cy="59" r="1" />
                </g>
              </g>
            </g>
          )}

          {sdiceSkin && active && <g className="reward-beaker-charge" clipPath={`url(#${air})`}>
            {Array.from({length:12},(_,i)=><g key={i} transform={`translate(${14+(i*7)%23} ${27+(i*5)%13})`}>
              <g className="reward-beaker-charge-spark" style={{
                '--charge-color':['#79ffff','#ff7fe7','#ffe76a','#ae97ff','#8dff9d','#ffb070'][i%6],
                '--charge-x':`${i%2?4:-4}px`, '--charge-y':`${-3-i%4}px`,
                animationDelay:`${-i*.19}s`, animationDuration:`${1.4+i%4*.24}s`,
              } as CSSProperties}>
                {i%3===0?<path d="M0-2.6 .65-.65 2.6 0 .65.65 0 2.6-.65.65-2.6 0-.65-.65Z"/>:
                  i%3===1?<path d="M-1.6-1.6 1.6 1.6M1.6-1.6-1.6 1.6"/>:<circle r="1.15"/>}
              </g>
            </g>)}
          </g>}
          <path className="reward-beaker-measures" d="M35 30H40M37 37H40M35 44H40M37 51H40" />
          <path className="reward-beaker-reflection" d="M12 26V41M12 47V53M15 68C17 70 20 70 23 70" />
          <path className="reward-beaker-lip" d="M7 18H44L47 21H43V24H8V21H5L7 18Z" />
          <path className="reward-beaker-rim" d="M9 20H40" />
          <circle data-reward-beaker-mouth cx="44" cy="20" r=".1" opacity="0" />

          {thesisSkin ? <image className="reward-beaker-logo" href={appPath('/thesis-brand/mark.png')}
            x="11" y="48" width="29" height="24" /> : sdiceSkin && !tokens.venueMint ? <RewardDie id={id} /> : <PlatformTokenSvgImage
            className="reward-beaker-logo"
            secondary={tone === "teal"}
            reward={tone !== "teal"}
            x="11"
            y="48"
            width="29"
            height="24"
          />}

          {filled && (
            <g className="reward-beaker-fizz">
              <circle className="reward-beaker-escape" cx="14" cy="18" r="1.8" />
              <circle className="reward-beaker-escape" cx="26" cy="18" r="2.2" />
              <circle className="reward-beaker-escape" cx="37" cy="19" r="1.3" />
              <circle className="reward-beaker-escape" cx="21" cy="17" r=".9" />
              {active && !sdiceSkin && <g className="reward-beaker-fireworks">{Array.from({length:8},(_,i)=><path key={i}
                className="reward-beaker-spark" d="M26 15V21M23 18H29"/>)}</g>}
            </g>
          )}
        </g>
      </svg>
    </Vessel>
  );
});
