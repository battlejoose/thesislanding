import { appPath, sdiceSkin, thesisSkin, appName } from "./app-url.ts";
import { docsHref } from './docs-route.ts';
import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { AcidTutorialFilm } from "./AcidTutorialFilm";
import "./acid-how.css";
import { usePlatformTokens } from './PlatformTokens.tsx';
import type { PlatformTokens } from './platform-tokens.ts';
import { PRODUCTION_POLICY } from './production-policy.ts';

type ChapterKey = "trade" | "fifo" | "loss" | "ownership";
type Note = { title: string; body: ReactNode };
type Chapter = {
  key: ChapterKey;
  tab: string;
  title: string;
  lead: string;
  bullets: ReactNode[];
  notes: Note[];
};
const papertrade = (
  <a
    href="https://docs.papertrade.xyz/#/learn/lp-queue"
    target="_blank"
    rel="noreferrer"
  >
    Papertrade’s FIFO model ↗
  </a>
);
const chaptersFor = (mainnet: boolean, tokens: PlatformTokens): Chapter[] => [
  {
    key: "trade",
    tab: "Trade",
    title: thesisSkin ? '1000× Thesis PERPS' : sdiceSkin ? "1000× SDICE perps" : "1000× acid perps",
    lead: "Trade BTC, ETH, SOL and ZEC with your Pump.fun bags.",
    bullets: [
      <>
        <b>Back other bags.</b> SOL and USDC bets need no extra backing.
      </>,
      <>
        <b>Choose 1×–1000×.</b> USD entry × leverage sets your exposure.
      </>,
      <>
        <b>Watch the bar.</b> Close before reaching your liquidation limit.
      </>,
    ],
    notes: [
      {
        title: "Put dormant bags to work",
        body: (
          <>
            Registered Pump.fun tokens, SOL, USDC and $SDICE can fund a
            position. You get synthetic exposure without buying the underlying
            asset or matching an opposite trade.
          </>
        ),
      },
      {
        title: "Your bag sets the basis",
        body: (
          <>
            Your full bag is quoted at entry and settlement. Profit uses the
            lower of those two USD values. Winners keep their original tokens
            and their core stake. Earlier temporary dips do not set the payout.
          </>
        ),
      },
      {
        title: "Core-token backing",
        body: (
          <>
            For other tokens, open Bet backing: combine SOL and USDC. Each $1 of backing covers
            $1 of bets before leverage. It stays locked until those bets settle.
            If backing falls below their total entry values, the oldest backed
            bets close first. This is separate from staking ${tokens.secondary} for revenue.
          </>
        ),
      },
      {
        title: "Covering collateral depreciation",
        body: (
          <>
            On a loss, core stake covers only the lost tokens' drop in USD value.
            A $100 bag falling to $50 with 20% of tokens lost uses $10 of stake.
            Consumed backing funds the USDC payout pool and earns ${tokens.secondary}. If stake runs out, the trade
            still closes; the pool records the shortfall, with no user debt.
          </>
        ),
      },
      {
        title: "Leverage & liquidation",
        body: (
          <>
            The adverse liquidation move for new positions is 1 ÷ leverage: 0.1% at 1000×.
            Manual closes unlock five seconds after opening; liquidation and backing
            protection stay active during the countdown. Existing positions keep their
            recorded liquidation prices. New positions use the ETH profit-adjustment curve
            across all markets, with no deadband and a 2% reduction after impact.
            Positions opened before activation retain their original terms.
          </>
        ),
      },
      {
        title: "Position limits",
        body: (
          <>
            {`Entries start at $${PRODUCTION_POLICY.minimumEntryUsd}. Leveraged exposure is capped at $${PRODUCTION_POLICY.maximumPositionNotionalUsd.toLocaleString('en-US')} per position and $${PRODUCTION_POLICY.maximumWalletNotionalUsd.toLocaleString('en-US')} across your wallet. Each market direction maintains approximately $${PRODUCTION_POLICY.marketHeadroomUsd.toLocaleString('en-US')} of additional capacity, refreshed every ${PRODUCTION_POLICY.marketCapacityRefreshSeconds} seconds. Available funds and bet backing also apply.`}
          </>
        ),
      },
      {
        title: mainnet ? "Prices & mainnet execution" : "Prices & this devnet",
        body: (
          <>
            {mainnet ? "This production deployment uses real Solana tokens and MagicBlock execution. " : "This ER devnet uses test tokens and its own trading account. "}
            Positions use MagicBlock’s native Pyth Lazer prices. A relay supplies
            fresh collateral pool quotes; trades pause when either price is
            stale. Token swaps and USDC payments settle on Solana {mainnet ? "mainnet" : "devnet"}.
          </>
        ),
      },
    ],
  },
  {
    key: "fifo",
    tab: "FIFO",
    title: "Losses pay winners",
    lead: "Losses build the shared pool. Profit claims wait their turn.",
    bullets: [
      <>
        <b>Win:</b> your collateral returns; profit becomes a USD claim.
      </>,
      <>
        <b>Queue:</b> oldest unpaid claims receive available funds first.
      </>,
      <>
        <b>Collect:</b> funded payouts arrive automatically in the market backing token at spot value.
      </>,
    ],
    notes: [
      {
        title: "A pool built from losses",
        body: (
          <>
            This FIFO, loss-backed liquidity pool can start without seed LP
            capital. Trading losses build it, and profit claims wait for
            available funds. The design is inspired by {papertrade}.
          </>
        ),
      },
      {
        title: "First in, first out",
        body: (
          <>
            Claims stay denominated in USD. Actual pool swap proceeds pay them
            in its backing token at spot, including partial payments from the front of the queue.
            There is no fixed payout time.
          </>
        ),
      },
      {
        title: "Four markets. One pool.",
        body: (
          <>
            BTC, ETH, SOL and ZEC share the ${tokens.primary} payout pool and queue.
            Realized losses refill it. Open collateral stays separate until
            settlement; winning positions return their original collateral.
          </>
        ),
      },
    ],
  },
  {
    key: "loss",
    tab: "Losses",
    title: "A loss with an afterlife",
    lead: `Losses fund payouts and stakers. 1% buys SOL for fees.`,
    bullets: [
      <>
        <b className="acid-how-lime">90% → pool; 10% above $2M.</b> Backs payouts and earns you
        ${tokens.secondary}.
      </>,
      <>
        <b className="acid-how-mint">5% → stakers; 50% above $2M.</b> Distributed as $PERPS
        revenue.
      </>,
      <>
        <b className="acid-how-pink">1% buys SDICE for pSDICE stakers; 1% buys and burns PERPS.</b> Above $2M: 10% rewards pSDICE stakers, 4% buys and burns SDICE, and 5% buys and burns PERPS. USDC is never burned.
      </>,
    ],
    notes: [
      {
        title: "Every realized loss",
        body: (
          <>
            The split uses this market’s pool value immediately before settlement.
            With queued claims, the split is always 99% pool and 1% SOL;
            new staking allocations, operations payments, burns and SDICE contributions pause. Untouched collateral returns
            to your trading balance, available for another bet or withdrawal.
          </>
        ),
      },
      {
        title: "One buy. Actual receipts.",
        body: (
          <>
            Actual swap output funds the USDC payout pool. The staker share buys PERPS for pPERPS stakers. Operations receives 2%, or 20% above $2M, converted to SOL and split equally between two fixed wallets (1% each, or 10% each above $2M).
            Separate allocations fund pSDICE rewards, PERPS buy-and-burn and, above $2M, SDICE burns.
            With queued claims, all post-gas output stays in this market’s pool.
            Small rounding remainders also stay in the pool.
          </>
        ),
      },
      {
        title: "SOL pays the transaction fees",
        body: (
          <>
            The 1% SOL allocation supports transaction fees while the reserve is
            funded and within sponsorship allowances. Swaps still incur DEX fees
            and slippage. Operated keepers perform liquidations, swaps and
            payouts.
          </>
        ),
      },
    ],
  },
  {
    key: "ownership",
    tab: "Ownership",
    title: "Turn rekt into revenue",
    lead: `Your settled loss earns $${tokens.secondary} ownership.`,
    bullets: [
      <>
        <b>Earn:</b> ${tokens.secondary} follows the full quoted loss plus consumed bet backing.
      </>,
      <>
        <b>Stake:</b> your staked share sets your revenue share.
      </>,
      <>
        <b>Claim:</b> collect $PERPS in Pool &amp; Rewards.
      </>,
    ],
    notes: [
      {
        title: "Ownership follows receipts",
        body: (
          <>
            Issuance starts at 100 ${tokens.secondary} per USDC of quoted loss plus consumed backing at full rewards. Full rewards apply through $100K pool value,
            taper evenly to 10% at $1M, and remain at 10% above $1M.
            Each market uses its own pre-settlement pool USD spot value;
            the rate rises again if that value falls.
          </>
        ),
      },
      {
        title: "Revenue for stakers",
        body: (
          <>
            Stakers receive PERPS bought with 5% of losses, or 50% above $2M, only when the FIFO queue is clear. Your
            proportion of total staked ${tokens.secondary} determines your revenue share.
          </>
        ),
      },
      {
        title: "The $5M pool threshold",
        body: (
          <>
            When the queue is empty and there are active stakers, pool value
            above $5M also buys PERPS for stakers. This threshold is not a cap on an
            individual trader’s win.
          </>
        ),
      },
      {
        title: "What ownership means",
        body: (
          <>
            ${tokens.secondary} is a non-transferable on-chain balance for staking and
            revenue participation. It is not a wallet SPL token, equity or
            governance right, a right to redeem pool principal, or a guaranteed
            return.
          </>
        ),
      },
    ],
  },
];

export function AcidHow({ cluster = "devnet" }: { cluster?: string }) {
  const chapters = chaptersFor(cluster === "mainnet-beta", usePlatformTokens());
  const [index, setIndex] = useState(0);
  const [noteIndex, setNoteIndex] = useState<number | null>(null);
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);
  const id = `acid-how-${useId().replace(/:/g, "")}`;
  const chapter = chapters[index];
  const note = noteIndex === null ? null : chapter.notes[noteIndex];

  function select(next: number, focus = false) {
    setIndex(next);
    setNoteIndex(null);
    if (focus) tabs.current[next]?.focus();
  }
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, current: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (current + 1) % chapters.length;
    else if (event.key === "ArrowLeft")
      next = (current + chapters.length - 1) % chapters.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = chapters.length - 1;
    else return;
    event.preventDefault();
    select(next, true);
  }

  return (
    <section className="acid-how" aria-label={`${appName} tutorial`}>
        <a className="acid-how-docs" href={docsHref()} target="_blank" rel="noreferrer">Full docs <span aria-hidden="true">↗</span></a>
      <div
        className="acid-how-tabs"
        role="tablist"
        aria-label={`How ${appName} works`}
      >
        {chapters.map((item, i) => (
          <button
            key={item.key}
            type="button"
            className="acid-how-tab"
            role="tab"
            id={`${id}-tab-${item.key}`}
            aria-controls={`${id}-panel`}
            aria-selected={index === i}
            tabIndex={index === i ? 0 : -1}
            ref={(node) => {
              tabs.current[i] = node;
            }}
            onClick={() => select(i)}
            onKeyDown={(event) => onTabKey(event, i)}
          >
            {item.tab}
          </button>
        ))}
      </div>
      <div
        className={`acid-how-panel acid-how-${chapter.key}${note ? " is-note" : ""}`}
        role="tabpanel"
        id={`${id}-panel`}
        aria-labelledby={`${id}-tab-${chapter.key}`}
      >
        {note && noteIndex !== null ? (
          <>
            <div className="acid-how-note-heading">
              <span>Under the hood</span>
              <span>{chapter.tab}</span>
            </div>
            <article
              className="acid-how-note"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="acid-how-note-number" aria-hidden="true">
                {String(noteIndex + 1).padStart(2, "0")}
              </span>
              <h3>{note.title}</h3>
              <p>{note.body}</p>
            </article>
            <div className="acid-how-note-controls">
              <button
                type="button"
                aria-label="Previous technical note"
                disabled={noteIndex === 0}
                onClick={() => setNoteIndex(noteIndex - 1)}
              >
                ←
              </button>
              <span>
                Note {noteIndex + 1} of {chapter.notes.length}
              </span>
              <button
                type="button"
                aria-label="Next technical note"
                disabled={noteIndex === chapter.notes.length - 1}
                onClick={() => setNoteIndex(noteIndex + 1)}
              >
                →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="acid-how-heading">
              <h3>{chapter.title}</h3>
              <p>{chapter.lead}</p>
              {chapter.key === "fifo" && (
                <p className="acid-how-credit">Inspired by {papertrade}</p>
              )}
            </div>
            <AcidTutorialFilm chapter={chapter.key} />
            <ul className="acid-how-points">
              {chapter.bullets.map((bullet, i) => (
                <li key={`${chapter.key}-${i}`}>{bullet}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <footer className="acid-how-footer">
        <button
          type="button"
          className="acid-how-details-toggle"
          aria-pressed={noteIndex !== null}
          aria-controls={`${id}-panel`}
          onClick={() => setNoteIndex(noteIndex === null ? 0 : null)}
        >
          {noteIndex === null ? "Details +" : "← Overview"}
        </button>
        <span className="acid-how-step">
          <b>{String(index + 1).padStart(2, "0")}</b>
          <span> / 04</span>
        </span>
        <button
          type="button"
          className="acid-how-next"
          onClick={() => select((index + 1) % chapters.length)}
        >
          {index === chapters.length - 1 ? "Trade" : chapters[index + 1].tab}
          <span aria-hidden="true">→</span>
        </button>
      </footer>
    </section>
  );
}
