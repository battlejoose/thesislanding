import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { AssetInfo, Row } from './client.ts';
import { Coin, useTokenImage } from './components.tsx';
import { MarketLogo } from './MarketLogo.tsx';
import { SettlementIcon, type SettlementIconKind } from './SettlementIcons.tsx';
import { SettlementTxLinks } from './SettlementTxLinks.tsx';
import { settlementTransactions, solscanTransaction } from './settlement-transactions.ts';
import { SETTLEMENT_STORY_MS, settlementAllocationKey, settlementReceiptPending, settlementClaimAmounts, settlementWalletPayout, settlementWalletTokenPayout, settlementStory, storyAmountText, type StoryAmount } from './settlement-story.ts';
import './settlement-receipt.css';
import { positionProfitTokens } from './position-profit-display.ts';
import { usePlatformTokens } from './PlatformTokens.tsx';
import { PlatformTokenImage } from './PlatformTokenImage.tsx';

const positive = (v?: StoryAmount) => v?.atoms !== null && v?.atoms !== undefined && v.atoms > 0n;
function Amount({ value, ticker = false, currencyInTicker = false }: { value: StoryAmount; ticker?: boolean; currencyInTicker?: boolean }) {
  const text = currencyInTicker ? storyAmountText(value).replace('$', '') : storyAmountText(value);
  const stackedTicker = ticker && text.length + value.symbol.length > 24;
  return <span className={'journey-amount' + (stackedTicker ? ' journey-long-amount' : '')} title={text + ' $' + value.symbol}
    style={{ '--amount-chars': Math.max(5, text.length + (ticker && !stackedTicker ? value.symbol.length + 2 : 0)) } as CSSProperties}>
    <strong>{text}</strong>{ticker && <span>{(currencyInTicker ? '' : '$') + value.symbol}</span>}
  </span>;
}
/** Moving chips keep their asset identity; green liquid starts only after the swap. */
function Token({ symbol, imageUrl, radius = 6, queued = false }: { symbol: string; imageUrl?: string; radius?: number; queued?: boolean }) {
  const tokens = usePlatformTokens();
  const {image, fail} = useTokenImage(symbol, imageUrl);
  const owned = symbol === tokens.secondary, usd = symbol === 'USDC', acid = symbol === tokens.primary;
  const color = queued ? '#e6d58d' : owned ? '#9addff' : usd ? '#8bdcd8' : acid ? '#d0ff56' : '#f0d797';
  return <g className="journey-token">
    <circle r={radius} fill={acid ? '#1c3910' : owned ? '#123449' : '#152821'} stroke={color} strokeWidth="1.2" />
    {usd ? <svg className="journey-usdc-chip" x={-radius + 1} y={-radius + 1} width={(radius - 1) * 2} height={(radius - 1) * 2} viewBox="0 0 32 32" stroke="none"><MarketLogo symbol="USDC"/></svg>
      : image ? <image href={image} onError={fail} x={-radius + 1} y={-radius + 1} width={(radius - 1) * 2} height={(radius - 1) * 2} />
      : <text textAnchor="middle" dominantBaseline="central" fill={color} fontSize={owned ? radius : radius * 1.25} fontWeight="700">{symbol.slice(0, 1)}</text>}
  </g>;
}
function Transfer({ path, start, symbol, imageUrl, liquid = false, enabled, reduced, duration = 1.2, color = 'acid' }: {
  path: string; start: number; symbol: string; imageUrl?: string; liquid?: boolean; enabled: boolean; reduced: boolean; duration?: number; color?: string;
}) {
  if (!enabled) return null;
  return <g className={'journey-transfer tone-' + color}>
    <path className="journey-route" d={path} />
    {liquid && <path className="journey-pour" d={path} pathLength="100" style={{ '--at': start + 's', '--travel-time': duration + 's' } as CSSProperties} />}
    {!reduced && Array.from({ length: liquid ? 5 : 3 }, (_, i) => {
      const begin = start + i * (liquid ? .11 : .19);
      return <g key={i} opacity="0">
        <animateMotion path={path} begin={begin + 's'} dur={duration + 's'} fill="freeze" calcMode="paced" />
        <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;.08;.88;1" begin={begin + 's'} dur={duration + 's'} fill="freeze" />
        {liquid ? <><circle r={i % 2 ? 2.3 : 3.4} fill="currentColor" /><circle cx="-3" cy="-1" r="1" fill="#f2ffd6" /></> : <Token symbol={symbol} imageUrl={imageUrl} queued={color === 'queue'} />}
      </g>;
    })}
  </g>;
}
function Destination({ x, kind, label, amount, at, tone = 'acid', children, ticker = true, signatures, cluster, tokenAmount, estimated = false, legacyAmount }: {
  tokenAmount?: StoryAmount; estimated?: boolean; legacyAmount?: StoryAmount;
  x: number; kind: SettlementIconKind; label: string; amount: StoryAmount; at: number; tone?: string; children?: ReactNode; ticker?: boolean;
  signatures?: string[]; cluster: string;
}) {
  const tokens = usePlatformTokens();
  return <div className={'journey-destination destination-' + kind + ' tone-' + tone + (positive(amount) ? ' journey-receives' : ' journey-empty')}
    style={{ left: x + '%', '--at': at + 's', '--label-chars': label.length } as CSSProperties}>
    <div className="journey-destination-art"><SettlementIcon kind={kind} size={38} />
      {['pool', 'stakers', 'burn'].includes(kind) && <PlatformTokenImage className={'journey-acid-emblem emblem-' + kind} alt="" aria-hidden="true"/>}
      {['payout', 'queue'].includes(kind) && <span className={'journey-token-emblem token-emblem-' + kind}><Coin symbol={tokenAmount?.symbol ?? amount.symbol}/></span>}
      {children}<i className="journey-arrival" aria-hidden="true" /></div>
    <span className="journey-label">{label}</span><Amount value={amount} />
    {ticker && (tokenAmount ? <small className="journey-token-amount" style={{ '--token-chars': storyAmountText(tokenAmount).length + tokenAmount.symbol.length + (estimated ? 4 : 2) } as CSSProperties} title={estimated ? 'Estimated at current spot; unpaid tokens are determined when paid' : tokenAmount.atoms === null ? 'Waiting for confirmed token payout records' : 'Confirmed tokens received'}>
      {estimated ? '≈ ' : ''}{storyAmountText(tokenAmount)} ${tokenAmount.symbol}
    </small> : <small>{'$' + amount.symbol}</small>)}
    {positive(legacyAmount) && <small title="Earlier USDC payments, before the payout change">{storyAmountText(legacyAmount!)} USDC</small>}
    {positive(amount) && <SettlementTxLinks signatures={signatures} cluster={cluster} label={kind === 'bag' ? 'Bet settlement' : label}/>}
  </div>;
}
function PlayerProceeds({ returned, ownership, payout, legacyPayout, queued, transactions, cluster, collateralImageUrl, payoutSymbol, onStake }: {
  returned: StoryAmount; ownership: StoryAmount; payout?: StoryAmount; queued?: StoryAmount;
  transactions: ReturnType<typeof settlementTransactions>; cluster: string;
  collateralImageUrl?: string; payoutSymbol: string;
  legacyPayout?:StoryAmount;
  onStake?: () => void;
}) {
  const additions = [returned, payout, legacyPayout, ownership, queued].filter(positive);
  const textLength = additions.reduce((length, value) =>
    length + storyAmountText({ ...value!, signed: true }).length + (value === queued ? 10 : value!.symbol.length + 1), 0);
  return <div className="journey-player tone-ice">
    <div className="journey-player-wallet"><SettlementIcon kind="wallet" size={31}/></div>
    <div className="journey-player-body">
      <div className="journey-player-amounts" style={{ '--proceeds-chars': Math.max(1, textLength), '--proceeds-icons': additions.length, '--proceeds-action-width': positive(ownership)&&onStake?'38px':'0px' } as CSSProperties}>
        {positive(returned) && <div className="journey-returned" title="Original tokens returned to your available balance"><Coin symbol={returned.symbol} imageUrl={collateralImageUrl}/><Amount value={{ ...returned, signed: true }} ticker currencyInTicker={returned.symbol === 'USDC'}/><SettlementTxLinks signatures={transactions.close} cluster={cluster} label="Collateral return"/></div>}
        {positive(payout) && <div className="journey-wallet-profit has-payout"
          title="Profit tokens actually received by your wallet">
          <Coin symbol={payout!.symbol}/>
          <Amount value={payout!} ticker currencyInTicker={payout!.usd}/>
          <SettlementTxLinks signatures={transactions.walletPayouts} cluster={cluster} label="Profit payout"/>
        </div>}
        {positive(legacyPayout)&&<div title="Earlier USDC payments, before the payout change"><Coin symbol="USDC"/><Amount value={legacyPayout!} ticker currencyInTicker/></div>}
        {positive(ownership) && <div className="journey-player-ownership has-ownership" title="Ownership earned · available for you to stake">
          <PlatformTokenImage secondary alt="Ownership earned"/>
          <div><Amount value={ownership} ticker/></div>
          {onStake && <button className="journey-stake" onClick={onStake} aria-label={`Stake ${ownership.symbol} · open Pool & Rewards`}>Stake</button>}
          <SettlementTxLinks signatures={transactions.close} cluster={cluster} label="Ownership earned"/>
        </div>}
        {positive(queued) && <div className="journey-player-queue tone-queue" title="Unpaid profit in the FIFO queue · paid automatically when funded">
          <Coin symbol={payoutSymbol}/>
          <Amount value={{ ...queued!, signed: true }}/><span>FIFO queue</span>
          <SettlementTxLinks signatures={transactions.close} cluster={cluster} label="FIFO claim creation"/>
        </div>}
      </div>
    </div>
  </div>;
}
/** Illustrated settlement: original coins split, transform, then visibly arrive. */
export function SettlementReceipt({ position, collateral, collateralImageUrl, poolToken, payoutQuote, priceNow = Date.now(), pnl, ownership, cluster = 'devnet', onDismiss, onComplete, onInteract, onPayoutUpdate, onStake }: {
  position: Row; collateral: AssetInfo; poolToken?: AssetInfo; payoutQuote?: Row; priceNow?: number; pnl: bigint;
  collateralImageUrl?: string;
  cluster?: string;
  onStake?: () => void;
  ownership: string | bigint | null; onDismiss: () => void; onComplete?: () => void; onInteract?: () => void; onPayoutUpdate?: () => void;
}) {
  const tokens = usePlatformTokens();
  const stages = settlementStory({ position, collateral, poolToken, pnl, ownership, ownershipSymbol: tokens.secondary });
  const byId = Object.fromEntries(stages.map(stage => [stage.id, stage]));
  const [run, setRun] = useState(0), [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const svg = useRef<SVGSVGElement>(null);
  const [arrivalPoints, setArrivalPoints] = useState({ ownership: '18 19', payout: '18 19', queue: '18 19', returned: '18 19' });
  const callbacks = useRef({ onComplete, onInteract, onPayoutUpdate });
  callbacks.current = { onComplete, onInteract, onPayoutUpdate };
  const walletUsdc=settlementWalletPayout(position),walletTokens=settlementWalletTokenPayout(position);
  const walletPaid=(walletTokens??0n)+(walletUsdc??0n);
  const highestWalletPayout = useRef({ key: position.key, amount: walletPaid ?? 0n });
  const allocationKey = settlementAllocationKey(position), receiptPending = settlementReceiptPending(position);
  const previousAllocation = useRef(allocationKey);
  const elapsed = useRef(0), timerRun = useRef(run);
  // Transfers follow the compact proceeds row, including when a zero balance
  // disappears or a FIFO payment arrives after the original close receipt.
  useLayoutEffect(() => {
    const scene = svg.current?.parentElement;
    if (!scene || !svg.current) return;
    const measure = () => {
      const frame = svg.current?.getBoundingClientRect();
      if (!frame?.width || !frame.height) return;
      const point = (selector: string) => {
        const item = scene.querySelector(selector)?.getBoundingClientRect();
        return item ? `${((item.left + item.width / 2 - frame.left) / frame.width * 480).toFixed(1)} ${((item.top + item.height / 2 - frame.top) / frame.height * 140).toFixed(1)}` : '18 19';
      };
      const next = { ownership: point('.journey-player-ownership>img'), payout: point('.journey-wallet-profit>.coin'), queue: point('.journey-player-queue>.coin'), returned: point('.journey-returned>.coin') };
      setArrivalPoints(previous => previous.ownership === next.ownership && previous.payout === next.payout && previous.queue === next.queue && previous.returned === next.returned ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scene);
    return () => observer.disconnect();
  }, [run, walletPaid, position.remaining, byId.returned?.amount?.atoms, byId.ownership?.amount?.atoms]);
  useEffect(() => {
    if (allocationKey && allocationKey !== previousAllocation.current) {
      previousAllocation.current = allocationKey;
      callbacks.current.onPayoutUpdate?.();
      setRun(n => n + 1);
    }
  }, [allocationKey]);
  useEffect(() => {
    const previous = highestWalletPayout.current;
    if (previous.key !== position.key) {
      highestWalletPayout.current = { key: position.key, amount: walletPaid ?? 0n };
      return;
    }
    // A verified payout can arrive after the close animation started. Restart
    // its timeline without overriding pause or replaying the initial receipt.
    // Keep the high-water mark across transient unknown snapshots, so the same
    // confirmed transfer is never animated again as a new payout.
    if (walletPaid !== null && walletPaid > previous.amount) {
      highestWalletPayout.current = { key: position.key, amount: walletPaid };
      callbacks.current.onPayoutUpdate?.();
      setRun(n => n + 1);
    }
  }, [position.key, walletPaid]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => { setReduced(media.matches); if (media.matches) callbacks.current.onInteract?.(); };
    change(); media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, []);
  useEffect(() => {
    if (timerRun.current !== run) { elapsed.current = 0; timerRun.current = run; }
    if (paused || reduced || receiptPending) return;
    const started = performance.now();
    const timer = window.setTimeout(() => callbacks.current.onComplete?.(), Math.max(0, SETTLEMENT_STORY_MS - elapsed.current));
    return () => { elapsed.current += performance.now() - started; window.clearTimeout(timer); };
  }, [paused, reduced, run, receiptPending]);
  useEffect(() => {
    if (paused || reduced) svg.current?.pauseAnimations();
    else svg.current?.unpauseAnimations();
  }, [paused, reduced, run]);
  const replay = () => { callbacks.current.onInteract?.(); setRun(n => n + 1); setPaused(false); };
  if (!byId.bet?.amount || !byId.result?.amount || !byId.returned?.amount || !byId.ownership?.amount) return null;
  const loss = byId.conversion, allocations = byId.allocation?.split;
  const isLoss = !!loss;
  const transactions = settlementTransactions(position);
  const closeHref = solscanTransaction(transactions.close[0], cluster);
  const sameAsset = collateral.mint === poolToken?.mint;
  const dust = isLoss && loss.to?.atoms === 0n;
  const { profit, paid, remaining } = settlementClaimAmounts(position);
  const usdAmount = (atoms: bigint | null): StoryAmount => ({ ...byId.result.amount!, atoms, signed: false });
  const profitAmount = usdAmount(profit), paidAmount = usdAmount(paid), queuedAmount = usdAmount(remaining);
  const walletPayout: StoryAmount = (walletTokens??0n)>0n
    ?{atoms:walletTokens,symbol:poolToken?.symbol??tokens.primary,decimals:poolToken?.decimals??6,signed:true}
    :{...usdAmount(walletUsdc),signed:true};
  const legacyPayout=(walletTokens??0n)>0n&&(walletUsdc??0n)>0n?{...usdAmount(walletUsdc),signed:true}:undefined;
  const acidSymbol = poolToken?.symbol ?? tokens.primary;
  const profitTokens = positionProfitTokens(position, pnl, payoutQuote, priceNow);
  const tokenAmount = (atoms: bigint | null): StoryAmount => ({ atoms, symbol: acidSymbol, decimals: poolToken?.decimals ?? 6 });
  const oldPayment = (walletUsdc ?? 0n) > 0n ? usdAmount(walletUsdc) : undefined;
  const pureLegacy = walletTokens === 0n && positive(oldPayment) && remaining === 0n;
  const paidTokenAmount = pureLegacy ? { ...oldPayment!, usd: false } : tokenAmount(profitTokens.paid);
  const claimTokenAmount = pureLegacy ? paidTokenAmount : tokenAmount(profitTokens.total);
  return <div className={'position-overlay settlement-receipt' + (paused ? ' is-paused' : '') + (reduced ? ' is-reduced' : '')}
    data-stage="illustrated" data-wallet-flight-source="settlement"
    onPointerDownCapture={e => { if ((e.target as Element).closest('.journey-tx-links, .journey-stake')) callbacks.current.onInteract?.(); }}
    onFocusCapture={e => { if ((e.target as Element).closest('.journey-tx-links, .journey-stake')) callbacks.current.onInteract?.(); }}>
    <div className="journey-header">
      <span aria-hidden="true"/>
      <span aria-hidden="true"/>
      <div className="journey-controls">
        <button onClick={() => { callbacks.current.onInteract?.(); setPaused(x => !x); }} disabled={reduced}
          aria-label={paused ? 'Play settlement animation' : 'Pause settlement animation'}>{paused || reduced ? '▶' : 'Ⅱ'}</button>
        <button onClick={replay} aria-label="Replay settlement animation">↻</button>
        {closeHref && <a href={closeHref} target="_blank" rel="noopener noreferrer" aria-label="View settlement transaction on Solscan">↗</a>}
        <button onClick={onDismiss} aria-label="Dismiss settlement replay">×</button>
      </div>
    </div>
    <div className={'settlement-journey ' + (isLoss ? 'journey-loss' : 'journey-win')} key={run} aria-label="Illustrated settlement">
      <svg ref={svg} className="journey-motion" viewBox="0 0 480 140" preserveAspectRatio="none" aria-hidden="true">
        <Transfer path={'M35 69Q1 31 ' + arrivalPoints.returned} start={.2} duration={1.5} symbol={collateral.symbol} imageUrl={collateralImageUrl} color="ice" enabled={positive(byId.returned.amount)} reduced={reduced} />
        {isLoss ? <>
          <Transfer path="M58 77C85 70 111 70 140 77" start={1.4} symbol={collateral.symbol} imageUrl={collateralImageUrl} enabled={positive(loss.from)} reduced={reduced} />
          <Transfer path="M171 77C204 68 230 69 267 78" start={3.1} liquid symbol={acidSymbol} enabled={positive(allocations?.[0]) && positive(loss.to)} reduced={reduced} />
          <Transfer path="M171 74C229 41 313 40 358 66" start={4.0} liquid symbol={acidSymbol} color="ice" enabled={positive(allocations?.[1])} reduced={reduced} />
          <Transfer path="M171 74C238 33 411 38 433 63" start={4.8} liquid symbol={acidSymbol} color="burn" enabled={positive(allocations?.[2])} reduced={reduced} />
          <Transfer path="M223 42Q268 45 283 76" start={4.1} duration={1.3} liquid symbol={acidSymbol} enabled={positive(byId.backing?.amount)} reduced={reduced} />
          <Transfer path={'M283 66Q220 5 ' + arrivalPoints.ownership} start={6.5} duration={1.3} symbol={tokens.secondary} color="ownership" enabled={positive(byId.ownership.amount)} reduced={reduced} />
        </> : <>
          <Transfer path="M169 76C211 67 255 68 292 77" start={2.2} duration={1.6} symbol={paidTokenAmount.symbol} color="ice" enabled={positive(paidAmount)} reduced={reduced} />
          <Transfer path="M169 76C230 44 376 42 429 68" start={4} duration={1.5} symbol={acidSymbol} color="queue" enabled={positive(queuedAmount)} reduced={reduced} />
          <Transfer path={'M307 62Q240 8 ' + arrivalPoints.payout} start={4.7} duration={2.6} symbol={walletPayout.symbol} color="ice" enabled={positive(walletPayout)} reduced={reduced} />
          <Transfer path={'M437 66Q410 4 ' + arrivalPoints.queue} start={6.2} duration={1.5} symbol={acidSymbol} color="queue" enabled={positive(queuedAmount)} reduced={reduced} />
        </>}
      </svg>
      <PlayerProceeds returned={byId.returned.amount} ownership={byId.ownership.amount} payout={isLoss ? undefined : walletPayout} legacyPayout={legacyPayout} queued={isLoss ? undefined : queuedAmount} transactions={transactions} cluster={cluster} collateralImageUrl={collateralImageUrl} payoutSymbol={acidSymbol} onStake={onStake}/>
      {isLoss && positive(byId.backing?.amount) && <div className="journey-backing-source" title={byId.backing.caption}>
        <span>From stake</span><div><Coin symbol={acidSymbol}/><Amount value={byId.backing.amount!} ticker/></div>
        <SettlementTxLinks signatures={transactions.close} cluster={cluster} label="Bet backing contribution"/>
      </div>}
      <Destination x={8} kind="bag" label={'Bet · ' + (byId.bet.to ? storyAmountText(byId.bet.to) : '—')} amount={byId.bet.amount} at={0} tone="collateral" signatures={transactions.close} cluster={cluster}>
        <span className="journey-bag-token"><Coin symbol={collateral.symbol} imageUrl={collateralImageUrl}/></span>
      </Destination>
      {isLoss && loss.to && allocations ? <>
        <div className="journey-loss-caption"><Amount value={loss.from!} ticker/><span>{dust ? 'retained as dust' : sameAsset ? 'lost tokens retained' : 'lost tokens sold'}</span></div>
        <Destination x={32} kind="swap" label={dust ? 'No swap' : sameAsset ? 'Retained' : 'Bought'} amount={loss.to} at={2.8} signatures={transactions.close} cluster={cluster}>
          <div className={'journey-transmute' + (sameAsset ? ' same-asset' : '')}>
            {!sameAsset && <span className="journey-before-token"><Coin symbol={collateral.symbol} imageUrl={collateralImageUrl}/></span>}
            <span className="journey-after-token"><Coin symbol={acidSymbol}/></span>
          </div>
        </Destination>
        <Destination x={59} kind="pool" label="Payout pool" amount={allocations[0]} at={4.4} signatures={transactions.close} cluster={cluster}/>
        <Destination x={76} kind="stakers" label="Stakers" amount={allocations[1]} at={5.3} tone="ice" signatures={transactions.close} cluster={cluster}/>
        <Destination x={91} kind="burn" label="Burned" amount={allocations[2]} at={6.1} tone="burn" signatures={transactions.close} cluster={cluster}/>
      </> : <>
        <Destination x={32} kind="payout" label="Profit claim" amount={profitAmount} tokenAmount={claimTokenAmount} estimated={profitTokens.estimated} legacyAmount={pureLegacy ? undefined : oldPayment} at={1.6} tone="ice" signatures={transactions.close} cluster={cluster}/>
        <Destination x={64} kind="payout" label="Claim settled" amount={paidAmount} tokenAmount={paidTokenAmount} legacyAmount={pureLegacy ? undefined : oldPayment} at={3.8} tone="ice" signatures={transactions.payouts} cluster={cluster}/>
        <Destination x={91} kind="queue" label="Still in FIFO" amount={queuedAmount} tokenAmount={tokenAmount(profitTokens.queued)} estimated={positive(queuedAmount)} at={5.5} tone="queue" signatures={transactions.close} cluster={cluster}/>
      </>}
    </div>
  </div>;
}


