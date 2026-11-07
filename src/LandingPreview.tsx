import { appPath } from "./app-url.ts";
import { useEffect, useRef, useState } from 'react';
import { AcidBrand } from './AcidBrand.tsx';
import { Coin } from './components.tsx';
import { PriceHero } from './PriceHero.tsx';
import { LeverageSlider } from './LeverageSlider.tsx';
import { AcidTradeSkin } from './AcidTradeSkin.tsx';
import { startEventStream } from './event-source.ts';
import { listenForSnapshots } from './snapshot-stream.ts';
import { LandingPrices } from './landing-prices.ts';

export const PREVIEW_MINT = '9cRCn9rGT8V2imeM2BaKs13yhMEais3ruM3rPvTGpump';

/** Read-only illustration: shared public prices, no wallet, quotes or transactions. */
export function LandingPreview() {
  const prices = useRef(new LandingPrices());
  const [{ feed, now }, setDisplay] = useState(() => prices.current.read());
  useEffect(() => {
    let stop: (() => void) | undefined;
    const visibility = () => {
      stop?.(); stop = undefined;
      if (!document.hidden) stop = startEventStream(source => {
        source.addEventListener('prices', event => {
          if (document.hidden) return;
          try { prices.current.prices(JSON.parse(event.data)); setDisplay(prices.current.read()); } catch { /* Ignore malformed price frames. */ }
        });
        listenForSnapshots(source, snapshot => {
          if (document.hidden) return;
          prices.current.snapshot(snapshot); setDisplay(prices.current.read());
        });
      });
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    const timer = setInterval(() => { if (!document.hidden) setDisplay(prices.current.read()); }, 1000);
    return () => { stop?.(); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, []);
  return <figure className="landing-preview" aria-label="Illustrative 1 million ANSEM bet at 1000 times leverage, long SOL">
    <a className="landing-preview-open" href={appPath("/trade")} aria-label="Open trading app" />
    <div className="preview-chrome"><AcidBrand /><span>TRADING PREVIEW</span><i /></div>
    <div className="preview-body">
      <div className="preview-toolbar"><span><small>MARKET</small><Coin symbol="SOL" /> $SOL <b>⌄</b></span><span className="preview-wallet"><img src={appPath("/ansem.png")} alt="" />1,000,000 $ANSEM<small>Your bag. Your collateral.</small></span></div>
      <PriceHero feed={feed} symbol="SOL" now={now} />
      <div className="inputs preview-inputs">
        <div className="input-card bet-input"><div className="bet-heading"><span>Bet with</span><span className="preview-token"><img src={appPath("/ansem.png")} alt="" />$ANSEM <b>⌄</b></span></div><strong className="preview-amount">1,000,000</strong><small>1 million tokens</small></div>
        <div className="input-card leverage-card" {...{ inert: '' }}><LeverageSlider value={1000} onChange={() => {}} /></div>
      </div>
      <div className="trade-buttons preview-directions" aria-hidden="true">
        <div className="preview-long"><AcidTradeSkin long /><strong>↑ Long</strong><small>Bet it goes up</small></div>
        <div className="preview-short"><AcidTradeSkin long={false} /><strong>↓ Short</strong><small>Bet it goes down</small></div>
      </div>
    </div>
    <figcaption>Trading preview · live SOL price · trading limits apply</figcaption>
  </figure>;
}
