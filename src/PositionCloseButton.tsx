import React, { useEffect, useState } from 'react';
import type { Row } from './client.ts';
import { manualCloseRemainingMs, MIN_MANUAL_HOLD_MS } from './position-hold.ts';
import './position-close-button.css';

export function PositionCloseButton({position, closing, clock, onClose}: {
  position: Row; closing: boolean; clock: () => number; onClose: () => void;
}) {
  const [, tick] = useState(0);
  const remaining = manualCloseRemainingMs(position as Row & {state: number}, clock());
  const counting = remaining !== null && remaining > 0 && !closing;
  // Only the small button animates, only during the initial hold. No polling.
  useEffect(() => {
    if (!counting) return;
    const timer = window.setInterval(() => tick(n => n + 1), 100);
    return () => window.clearInterval(timer);
  }, [counting, position.key, position.openedAt]);
  const seconds = Math.ceil((remaining ?? 0) / 1_000);
  const label = position.erPending ? 'Settling…' : closing && position.state === 0 ? 'Closing…'
    : position.state === 2 ? 'Liquidated' : position.state !== 0 ? 'Closed'
    : remaining === null ? 'Syncing…' : counting ? `${seconds}s` : 'Close';
  return <button className={`position-close-button${counting ? ' is-holding' : ''}`}
    disabled={closing || position.state !== 0 || position.erPending || remaining !== 0}
    aria-busy={closing && position.state === 0}
    aria-label={counting ? `Close available in ${seconds} second${seconds === 1 ? '' : 's'}` : label}
    title={counting ? 'Manual close is available five seconds after opening. Liquidation remains active.' : undefined}
    onClick={() => { if (manualCloseRemainingMs(position as Row & {state: number}, clock()) === 0) onClose(); }}>
    {counting ? <span className="position-hold-countdown">
      <svg viewBox="0 0 32 32" aria-hidden="true"><circle className="hold-track" cx="16" cy="16" r="14" />
        <circle className="hold-progress" cx="16" cy="16" r="14" pathLength="1"
          strokeDasharray="1" strokeDashoffset={remaining / MIN_MANUAL_HOLD_MS} /></svg>
      <span>{label}</span>
    </span> : label}
  </button>;
}
