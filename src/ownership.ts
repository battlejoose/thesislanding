import type { Row } from "./client.ts";
import {spotUsd,spotPayout,spotClaimTokens} from './spot-value.ts';
import { acidSplit, ceil, crossed, isFresh, lossSplit, pnl, sellUsd } from "./math.ts";
import { NATIVE_MINT } from "@solana/spl-token";
import { MAINNET_USDC } from "./deployment-profile.ts";
import { buyOut, routeEstimate, mainnetSolProceeds, mainnetPrimaryReceipt } from "./pump.ts";
import { emissionQuote, POOL_CAP } from "./emissions.ts";
import { displayedPositionPnl } from "./position-order.ts";
import { collateralFresh, collateralUsd } from "./collateral-value.ts";
const SCALE = 1_000_000_000_000_000_000n;
/** Matches the program's next distribution/accrual; never estimates swap issuance. */
export function claimableOwnership(pool?: Row, trader?: Row): bigint {
  if (!pool || !trader) return 0n;
  const total = BigInt(pool.totalStaked);
  const index =
    BigInt(pool.accReward) +
    (total > 0n ? (BigInt(pool.feePending) * SCALE) / total : 0n);
  return (
    BigInt(trader.pending) +
    (BigInt(trader.staked) * (index - BigInt(trader.rewardIndex))) / SCALE
  );
}

/** Loss-swap pool contribution before sweeps or FIFO payouts, recorded in
 * position.swappedOut. Consumed backing is a separate pool contribution. */
export function estimateLossReceipt(
  position: Row,
  feed: Row | undefined,
  pool: Row | undefined,
  collateralQuote: Row | undefined,
  settlementQuote: Row | undefined,
  now = Date.now(),
  treasury?: bigint,
  fullLoss = false,
): bigint | null {
  try {
    if (position.state !== 0 || !pool || !isFresh(feed, now)) return null;
    const margin = BigInt(position.margin);
    // Use token atoms directly: converting the displayed USD loss back into tokens loses precision.
    const tokenPnl = pnl(
      margin,
      BigInt(position.entry),
      BigInt(feed!.price),
      position.leverage,
      position.long,
    );
    const loss = crossed(position, feed!)
      ? margin
      : tokenPnl < 0n
        ? -tokenPnl
        : 0n;
    if (loss === 0n) return 0n;
    const nativeSol = collateralQuote?.id === 103 && collateralQuote.erNative === true;
    if (!(nativeSol ? collateralFresh(collateralQuote, now) : isFresh(collateralQuote, now))) return null;
    const queued = BigInt(pool.queueUsd ?? 0) > 0n || BigInt(pool.queueHead ?? 0) < BigInt(pool.queueTail ?? 0);
    if (treasury !== undefined && (treasury < 0n || !isFresh(settlementQuote,now))) return null;
    const poolUsd=treasury === undefined ? 0n : spotUsd(treasury,settlementQuote!);
    const nativeMarket=!!pool.venue&&((settlementQuote?.id===103&&settlementQuote.erNative===true)||(settlementQuote?.id===104&&settlementQuote.quoteCollateral===true));
    const perps=pool.perpsRewards===true;
    const split = fullLoss ? {acid:loss} : lossSplit(loss, !!pool.venue, queued, poolUsd,nativeMarket,perps);
    const smallLoss=(nativeSol ? collateralUsd(loss,collateralQuote!) : sellUsd(loss,collateralQuote!))<1000n;
    const acidInput=smallLoss?loss:split.acid;
    if (position.collateral === pool.settlement) return smallLoss||fullLoss?loss:acidSplit(acidInput,queued,!!pool.venue,poolUsd,nativeMarket,perps).market;
    if (!isFresh(settlementQuote, now)) return null;
    if (!fullLoss && collateralQuote!.quoteCollateral===true && loss<100n) return 0n;
    if(nativeMarket) {
      if(!isFresh(settlementQuote!.conversionPool,now))return null;
      const sol=mainnetSolProceeds(loss,collateralQuote!);
      const received=mainnetPrimaryReceipt(sol*acidInput/loss,settlementQuote!);
      return smallLoss||fullLoss?received:acidSplit(received,queued,true,poolUsd,true,perps).market;
    }
    if (nativeSol) {
      // Mainnet SOL is already the buy route's quote token. Its zero-reserve
      // collateral row is an oracle value, not a SOL->USDC swap pool. Keep
      // lamports throughout: reserve gas, then buy SDICE once, as settlement.rs.
      if (!settlementQuote!.mainnet || settlementQuote!.quoteMint !== NATIVE_MINT.toBase58() ||
          !payoutQuoteSupported(settlementQuote!, now) ||
          BigInt(settlementQuote!.baseReserve) <= 0n || BigInt(settlementQuote!.quoteReserve) <= 0n ||
          BigInt(settlementQuote!.realQuoteReserve) <= 0n || !Array.isArray(settlementQuote!.feeBps) ||
          settlementQuote!.feeBps.length !== 3 || settlementQuote!.feeBps.some((fee:number)=>!Number.isInteger(fee)||fee<0) ||
          settlementQuote!.feeBps.reduce((sum:number,fee:number)=>sum+fee,0) >= 10_000) return null;
      const received = buyOut(acidInput, settlementQuote!);
      return smallLoss||fullLoss ? received : acidSplit(received,queued,!!pool.venue,poolUsd).market;
    }
    if(collateralQuote!.id===103) {
      const received=routeEstimate(acidInput,collateralQuote!,settlementQuote!);
      return smallLoss||fullLoss?received:acidSplit(received,queued,!!pool.venue,poolUsd).market;
    }
    // One full-size sale, then a 99% primary-token buy.
    const quote=sellUsd(loss,collateralQuote!);
    const acidQuote=quote*acidInput/loss;
    const received=routeEstimate(acidQuote, {key:"quote",id:104,quoteCollateral:true},settlementQuote!);
    return smallLoss||fullLoss?received:acidSplit(received,queued,!!pool.venue,poolUsd).market;
  } catch {
    return null;
  }
}

export type BackingEstimate = { availableTokens: bigint | null; exemptAssets: readonly string[];
  auxiliaryTokens?:readonly bigint[]|null; auxiliaryQuotes?:readonly Row[] };

/** Estimate lost-fraction coverage from cached quotes; execution can add fee-rounding surplus. */
export function estimateBackingReceipt(position: Row, feed: Row | undefined, collateralQuote: Row | undefined,
  settlementQuote: Row | undefined, now: number, backing?: BackingEstimate): bigint | null {
  if (!position.coreBacked || !backing || backing.exemptAssets.includes(position.collateral)) return 0n;
  try {
    if (!isFresh(feed, now)) return null;
    const margin = BigInt(position.margin);
    const tokenPnl = pnl(margin, BigInt(position.entry), BigInt(feed!.price), position.leverage, position.long);
    const loss = crossed(position, feed!) ? margin : tokenPnl < 0n ? -tokenPnl : 0n;
    if (loss === 0n) return 0n;
    if (backing.availableTokens === null || backing.availableTokens < 0n || margin <= 0n || loss > margin ||
        !collateralFresh(collateralQuote, now) || !isFresh(settlementQuote, now)) return null;
    const decline = BigInt(position.entryValue) - collateralUsd(margin, collateralQuote!);
    if (decline <= 0n) return 0n;
    const target = (decline * loss + margin - 1n) / margin;
    if(backing.auxiliaryTokens===null)return null;
    const available=[backing.availableTokens,...(backing.auxiliaryTokens??[0n,0n])];
    const quotes=[settlementQuote!,...[103,backing.exemptAssets[3]?102:104].map(id=>backing.auxiliaryQuotes?.find(q=>q.id===id))];
    const value=(i:number,tokens:bigint)=>collateralUsd(tokens,quotes[i]!);
    const values=available.map((tokens,i)=> {
      if(tokens===0n)return 0n;
      if(tokens<0n||i>0&&quotes[i]?.id===settlementQuote!.id||!collateralFresh(quotes[i],now))throw Error('Invalid backing quote');
      return value(i,tokens);
    });
    const total=values.reduce((a,b)=>a+b,0n);
    if(total===0n)return 0n;
    if(total>(1n<<64n)-1n)return null;
    const covered=target<total?target:total;
    const shares=values.map(v=>covered*v/total);
    let remainder=covered-shares.reduce((a,b)=>a+b,0n);
    for(let i=0;i<3;i++)if(remainder>0n&&shares[i]<values[i]){shares[i]++;remainder--;}
    let receipt=0n;
    for(let i=0;i<3;i++) {
      if(shares[i]===0n)continue;
      let low=1n,high=available[i];
      if(shares[i]===values[i])low=high;
      while(low<high){const mid=low+(high-low)/2n;if(value(i,mid)>=shares[i])high=mid;else low=mid+1n;}
      if(i===0)receipt+=low;
      else {
        if(!isFresh(settlementQuote!.conversionPool,now))return null;
        receipt+=mainnetPrimaryReceipt(mainnetSolProceeds(low,quotes[i]!),settlementQuote!);
      }
    }
    return receipt;
  } catch { return null; }
}

/** Estimate rewards on the full trader loss plus consumed backing. Cached quotes can differ from execution,
 * especially near a pool-size boundary; final issuance uses the confirmed receipt. */
export function estimateOwnership(
  position: Row,
  feed: Row | undefined,
  pool: Row | undefined,
  collateralQuote: Row | undefined,
  settlementQuote: Row | undefined,
  now = Date.now(),
  economics?: { treasury: bigint; highwater: bigint; backing?: BackingEstimate },
): bigint | null {
  const swapped = estimateLossReceipt(
    position,
    feed,
    pool,
    collateralQuote,
    settlementQuote,
    now,
    economics?.treasury,
    true,
  );
  if (swapped === null) return null;
  const covered = estimateBackingReceipt(position, feed, collateralQuote, settlementQuote, now, economics?.backing);
  if (covered === null) return null;
  const net = swapped + covered;
  if (net === 0n) return 0n;
  try {
    // Full trader loss, before all revenue splits, plus consumed backing.
    const bonus = BigInt(pool?.queueUsd ?? 0) > 0n || BigInt(pool?.queueHead ?? 0) < BigInt(pool?.queueTail ?? 0) ? 2n : 1n;
    if (!economics) return net * 100n * bonus;
    if (!isFresh(settlementQuote, now)) return null;
    const before =
      spotUsd(economics.treasury, settlementQuote!);
    const after =
      spotUsd(economics.treasury + net, settlementQuote!);
    return emissionQuote(
      net,
      spotUsd(net, settlementQuote!),
      before,
      after > before ? after - before : 0n,
      economics.highwater,
    ).issued * bonus;
  } catch {
    return null;
  }
}

export type PoolChangeEconomics = {
  treasury: bigint;
  backing?: BackingEstimate;
  snapshotAgeMs: number | null | undefined;
  /** Claim shows the full profit conversion, independently of payout timing. */
  payoutBasis?: "available" | "claim";
};

/** Mainnet pool quotes already include their authenticated SOL/USD conversion.
 * Legacy pools quote USDC directly. This display never fetches a new quote. */
function payoutQuoteSupported(quote: Row, now: number): boolean {
  if(quote.id===103&&quote.erNative===true)return isFresh(quote,now)&&isFresh(quote.conversionPool,now)&&!!quote.spot;
  if(quote.id===104&&quote.quoteCollateral===true)return isFresh(quote,now);
  if (!quote.mainnet) return quote.quoteDecimals === 6 && BigInt(quote.quoteUsd) === 1_000_000_000_000n;
  const conversion = BigInt(quote.mainnet.usdPerQuoteAtomE21);
  const denomination = quote.quoteMint === NATIVE_MINT.toBase58()
    ? quote.quoteDecimals === 9 && conversion === BigInt(quote.quoteUsd)
    : quote.quoteMint === MAINNET_USDC && quote.quoteDecimals === 6 &&
      BigInt(quote.quoteUsd) === 1_000_000_000_000n && conversion === 1_000_000_000_000_000n;
  const stamp = Number(quote.mainnet.conversionPublishTime);
  return denomination && conversion > 0n && conversion <= 1_000_000_000_000_000_000n &&
    stamp > 0 && stamp <= Number(quote.publishTime) &&
    isFresh({ ...quote, price: String(conversion), publishTime: String(stamp) }, now);
}

/** Display-only conversion of unpaid USD profit using the current spot reserves. */
export function estimateProfitTokens(profit: bigint | null, quote: Row | undefined, now = Date.now()): bigint | null {
  if (profit === 0n) return 0n;
  try {
    if (profit === null || profit < 0n || !quote || !isFresh(quote, now) || !payoutQuoteSupported(quote, now)) return null;
    return spotClaimTokens(profit, quote);
  } catch { return null; }
}

/** Signed settlement-token atoms attributed to this position:
 * + loss: the swap's pool allocation plus consumed bet backing,
 *   NOT net treasury growth after cap sweeps or payments to older FIFO claims;
 * - win: estimated backing-token transfer at spot for the next eligible payout,
 *   capped by current treasury; zero while another claim is ahead in FIFO.
 * Claim mode instead quotes the full profit, even if it must wait in FIFO.
 * Closed positions use confirmed receipts only, regardless of quote freshness.
 * null means missing/stale data or an unsupported payout adapter, never zero.
 */
export function estimatePoolChange(
  position: Row,
  feed: Row | undefined,
  pool: Row | undefined,
  collateralQuote: Row | undefined,
  settlementQuote: Row | undefined,
  now = Date.now(),
  economics?: PoolChangeEconomics,
): bigint | null {
  try {
    if (position.state === 1 || position.state === 2) {
      const loss = BigInt(position.loss);
      if (loss < 0n) return null;
      if (loss > 0n) {
        const swapped = BigInt(position.swappedOut), covered = BigInt(position.coverageTokens ?? 0);
        return swapped >= 0n && covered >= 0n ? swapped + covered : null;
      }
      const profit = BigInt(position.profit),
        remaining = BigInt(position.remaining);
      if (profit < 0n || remaining < 0n || remaining > profit) return null;
      if (profit === remaining) return 0n;
      // USD paid cannot reveal token quantities after the settlement price moves.
      const paid = BigInt(position.poolPaidTokens);
      return paid >= 0n ? -paid : null;
    }
    if (
      position.state !== 0 ||
      !pool ||
      !economics ||
      !Number.isFinite(economics.snapshotAgeMs) ||
      economics.snapshotAgeMs! < 0 ||
      economics.snapshotAgeMs! >= 15_000 ||
      economics.treasury < 0n ||
      economics.treasury > 18_446_744_073_709_551_615n
    )
      return null;
    if (position.erPending && feed) feed = { ...feed, price: position.exit, observations: [] };
    const received = estimateLossReceipt(
      position,
      feed,
      pool,
      collateralQuote,
      settlementQuote,
      now,
      economics.treasury,
    );
    if (received === null) return null;
    const covered = estimateBackingReceipt(position, feed, collateralQuote, settlementQuote, now, economics.backing);
    if (covered === null) return null;
    if (received + covered > 0n) return received + covered;
    const entry = BigInt(position.entry),
      exit = BigInt(feed!.price);
    if (
      crossed(position, feed!) ||
      (position.long ? exit <= entry : exit >= entry)
    )
      return 0n;
    if (!isFresh(collateralQuote, now) || !isFresh(settlementQuote, now))
      return null;
    // Use the same cached USD valuation for direct-USDC and SOL-quoted pools.
    if (
      [settlementQuote!].some(
        (quote) =>
          !payoutQuoteSupported(quote, now) ||
          (!(quote.id===103&&quote.erNative||quote.id===104&&quote.quoteCollateral)&&(
          BigInt(quote.baseReserve) <= 0n ||
          BigInt(quote.quoteReserve) <= 0n ||
          !Array.isArray(quote.feeBps) ||
          quote.feeBps.length !== 3 ||
          quote.feeBps.some(
            (fee: number) => !Number.isInteger(fee) || fee < 0,
          ) ||
          quote.feeBps.reduce((sum: number, fee: number) => sum + fee, 0) >=
            10_000)),
      )
    )
      return null;
    const profit = displayedPositionPnl(position, feed, collateralQuote);
    if (profit === null) return null;
    if (profit <= 0n) return 0n;
    if (profit > 18_446_744_073_709_551_615n) return null;
    const head = BigInt(pool.queueHead),
      tail = BigInt(pool.queueTail),
      debt = BigInt(pool.queueUsd);
    if (head < 0n || tail < head || debt < 0n) return null;
    if (economics.payoutBasis !== "claim") {
      if (head < tail) return 0n;
      if (debt > 0n) return null;
    }
    // Close can sweep an over-cap treasury before enqueuing this new win.
    // Without the staking state needed to size that sweep, do not invent a debit.
    if (economics.payoutBasis !== "claim" && spotUsd(economics.treasury, settlementQuote!) > POOL_CAP) return null;
    if(economics.payoutBasis==='claim')return -spotClaimTokens(profit,settlementQuote!);
    const available=economics.treasury;
    if(available===0n||spotUsd(available,settlementQuote!)===0n)return 0n;
    return -spotPayout(profit,available,settlementQuote!).tokens;
  } catch {
    return null;
  }
}
