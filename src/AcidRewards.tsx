import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Coin } from "./components.tsx";
import { LiquidReactor } from "./LiquidReactor.tsx";
import { RewardCelebration } from "./RewardCelebration.tsx";
import { RewardBeaker } from "./RewardBeaker.tsx";
import { usePlatformTokens } from './PlatformTokens.tsx';
import {
  rewardConfirmationDelta,
  type RewardConfirmation,
} from "./reward-confirmation.ts";
import "./acid-rewards.css";

export type { RewardConfirmation } from "./reward-confirmation.ts";

// Modal remounts and account hydration must not replay an old transaction.
const celebratedSignatures = new Set<string>();
const MAX_CELEBRATED_SIGNATURES = 512;

export type AcidRewardsProps = {
  treasury: bigint;
  treasurySymbol?:string;
  treasuryDecimals?:number;
  available: bigint;
  staked: bigint;
  claimable: bigint;
  claimed: bigint;
  walletBalance: bigint;
  walletReady?: boolean;
  decimals: number;
  symbol: string;
  busy: string;
  onStake: () => void;
  onClaim: () => void;
  confirmation?: RewardConfirmation | null;
};

function amount(value: bigint, decimals: number) {
  const scale = 10n ** BigInt(decimals);
  const positive = value < 0n ? -value : value;
  const hundredths = (positive * 100n + scale / 2n) / scale;
  const fraction = (hundredths % 100n)
    .toString()
    .padStart(2, "0")
    .replace(/0+$/, "");
  return `${value < 0n ? "−" : ""}${(hundredths / 100n).toLocaleString("en-US")}${fraction ? `.${fraction}` : ""}`;
}

function NumberValue({
  value,
  decimals,
  className = "",
}: {
  value: bigint;
  decimals: number;
  className?: string;
}) {
  const text = amount(value, decimals);
  return (
    <strong
      className={`rewards-number ${className}`}
      style={{ "--digits": text.length } as CSSProperties}
    >
      {text}
    </strong>
  );
}

function useIncrease(value: bigint, ready = true) {
  const previous = useRef(value);
  const wasReady = useRef(ready);
  const timer = useRef<number>();
  const [change, setChange] = useState<{ amount: bigint; key: number } | null>(
    null,
  );
  useEffect(() => {
    const difference =
      ready && wasReady.current ? value - previous.current : 0n;
    previous.current = value;
    wasReady.current = ready;
    window.clearTimeout(timer.current);
    if (difference <= 0n) {
      setChange(null);
      return;
    }
    setChange({ amount: difference, key: Date.now() });
    timer.current = window.setTimeout(() => setChange(null), 2800);
  }, [value, ready]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return change;
}

/** Every number is a confirmed balance. Liquid movement is decoration; it is
 * deliberately not presented as a made-up percentage of the treasury. */
export function AcidRewards({
  treasury,
  treasurySymbol,
  treasuryDecimals,
  available,
  staked,
  claimable,
  claimed,
  walletBalance,
  walletReady = true,
  decimals,
  symbol,
  busy,
  onStake,
  onClaim,
  confirmation,
}: AcidRewardsProps) {
  const ticker = symbol.replace(/^\$/, "");
  const poolTicker=treasurySymbol??ticker;
  const tokens = usePlatformTokens();
  const walletChange = useIncrease(walletBalance, walletReady);
  const treasuryChange = useIncrease(treasury);
  const rootRef = useRef<HTMLDivElement>(null);
  const treasuryRef = useRef<HTMLElement>(null);
  const stakeSource = useRef<HTMLDivElement>(null);
  const stakeDestination = useRef<HTMLDivElement>(null);
  const claimSource = useRef<HTMLDivElement>(null);
  const claimDestination = useRef<HTMLDivElement>(null);
  const [celebration, setCelebration] = useState<{
    id: string;
    kind: "stake" | "claim";
    amount: bigint;
    run: number;
  } | null>(null);
  useEffect(() => {
    if (!confirmation) {
      setCelebration(null);
      return;
    }
    const delta = rewardConfirmationDelta(confirmation, staked, claimed);
    if (delta === null || celebratedSignatures.has(confirmation.id)) return;
    celebratedSignatures.add(confirmation.id);
    if (celebratedSignatures.size > MAX_CELEBRATED_SIGNATURES) {
      const oldest = celebratedSignatures.values().next().value;
      if (oldest) celebratedSignatures.delete(oldest);
    }
    setCelebration({
      id: confirmation.id,
      kind: confirmation.kind,
      amount: delta,
      run: 0,
    });
  }, [
    confirmation?.id,
    confirmation?.kind,
    confirmation?.before,
    staked,
    claimed,
  ]);
  const totalEarned = claimed + claimable;
  return (
    <div className="acid-rewards" ref={rootRef}>
      <section
        ref={treasuryRef}
        className={`rewards-treasury ${treasuryChange ? "rewards-confirmed" : ""}`}
        aria-label="Pool treasury"
      >
        <div className="rewards-vessel-gauge" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
        <div className="rewards-treasury-copy">
          <div className="rewards-eyebrow">
            <span className="rewards-status-dot" /> Pool treasury
          </div>
          <div className="rewards-treasury-value">
            <Coin symbol={poolTicker} />
            <NumberValue value={treasury} decimals={treasuryDecimals??decimals} />
            <span>${poolTicker}</span>
          </div>
        </div>
        <div className="rewards-liquid">
          <LiquidReactor level={0.4} pulse={treasury.toString()} />
        </div>
        <div className="rewards-vessel-rim" aria-hidden="true" />
      </section>

      <div className="rewards-ledgers">
        <section className="rewards-ledger ownership-ledger">
          <header>
            <div className="rewards-ledger-title">
              <span><i className="rewards-token-dot ownership-dot" />${tokens.secondary}</span>
              <small>Ownership</small>
            </div>
            <div ref={stakeSource} className="rewards-ledger-beaker">
              <RewardBeaker tone="teal" active={available > 0n}
                pourKey={celebration?.kind === "stake" ? `${celebration.id}:${celebration.run}` : undefined} />
            </div>
          </header>
          <dl>
            <div
              className={
                celebration?.kind === "stake" ? "rewards-confirmed-source" : ""
              }
            >
              <dt>Available</dt>
              <dd>
                <NumberValue value={available} decimals={decimals} />
              </dd>
            </div>
            <div
              ref={stakeDestination}
              className={
                celebration?.kind === "stake"
                  ? "rewards-confirmed-destination"
                  : ""
              }
            >
              <dt>Staked</dt>
              <dd>
                <NumberValue
                  value={staked}
                  decimals={decimals}
                  className="rewards-blue"
                />
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="rewards-action rewards-stake"
            disabled={!!busy || available === 0n}
            onClick={onStake}
          >
            <span aria-hidden="true">
              {busy === "stakeOwnership" ? (
                <i className="rewards-spinner" />
              ) : (
                "↓"
              )}
            </span>
            {busy === "stakeOwnership" ? "Staking…" : `Stake $${tokens.secondary}`}
          </button>
        </section>

        <section className="rewards-ledger revenue-ledger">
          <header>
            <div className="rewards-ledger-title">
              <span><i className="rewards-token-dot revenue-dot" />${ticker}</span>
              <small>Revenue</small>
            </div>
            <div ref={claimSource} className="rewards-ledger-beaker">
              <RewardBeaker tone="lime" active={claimable > 0n}
                pourKey={celebration?.kind === "claim" ? `${celebration.id}:${celebration.run}` : undefined} />
            </div>
          </header>
          <dl>
            <div
              className={
                celebration?.kind === "claim" ? "rewards-confirmed-source" : ""
              }
            >
              <dt>Available to claim</dt>
              <dd>
                <NumberValue value={claimable} decimals={decimals} />
              </dd>
            </div>
            <div>
              <dt>Total earned</dt>
              <dd>
                <NumberValue
                  value={totalEarned}
                  decimals={decimals}
                  className="rewards-lime"
                />
              </dd>
            </div>
          </dl>
          <button
            type="button"
            className="rewards-action rewards-claim"
            disabled={!!busy || claimable === 0n}
            onClick={onClaim}
          >
            <span aria-hidden="true">
              {busy === "claimOwnership" ? (
                <i className="rewards-spinner" />
              ) : (
                "↗"
              )}
            </span>
            {busy === "claimOwnership" ? "Claiming…" : "Claim rewards"}
          </button>
        </section>
      </div>

      <section
        className={`rewards-wallet ${walletChange ? "rewards-wallet-arrival" : ""}`}
        aria-label="Current wallet balance"
        data-wallet-flight-source="rewards"
      >
        <div className="rewards-wallet-liquid">
          <LiquidReactor
            level={0.22}
            pulse={walletBalance.toString()}
            tone="acid"
          />
        </div>
        <div className="rewards-wallet-label">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M20 8V5a2 2 0 0 0-2-2L5 6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h15V8H5m15 4h-5v5h5m-3-2.5h.01"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            Your Wallet
          </span>
        </div>
        <div
          ref={claimDestination}
          className={`rewards-wallet-value ${celebration?.kind === "claim" ? "rewards-confirmed-destination" : ""}`}
        >
          <div className="rewards-wallet-amount">
            <span className="rewards-wallet-ticker">${ticker}</span>
            {walletReady ? (
              <NumberValue
                value={walletBalance}
                decimals={decimals}
                className="rewards-lime"
              />
            ) : (
              <strong className="rewards-number rewards-lime">—</strong>
            )}
          </div>
          {walletChange && (
            <span
              key={walletChange.key}
              className="rewards-wallet-delta"
              role="status"
            >
              +{amount(walletChange.amount, decimals)} received
            </span>
          )}
        </div>
      </section>
      <p className="rewards-earned-note">
        Total earned includes available and previously claimed rewards.
      </p>
      {celebration && (
        <RewardCelebration
          key={celebration.id}
          kind={celebration.kind}
          amount={amount(celebration.amount, decimals)}
          symbol={ticker}
          root={rootRef}
          treasury={treasuryRef}
          source={celebration.kind === "stake" ? stakeSource : claimSource}
          destination={
            celebration.kind === "stake" ? stakeDestination : claimDestination
          }
          onDismiss={() => setCelebration(null)}
          onReplay={() => setCelebration(current => current ? {...current, run: current.run + 1} : null)}
        />
      )}
    </div>
  );
}
