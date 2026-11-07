import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { ActivityToastStack } from "./ActivityToastStack.tsx";
import { Coin } from "./components.tsx";
import { WalletToastQueue, type WalletNotice, type WalletToast } from "./wallet-notices.ts";
import "./wallet-effects.css";

export type { WalletNotice } from "./wallet-notices.ts";
const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const format = (value: bigint, decimals: number) => number.format(Number(value) / 10 ** decimals);
type Flight = { id: string; x: number; y: number; dx: number; dy: number; symbol: string };

/** Every observed change gets its own lifetime. The transparent stack never intercepts input. */
export function WalletEffects({ notices }: { notices: WalletNotice[] }) {
  const queue = useRef(new WalletToastQueue());
  const [entries, setEntries] = useState<WalletToast[]>([]);
  const [flight, setFlight] = useState<Flight | null>(null);

  useEffect(() => {
    const now = Date.now();
    const added = queue.current.ingest(notices, now);
    setEntries(queue.current.active(now));
    if (!added.length || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const wallet = document.querySelector(".wallet-container > .wallet")?.getBoundingClientRect();
    const source = (document.querySelector(".rewards-wallet[data-wallet-flight-source]")
      ?? document.querySelector(".position.has-overlay, .actions"))?.getBoundingClientRect();
    const item = added.find(x => x.asset.symbol === "USDC" && x.change.amount > 0n)
      ?? added.find(x => x.change.amount > 0n) ?? added[0];
    if (!wallet || !source || !item) return;
    const incoming = item.change.amount > 0n;
    const from = incoming ? source : wallet, to = incoming ? wallet : source;
    setFlight({ id: item.id, x: from.left + from.width / 2, y: from.top + from.height / 2,
      dx: to.left + to.width / 2 - from.left - from.width / 2,
      dy: to.top + to.height / 2 - from.top - from.height / 2, symbol: item.asset.symbol });
  }, [notices]);

  useEffect(() => {
    if (!entries.length) return;
    const nextExpiry = Math.min(...entries.map(entry => entry.expiresAt));
    const timer = setTimeout(() => setEntries(queue.current.active(Date.now())), Math.max(1, nextExpiry - Date.now()));
    return () => clearTimeout(timer);
  }, [entries]);

  useEffect(() => {
    if (!flight) return;
    const timer = setTimeout(() => setFlight(null), 1500);
    return () => clearTimeout(timer);
  }, [flight]);

  const hasEntries = entries.length > 0;
  return <>
    {hasEntries && <ActivityToastStack side="right" entries={entries.map(entry => ({
      id: entry.id,
      content: <><Coin symbol={entry.asset.symbol} />
        <b className={entry.change.amount > 0n ? "received" : "sent"}>
          {entry.change.amount > 0n ? "+" : "−"}{format(entry.change.amount < 0n ? -entry.change.amount : entry.change.amount, entry.asset.decimals)} ${entry.asset.symbol}
        </b></>,
    }))} />}
    {flight && createPortal(<div className="wallet-flight" aria-hidden="true" key={flight.id} style={{ "--flight-x": `${flight.x}px`, "--flight-y": `${flight.y}px`, "--flight-dx": `${flight.dx}px`, "--flight-dy": `${flight.dy}px` } as CSSProperties}>
      {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ "--i": i, "--scatter": `${(i % 3 - 1) * 35}px` } as CSSProperties}>{flight.symbol === "USDC" ? "$" : "✦"}</span>)}
    </div>, document.body)}
  </>;
}
