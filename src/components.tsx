import { appPath } from "./app-url.ts";
import React, { useRef, useEffect } from "react";
import { MarketLogo } from "./MarketLogo.tsx";
import {tokenImageUrl} from './token-display.ts';
import {usePlatformTokens} from './PlatformTokens.tsx';
/** Shared by static coins and moving settlement chips. Failed images do not retry forever. */
export function useTokenImage(symbol: string, imageUrl?: string) {
  const tokens = usePlatformTokens();
  const [failed, setFailed] = React.useState<ReadonlySet<string>>(() => new Set());
  const platform = symbol === tokens.primary ? tokens.primaryLogo : symbol === tokens.secondary ? tokens.secondaryLogo : undefined;
  const known = ({ACIDPUMP:'/acidpump.svg',SDICE:'/tokens/sdice.png',pSDICE:'/acidpump-teal.svg',aPUMP:'/acidpump-teal.svg',FARTCOIN:'/tokens/fartcoin.png'} as Record<string,string>)[symbol];
  // A venue's token wins over the static symbol map, including ticker collisions.
  const image = [tokenImageUrl(imageUrl), platform ?? known].map(url => url ? appPath(url) : undefined).find(url => url && !failed.has(url));
  return {image, fail: () => {if(image)setFailed(previous => new Set([...previous, image]));}};
}
export const Coin = React.memo(function Coin({ symbol, imageUrl }: { symbol: string; imageUrl?: string }) {
  const {image, fail} = useTokenImage(symbol, imageUrl);
  return <span aria-hidden="true" className={"coin coin-" + symbol}>
    {image ? <img src={image} alt="" decoding="async" referrerPolicy="no-referrer" onError={fail} /> : <MarketLogo symbol={symbol} />}
  </span>;
});
export function Modal({
  title,
  summary,
  close,
  dismissible = true,
  children,
}: {
  title: string;
  summary?: React.ReactNode;
  close: () => void;
  dismissible?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    (ref.current?.querySelector("button") ?? ref.current)?.focus();
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) close();
      if (e.key === "Tab") {
        const items = [
          ...(ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),a[href],input,select",
          ) ?? []),
        ];
        if (!items.length) { e.preventDefault(); ref.current?.focus(); return; }
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", listener);
      before?.focus();
    };
  }, [close, dismissible]);
  return (
    <div className="scrim" onClick={dismissible ? close : undefined}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={summary ? "has-summary" : undefined}>
          <div className="modal-heading">
            <h2>{title}</h2>
            {summary}
          </div>
          {dismissible && <button
            className="icon-button"
            onClick={close}
            aria-label="Close dialog"
          >
            ×
          </button>}
        </header>
        {children}
      </div>
    </div>
  );
}
