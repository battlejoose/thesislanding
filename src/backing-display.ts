import type { Row } from './client.ts';
import { backedPositions, coreBacking, hasBackingReserve } from './core-backing.ts';
import {erCollateralFresh} from './collateral-value.ts';

export type BackingDisplayValue = ReturnType<typeof coreBacking>;
/** Display pacing only. Entry checks and oldest-first risk enforcement keep using live quotes. */
export class BackingDisplay {
  private identity = '';
  private next = 0;
  private value?: BackingDisplayValue;
  private quoteSample?: {quote: Row; at: number};
  read(trader: Row | undefined, quote: Row | undefined, exempt: readonly string[], now: number, auxiliaryQuotes:readonly Row[]=[]) {
    // The display clock has no server anchor until the first snapshot arrives.
    // Never let that loading state poison the next refresh deadline.
    if (!Number.isFinite(now)) return {backing:this.value,quoteSample:this.quoteSample,seconds:0};
    // A confirmed stake or position change must not leave the previous capacity on screen.
    const identity = JSON.stringify([trader?.owner, trader?.coreStake,trader?.auxiliaryStakes, exempt,
      trader?.slots?.filter((s: Row) => s.kind === 1).map((s: Row) => [s.nonce,s.state,s.asset,s.entryValue])]);
    if (identity !== this.identity) { this.identity = identity; this.next = 0; this.value = undefined; this.quoteSample = undefined; }
    if (now >= this.next) {
      try {
        const kind=quote?.asset&&quote.asset===exempt[0]?'sol':quote?.asset&&quote.asset===exempt[1]?'usdc':'pool';
        if (quote && erCollateralFresh(quote,now,kind)) this.quoteSample = {quote,at:now};
        if (!hasBackingReserve(trader)) {
          const positions=trader?backedPositions(trader,exempt):[];
          this.value = {value:0n,available:0n,reserved:positions.reduce((n,s)=>n+BigInt(s.entryValue),0n),pending:positions.some(s=>s.state===2),poolShortfall:BigInt(trader?.coreStake?.incurredUsd??0)-BigInt(trader?.coreStake?.repaidUsd??0),forceSlot:undefined};
        } else if (trader && quote) this.value = coreBacking(trader, quote, now, exempt,auxiliaryQuotes);
        else throw Error('Quote unavailable');
        this.next = now + 10_000;
      } catch { /* Keep the last estimate while the countdown says Updating… */ }
    }
    return {backing:this.value,quoteSample:this.quoteSample,seconds:Math.max(0,Math.ceil((this.next-now)/1000))};
  }
}
