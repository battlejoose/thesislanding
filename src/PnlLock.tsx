import './pnl-lock.css';

export function PnlLock({ state }: { state: "price" | "settled" | null }) {
  if (!state) return null;
  const label = state === "price"
    ? "Exit price locked · final profit awaiting collateral settlement"
    : "Profit/loss finalized · any unpaid profit stays in FIFO";
  return <span className={'pnl-lock is-' + state} role="img" aria-label={label} title={label}>
    <svg viewBox="0 0 24 28" fill="none" aria-hidden="true">
      <path className="pnl-lock-shackle" d="M7 13V8a5 5 0 0 1 10 0v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
      <rect x="4" y="12" width="16" height="13" rx="4" fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="1.8"/>
      <path d="m8.5 18.5 2.3 2.3 4.7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path className="pnl-lock-sparks" d="M2 6 0 4M22 6l2-2M12 1V-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  </span>;
}
