import { useEffect, useRef, useState } from "react";
import type { AssetInfo, Row } from "./client.ts";
import { ActivityToastStack } from "./ActivityToastStack.tsx";
import { Coin } from "./components.tsx";
import { SwapToastQueue, type SwapToast } from "./swap-notices.ts";

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const format = (amount: bigint, decimals: number) => number.format(Number(amount) / 10 ** decimals);
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function SwapEffects({ positions, pools, assets, quotes, ready }: {
  positions: Row[]; pools: Row[]; assets: ReadonlyMap<string, AssetInfo>; quotes: Row[]; ready: boolean;
}) {
  const queue = useRef(new SwapToastQueue());
  const [entries, setEntries] = useState<SwapToast[]>([]);
  useEffect(() => {
    if (!ready) return;
    const now = Date.now();
    queue.current.ingest(positions, pools, assets, now, quotes);
    setEntries(queue.current.active(now));
  }, [positions, pools, assets, quotes, ready]);
  useEffect(() => {
    if (!entries.length) return;
    const timer = setTimeout(() => setEntries(queue.current.active(Date.now())),
      Math.max(1, Math.min(...entries.map(entry => entry.expiresAt)) - Date.now()));
    return () => clearTimeout(timer);
  }, [entries]);
  return entries.length ? <ActivityToastStack side="left" entries={entries.map(entry => ({
    id: entry.id,
    content: <span className="swap-toast-content" aria-label={`${format(entry.input, entry.from.decimals)} $${entry.from.symbol} loss converted; ${format(entry.output, entry.to.decimals)} $${entry.to.symbol} bought, net of gas allocation and swap fees`}>
      <span className="swap-toast-pair">
        <span className="swap-toast-token swap-input"><Coin symbol={entry.from.symbol} /><b>${entry.from.symbol}</b></span>
        <span className="swap-arrow" aria-label="swapped to">→</span>
        <span className="swap-toast-token"><Coin symbol={entry.to.symbol} /><b>${entry.to.symbol}</b></span>
      </span>
      <b className="swap-toast-usd" aria-label="Estimated value of pool tokens received">
        {entry.usd === null ? "$—" : `≈ ${dollars.format(Number(entry.usd) / 1e6)}`}
      </b>
    </span>,
  }))} /> : null;
}
