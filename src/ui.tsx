import { appPath, sdiceSkin, thesisSkin, thesisPreview, appName } from "./app-url.ts";
import { auxiliaryBackingMints } from './backing-assets.ts';
import {isPerpsMarket,perpsRewardAsset} from './perps-market.ts';
import { docsHref } from './docs-route.ts';
import { appFetch as fetch } from "./app-url.ts";
import {Leaderboard} from "./Leaderboard.tsx";
import {ed25519} from "@noble/curves/ed25519";
import { PlatformTokensContext, usePlatformTokens } from './PlatformTokens.tsx';
import { platformTokens } from './platform-tokens.ts';
import {InstantActivation} from './InstantActivation.tsx';
import {BrowserGas} from './BrowserGas.tsx';
import {browserGasReady,browserGasRequiredError,type BrowserGasStatus} from './browser-gas-status.ts';
import {signBlinkWalletTransaction} from './blink-wallet.ts';
import {validateWalletApproval} from './wallet-approval.ts';
import type {TradingWalletMode} from './wallet-mode.ts';
import {loadWalletMode,saveWalletMode} from './wallet-preference.ts';
import './wallet-mode.css';
import {TradeActivityBar} from './TradeActivityBar.tsx';
import { approveDeposit } from './deposit-approval.ts';
import { authorizeDepositWallet } from './deposit-wallet.ts';
import { useBrowserWalletConnection } from './BrowserWalletProvider.tsx';
import { VisibleValue } from './visible-value.ts';
import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import type { BorshInstructionCoder } from "@anchor-lang/core";
import {
  Connection,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  getAccount,
  getMint,
  getAccountLenForMint,
  getAssociatedTokenAddressSync,
  unpackAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  NATIVE_MINT,
} from "@solana/spl-token";
import {
  MixClient,
  usdcAsset,
  walletAssets,
  isSol,
  primaryAsset,
  transactionTables,
  pk,
  emptySnapshot,
  jsonValue,
  type Deployment,
  type Snapshot,
  type Row,
  type AssetInfo,
} from "./client.ts";
import { isFresh, parseUnits, crossed, normalizeAmountInput } from "./math.ts";
import { collateralUsd, withSolCollateralPrice } from "./collateral-value.ts";
import { displayedPositionPnl, limitPositionHistory } from "./position-order.ts";
import { HISTORY_LIMIT } from "./history-limit.ts";
import { PositionResult } from "./PositionResult.tsx";
import { positionLock } from "./position-lock.ts";
import { manualCloseRemainingMs } from "./position-hold.ts";
import { PositionCloseButton } from "./PositionCloseButton.tsx";
import { usePositionOrder } from "./usePositionOrder.ts";
import "./position-interactions.css";
import "./wallet-funding.css";
import { AcidBrand } from "./AcidBrand.tsx";
import { AcidBackdrop } from "./AcidBackdrop.tsx";
import { AcidPoolButton } from "./AcidPoolButton.tsx";
import { RewardBeaker } from "./RewardBeaker.tsx";
import { AcidInfoBorder } from "./AcidInfoBorder.tsx";
import { AcidTradeSkin } from "./AcidTradeSkin.tsx";
import { ActivePositionAcid } from "./ActivePositionAcid.tsx";
import { usePositionArrival } from "./usePositionArrival.ts";
import { AcidHow } from "./AcidHow.tsx";
import { AcidMetrics } from "./AcidMetrics.tsx";
import { platformMetrics } from "./metrics-model.ts";
import { DisplayClock } from "./display-clock.ts";
import "./entry-maintenance.css";
import { waitForSignature } from "./confirmation.ts";
import { SnapshotOrder } from "./snapshot-order.ts";
import {
  SponsoredConfirmationEvents,
  waitForSponsoredSignature,
} from "./sponsored-confirmation.ts";
import { TransactionProgress } from "./TransactionProgress.tsx";
import {
  PendingActions,
  type ReportProgress,
  type TransactionStage,
} from "./transaction-progress.ts";
import { Coin, Modal } from "./components.tsx";
import { CORE_MARKETS, coreMarketSymbol } from "./core-markets.ts";
import { formatMarketValue } from "./market-view.ts";
import { PriceHero } from "./PriceHero.tsx";
import { displayMarketFeed, receiveLivePrices, receiveSnapshotPrices, type LivePriceBook } from "./live-market-prices.ts";
import { startEventStream } from "./event-source.ts";
import { readStateSnapshot } from "./state-refresh.ts";
import { listenForSnapshots } from "./snapshot-stream.ts";
import { PositionLiquidationMeter } from "./LiquidationMeter.tsx";
import { PositionShareButton } from "./PositionShare.tsx";
import { LeverageSlider } from "./LeverageSlider.tsx";
import { WalletDropdown } from "./WalletDropdown.tsx";
import { BetTokenList } from './BetTokenList.tsx';
import { TokenRegistration } from './TokenRegistration.tsx';
import type { WalletToken } from './wallet-discovery.ts';
import { useWalletDiscovery } from './useWalletDiscovery.ts';
import { useTokenDisplays } from './useTokenDisplays.ts';
import {assetImage} from './token-display.ts';
import { betBackingRequired } from './bet-backing-label.ts';
import { BetAmountPresets } from './BetAmountPresets.tsx';
import { availableBackingTokens, availableAuxiliaryBacking, backingExemptAssets, hasBackingReserve } from "./core-backing.ts";
import { CoreBacking } from "./CoreBacking.tsx";
import { BackingDisplay } from './backing-display.ts';
import { BackingCountdown } from './BackingCountdown.tsx';
import { AcidHowButtonSkin } from "./AcidHowButtonSkin.tsx";
import { AcidPoolButtonSkin } from "./AcidPoolButtonSkin.tsx";
import { UnifiedWalletChanges } from "./unified-wallet-changes.ts";
import { SwapEffects } from "./SwapEffects.tsx";
import {
  WalletBalanceRefresh,
  startWalletBalancePolling,
} from "./wallet-balance-polling.ts";
import type { WalletNotice } from "./WalletEffects.tsx";
import { AcidRewards } from "./AcidRewards.tsx";
import type { RewardConfirmation } from "./reward-confirmation.ts";
import { SettlementReceipt } from "./SettlementReceipt.tsx";
import {solscanTransaction} from './settlement-transactions.ts';
import { SolFunding } from "./SolFunding.tsx";
import { depositAtoms, depositInstructions, depositSources, type DepositAsset, type DepositSource } from "./wallet-deposit.ts";
import type { DepositProps } from "./WalletDeposit.tsx";
import type {FundingSnapshot} from "./funding-wallet.ts";
import type { WithdrawProps } from "./WalletWithdraw.tsx";
import { withdrawalRecipient,browserWithdrawableSol } from "./withdrawal.ts";
import { planWalletWithdrawal } from './withdrawal-plan.ts';
import {
  claimableOwnership,
  estimateOwnership,
  estimatePoolChange,
} from "./ownership.ts";
import { canOpenUsd, MAX_NOTIONAL_USD, poolExposureValue, poolExposureLimit } from "./risk.ts";
import {PoolContribution} from "./PoolContribution.tsx";
import type { SponsoredAction } from "../server/sponsor.ts";
import type { ErAction } from "../server/er-transactions.ts";
import { pendingTradingCredit, tradingBalances } from "./er-state.ts";
import { type ExecutionLayer } from "./execution-layer.ts";
import { profileForDeployment } from "./deployment-profile.ts";
import { sponsoredPayer } from "./browser-deployment.ts";
import { loadLocalWallet, assertActiveWallet, hasWalletBackup } from './wallet-recovery.ts';
import { acknowledgedWalletTradingBalances, availableWalletBalances } from "./wallet-balances.ts";
import { restoreWithdrawalBalance, withdrawalAcknowledged } from "./trading-withdrawal.ts";
import { fundTradingShortfall, withPreparationPacing } from "./trading-funding.ts";
import { tradingRequest } from "./trading-request.ts";
import { ensureCollateralDepositRoom } from "./collateral-capacity.ts";
import { waitForOpeningPrices, type OpeningSnapshot } from "./opening-prices.ts";
import { withPriceRetries, type PriceAttempt } from "./price-retry.ts";
import {
  OPEN_BASE_FEE,
  TEST_SOL_LOW,
  solRequiredMessage,
  transactionError,
  transactionDiagnostics,
  transactionResponseError,
  failedTransaction,
  isSolFundingError,
  selfPayKey,
  SELF_PAY_STORAGE_KEY,
} from "./funding.ts";
const numberFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const usdFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const smallUsdFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const fmt = (v: number) => numberFormat.format(v);
const usd = (v: number) => "$" + (v >= 1 ? usdFormat : smallUsdFormat).format(v);
const cash = (v: string | bigint) => "$" + usdFormat.format(Number(v) / 1e6);
const short = (s: string) => s.slice(0, 4) + "…" + s.slice(-4);
const clockTime = (v: string) => timeFormat.format(new Date(Number(v) * 1000));
const units = (v: string | bigint, d = 6) => fmt(Number(v) / 10 ** d);
export function App({ initialDeployment }: { initialDeployment: Deployment }) {
  const wallet=useWallet(),{setVisible}=useWalletModal();
  const walletConnection = useBrowserWalletConnection();
  const [mode,setMode]=useState<TradingWalletMode>(()=>loadWalletMode()),[busy,setBusy]=useState(false),[confirmBrowser,setConfirmBrowser]=useState(false);
  const selectMode=(next:TradingWalletMode)=>{saveWalletMode(next);setMode(next);};
  const controls=<div className="wallet-mode-toggle" role="group" aria-label="Trading wallet mode">
    <button aria-pressed={mode==='instant'} disabled={busy} onClick={()=>selectMode('instant')}>Instant wallet</button>
    <button aria-pressed={mode==='browser'} disabled={busy} onClick={()=>{if(mode!=='browser')setConfirmBrowser(true);}}>Browser wallet</button>
  </div>;
  if(mode==='browser'&&(!wallet.publicKey||!wallet.connected))return <main><AcidBackdrop/><section className="wallet-mode-connect">
    <AcidBrand/>{controls}<h1>Your wallet. Your approvals.</h1>
    <p>Approve trades in your browser wallet. Fund a separate SOL reserve for automatic settlement; unused SOL remains yours.</p>
    <button className="primary" disabled={wallet.connecting||wallet.disconnecting} onClick={()=>setVisible(true)}>{wallet.disconnecting?'Disconnecting…':wallet.connecting?'Reconnecting browser wallet…':'Connect browser wallet'}</button>
    {wallet.connecting&&<button onClick={walletConnection.cancel}>Cancel connection</button>}
    {walletConnection.error&&<p role="status">{walletConnection.error}</p>}
    <a href={appPath("/")}>← Home</a>
  </section></main>;
  return <><TradingApp key={mode==='instant'?'instant':`browser:${wallet.publicKey!.toBase58()}`}
    initialDeployment={initialDeployment} mode={mode} modeControls={controls} onModeBusy={setBusy}/>
    {confirmBrowser&&<Modal title="Switch to browser wallet?" close={()=>setConfirmBrowser(false)}><div className="browser-mode-explainer">
      <p>Browser wallet trades cost more gas and are slower because each action needs your approval.</p>
      <strong>Instant wallet is recommended.</strong>
      <button className="primary" onClick={()=>setConfirmBrowser(false)}>Keep Instant wallet</button>
      <button disabled={busy} onClick={()=>{setConfirmBrowser(false);selectMode('browser');}}>Use browser wallet</button>
    </div></Modal>}</>;
}
function TradingApp({initialDeployment,mode,modeControls,onModeBusy}:{initialDeployment:Deployment;mode:TradingWalletMode;modeControls:React.ReactNode;onModeBusy:(busy:boolean)=>void}) {
  const walletConnection = useBrowserWalletConnection();
  const browserMode=mode==='browser';
  const tokens = usePlatformTokens();
  const { connection } = useConnection(),
    wallet = useWallet(),
    { setVisible } = useWalletModal(),
    client = useMemo(() => {
      const value = new MixClient(connection, profileForDeployment(initialDeployment));
      value.deployment = initialDeployment;
      return value;
    }, [connection, initialDeployment]);
  const { assetPda, gasReservePda, erCustodyPda } = client.addresses;
  const PROGRAM = client.profile.programId;
  const error = (value: unknown) => transactionError(value, client.profile.cluster);
  const [local] = useState(() => browserMode?undefined:loadLocalWallet(localStorage,initialDeployment)),
    owner = browserMode?wallet.publicKey!:local!.publicKey,
    ownerKey = owner.toBase58();
  const [backupReady,setBackupReady]=useState(()=>hasWalletBackup(localStorage,initialDeployment,ownerKey));
  const browserAddress = wallet.publicKey?.toBase58() ?? "";
  const fundingSender = useRef(browserAddress);
  fundingSender.current = browserAddress;
  const fundingWallet = useRef(wallet);
  fundingWallet.current = wallet;
  const depositLock = useRef(false);
  const pendingActions = useRef(new PendingActions());
  const sponsoredConfirmations = useRef(new SponsoredConfirmationEvents());
  const snapshotOrder = useRef(new SnapshotOrder());
  const openingSnapshot = useRef<OpeningSnapshot>();
  const [progress, setProgress] = useState<Record<string, TransactionStage>>(
    {},
  );
  const [closeErrors, setCloseErrors] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, number>>({});
  const manualReceipts = useRef(new Set<string>());
  const [walletNotices, setWalletNotices] = useState<WalletNotice[]>([]);
  const [rewardConfirmation, setRewardConfirmation] = useState<
    (RewardConfirmation & { owner: string; pool: string }) | null
  >(null);
  const walletNoticeId = useRef(0);
  const walletChanges = useMemo(() => new UnifiedWalletChanges(client.addresses), [client]);
  const balanceSlot = useRef(-1);
  const [openSide, setOpenSide] = useState<boolean | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [gasOpen,setGasOpen]=useState(false),[gasStatus,setGasStatus]=useState<BrowserGasStatus>();
  const gasBalance=gasStatus?.balanceLamports;
  function requireSettlementGas() {
    setMessage('');setWalletOpen(false);setDialog(null);setGasOpen(true);
  }
  const [balanceNoticeUntil, setBalanceNoticeUntil] = useState(0);
  const balanceNoticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearBalanceNotice = useCallback(() => {
    if (balanceNoticeTimer.current !== null)
      clearTimeout(balanceNoticeTimer.current);
    balanceNoticeTimer.current = null;
    setBalanceNoticeUntil(0);
  }, []);
  const warnInsufficientBalance = () => {
    if (balanceNoticeTimer.current !== null)
      clearTimeout(balanceNoticeTimer.current);
    setBalanceNoticeUntil(Date.now() + 5_000);
    balanceNoticeTimer.current = setTimeout(() => {
      balanceNoticeTimer.current = null;
      setBalanceNoticeUntil(0);
    }, 5_000);
  };
  useEffect(
    () => () => {
      if (balanceNoticeTimer.current !== null)
        clearTimeout(balanceNoticeTimer.current);
    },
    [],
  );
  const report =
    (key: string): ReportProgress =>
    (stage) =>
      setProgress((current) => current[key] === stage ? current : ({ ...current, [key]: stage }));
  const clearProgress = (key: string) =>
    setProgress((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  const active = useRef(ownerKey);
  active.current = ownerKey;
  const [activationBusy,setActivationBusy]=useState(false);
  function assertTradingWallet() {
    if(active.current!==ownerKey)throw Error('Trading wallet changed; nothing was submitted');
    if(browserMode) {
      if(fundingSender.current!==ownerKey||wallet.wallet?.adapter.publicKey?.toBase58()!==ownerKey)
        throw Error('Browser wallet changed; nothing was submitted');
    }else assertActiveWallet(localStorage,initialDeployment,ownerKey);
  }
  async function approveTransaction(tx:VersionedTransaction) {
    if(thesisPreview)throw Error('Local preview only. No transaction was signed or sent.');
    assertTradingWallet();
    if(!browserMode){tx.sign([local!]);return tx;}
    const expected=VersionedTransaction.deserialize(tx.serialize());
    const tables=await Promise.all(tx.message.addressTableLookups.map(async t=>{
      const table=(await connection.getAddressLookupTable(t.accountKey)).value;
      if(!table)throw Error('Transaction lookup unavailable');return table;
    }));
    const signed=await signBlinkWalletTransaction(wallet,ownerKey,tx,initialDeployment.cluster==='mainnet-beta'?'mainnet-beta':'devnet');
    assertTradingWallet();validateWalletApproval(expected,signed,owner,tables);return signed;
  }
  useEffect(() => {
    active.current = ownerKey;
    return () => { active.current = ""; };
  }, [ownerKey]);
  const [deployment, setDeployment] = useState<Deployment>(initialDeployment),
    [state, setState] = useState<Snapshot>(emptySnapshot),
    [feedId, setFeedId] = useState(2),
    [assetIndex, setAssetIndex] = useState(0),
    [amount, setAmount] = useState(thesisPreview?'10':"10000"),
    [leverage, setLeverage] = useState("1000");
  const [livePrices, setLivePrices] = useState<LivePriceBook>({});
  const [balances, setBalances] = useState<Record<string, bigint>>({}),
    [walletBankCustody, setWalletBankCustody] = useState<Row>(),
    [sol, setSol] = useState(0),
    [balanceOwner, setBalanceOwner] = useState(""),
    [busy, setBusy] = useState(""),
    [message, setMessage] = useState(""),
    [fundingReason, setFundingReason] = useState(""),
    [signature, setSignature] = useState(""),
    [now, setNow] = useState(Date.now()),
    [ownSolDay, setOwnSolDay] = useState(
      () => localStorage.getItem(SELF_PAY_STORAGE_KEY) ?? "",
    ),
    [dialog, setDialog] = useState<
      | "how"
      | "metrics"
      | "leaderboard"
      | "market"
      | "collateral"
      | "ownership"
      | "funding"
      | "backing"
      | null
    >(null),
    [ownershipKey, setOwnershipKey] = useState("");
  const displayClock = useRef(new DisplayClock());
  const priceNow = displayClock.current.now(state);
  const closeClock = useCallback(() => displayClock.current.now(), []);
  const selfPay = !!ownerKey && ownSolDay === selfPayKey(ownerKey, now),
    useSponsorship = !browserMode && !!deployment?.sponsorship && !selfPay;
  useEffect(()=>{onModeBusy(!!busy||activationBusy||Object.keys(progress).length>0);return()=>onModeBusy(false);},[busy,activationBusy,progress,onModeBusy]);
  const erConnection = useMemo(() => new Connection(
    deployment.er!.rpcUrl,
    { commitment: "confirmed", wsEndpoint: deployment?.er?.wsUrl },
  ), [deployment?.er?.rpcUrl, deployment?.er?.wsUrl]);
  const custodyBalances = useMemo(() => tradingBalances(state, ownerKey, deployment), [state.erTraders, ownerKey, deployment]);
  const erTrader = state.erTraders?.find((row) => row.owner === ownerKey);
  const exemptAssets = useMemo(() => backingExemptAssets(deployment), [deployment]);
  const coreAsset = primaryAsset(deployment);
  const backingCustody=state.custodies?.find(row=>row.owner===ownerKey);
  const backingEstimate = { availableTokens: availableBackingTokens(erTrader,backingCustody),
    auxiliaryTokens:availableAuxiliaryBacking(erTrader,backingCustody),auxiliaryQuotes:state.quotes,exemptAssets };
  const coreQuote = coreAsset && state.erQuotes?.find(q => q.asset === assetPda(pk(coreAsset.mint)).toBase58());
  const backingDisplay = useRef(new BackingDisplay());
  const displayedBacking = backingDisplay.current.read(erTrader,coreQuote,exemptAssets,priceNow,state.erQuotes??[]);
  const backingValue = displayedBacking.backing?.value;
  const walletDiscovery = useWalletDiscovery(ownerKey,walletOpen||dialog==='collateral'||dialog==='funding');
  const tokenDisplays = useTokenDisplays(deployment.assets,walletDiscovery.snapshot,walletOpen||dialog==='collateral');
  const displayTokens = useMemo(() => platformTokens(deployment, tokenDisplays), [deployment, tokenDisplays]);
  const [registrationToken,setRegistrationToken]=useState<WalletToken|null>(null);
  useEffect(()=>{
    if(!walletOpen&&dialog!=='collateral')return;
    let cancelled=false;
    const refresh=async()=>{try{
      const next=await fetch('/deployment.json').then(r=>r.json());
      if(cancelled)return;
      if(next.programId===initialDeployment.programId&&next.admin===initialDeployment.admin&&Array.isArray(next.assets)&&next.assets.length>deployment.assets.length){client.deployment=next;setDeployment(next);}
    }catch{/* Trading continues when registration is unavailable. */}};
    void refresh();const timer=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},15000);
    return()=>{cancelled=true;clearInterval(timer);};
  },[walletOpen,dialog,initialDeployment,client,deployment.assets.length]);
  const walletTradingBalances = useMemo(() => acknowledgedWalletTradingBalances(erTrader, walletBankCustody, deployment?.assets ?? [], client.addresses), [erTrader, walletBankCustody, deployment, client]);
  const availableBalances = useMemo(() => availableWalletBalances(balances, walletTradingBalances), [balances, walletTradingBalances]);
  const latestSnapshotSlot = useRef(0);
  latestSnapshotSlot.current = Math.max(
    latestSnapshotSlot.current,
    state.contextSlot ?? 0,
  );
  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);
  const selectBetToken = (a:AssetInfo) => {
    const index=deployment.assets.findIndex(candidate=>candidate.mint===a.mint);
    if(index<0||!deployment.assets[index].collateral)return;
    setAssetIndex(index);setWalletOpen(false);setDialog(null);
  };
  const registerBetToken = (token:WalletToken) => {
    if(!token.pumpfun)return;
    setWalletOpen(false);setDialog(null);setRegistrationToken(token);
  };
  const openFunding = (reason: string) => {
    setFundingReason(reason);
    setDialog("funding");
  };
  const asset = deployment?.assets[assetIndex],
    feed = state.feeds.find((f) => f.id === feedId),
    market = state.markets.find((m) => m.id === feedId),
    pool = state.pools.find((p) => p.key === market?.pool),
    collateralFeed = withSolCollateralPrice(state.quotes.find((f) => f.id === asset?.feedId),
      state.feeds.find(f => f.id === 2) && displayMarketFeed(state.feeds.find(f => f.id === 2)!, livePrices, priceNow));
  // Derive addresses once per deployment, not for every card on every price tick.
  const assetsByKey = useMemo(() => new Map((deployment?.assets ?? []).map(a =>
    [assetPda(pk(a.mint)).toBase58(), a])), [deployment]);
  const findAsset = (key: string) => assetsByKey.get(key);
  // Fast oracle events drive estimates only. Opens/closes still use the
  // original coherent account snapshot and on-chain execution checks.
  const displayFeeds = useMemo(() => state.feeds.map(row => displayMarketFeed(row, livePrices, priceNow)), [state.feeds, livePrices, priceNow]);
  const displayQuotes = useMemo(() => state.quotes.map(quote => withSolCollateralPrice(quote, displayFeeds.find(feed => feed.id === 2))!), [state.quotes, displayFeeds]);
  const backingRequired = (a:AssetInfo) => betBackingRequired(a,deployment.quoteMint,displayedBacking.backing?.available,amount,displayQuotes,priceNow,auxiliaryBackingMints(deployment));
  const symbol = feed?.symbol ?? coreMarketSymbol(feedId) ?? "—";
  const ownedPositions = useMemo(() => state.positions.filter((x) => x.owner === ownerKey), [state.positions, ownerKey]);
  const positions = usePositionOrder(ownedPositions, receipts, now, ownerKey);
  const visiblePositions = useMemo(() => limitPositionHistory(positions), [positions]);
  const positionPnls = useMemo(() => new Map(
    visiblePositions.map((position) => {
      const asset = findAsset(position.collateral);
      const market = state.markets.find((m) => m.key === position.market);
      const feed = displayFeeds.find((f) => f.key === market?.feed);
      const quote = displayQuotes.find((q) => q.id === asset?.feedId);
      return [
        position.key,
        displayedPositionPnl(position, feed, quote),
      ] as const;
    }),
  ), [visiblePositions, assetsByKey, state.markets, displayQuotes, displayFeeds]);
  const rewardPool = state.pools.find((p) => p.key === ownershipKey) ?? pool;
  const arrival = usePositionArrival(visiblePositions, state.snapshotAgeMs);
  const rewardAsset = rewardPool && (isPerpsMarket(deployment)?perpsRewardAsset(deployment):findAsset(rewardPool.settlement));
  const rewardState = state.ownershipPools?.find(
    (p) => p.pool === rewardPool?.key,
  );
  const rewardTrader = state.ownershipTraders?.find(
    (t) => t.pool === rewardPool?.key && t.owner === ownerKey,
  );
  const revenueAvailable = claimableOwnership(rewardState, rewardTrader);
  const currentPoolRewards = state.ownershipPools?.find(
    (p) => p.pool === pool?.key,
  );
  const currentPoolTrader = state.ownershipTraders?.find(
    (t) => t.pool === pool?.key && t.owner === ownerKey,
  );
  const hasStakeRewards = BigInt(currentPoolTrader?.available ?? "0") > 0n;
  const hasClaimRewards = claimableOwnership(currentPoolRewards, currentPoolTrader) > 0n;
  const rewardInventory = state.inventories.find(
    (i) => i.pool === rewardPool?.key && i.asset === rewardPool?.settlement,
  );
  const rewardTreasury = BigInt(rewardInventory?.treasury ?? "0");
  const yourPools = state.pools.filter((p) =>
    state.ownershipTraders?.some(
      (t) =>
        t.pool === p.key &&
        t.owner === ownerKey &&
        (BigInt(t.issued) > 0n ||
          BigInt(t.pending) > 0n ||
          BigInt(t.claimed) > 0n),
    ),
  );
  const showOwnership = useCallback((key: string) => {
    setRewardConfirmation(null);
    setOwnershipKey(key);
    setDialog("ownership");
  }, []);
  const showCurrentPool = useCallback(() => {
    if (pool) showOwnership(pool.key);
  }, [pool?.key, showOwnership]);
  function ownershipAction(kind: "stakeOwnership" | "claimOwnership") {
    if (!owner || !rewardPool || !rewardAsset || !rewardTrader) return;
    void action(kind, async () => {
      setRewardConfirmation(null);
      const before = BigInt(
        kind === "stakeOwnership" ? rewardTrader.staked : rewardTrader.claimed,
      );
      const ixs = useSponsorship
        ? []
        : kind === "stakeOwnership"
          ? [
              await client.stakeOwnership(
                owner,
                rewardPool,
                BigInt(rewardTrader.available),
              ),
            ]
          : [
              client.ataIx(owner, owner, rewardAsset),
              await client.claimOwnership(owner, rewardPool, rewardAsset),
            ];
      const id = await submit(ixs, 0, {
        kind,
        owner: ownerKey,
        pool: rewardPool.key,
      }, false, report(kind));
      setRewardConfirmation({
        id,
        kind: kind === "stakeOwnership" ? "stake" : "claim",
        before,
        owner: ownerKey,
        pool: rewardPool.key,
      });
    });
  }
  function contributePool(amount:bigint,minIssued:bigint) {
    if(!owner||!rewardPool||!rewardAsset)return;
    void action('contributePool',async()=>{
      const ledgerKey=client.addresses.contributionLedgerPda(pk(rewardPool.key),owner);
      const ledger=await (client.program.account as any).contributionLedger.fetchNullable(ledgerKey);
      const nonce=BigInt(ledger?.nextNonce.toString()??0);
      const intent:SponsoredAction={kind:'contributePool',owner:ownerKey,pool:rewardPool.key,
        amount:String(amount),nonce:String(nonce),minIssued:String(minIssued)};
      const ixs=useSponsorship?[]:[await client.contributePool(owner,owner,rewardPool,rewardAsset,amount,nonce,minIssued,Math.floor(Date.now()/1000)+60)];
      const id=await submit(ixs,0,intent,false,report('contributePool'));
      setMessage('SDICE contribution confirmed. Your pSDICE reward is available to stake.');
      setSignature(id);await refreshBalance();
    });
  }
  const quantities = useMemo(() => {
    try {
      const atoms = asset ? parseUnits(amount, asset.decimals) : 0n,
        value = collateralFeed ? collateralUsd(atoms, collateralFeed) : 0n;
      return {
        atoms,
        value,
        valid: atoms > 0n && value >= 1_000_000n && value <= MAX_NOTIONAL_USD,
      };
    } catch {
      return { atoms: 0n, value: 0n, valid: false };
    }
  }, [asset, amount, collateralFeed]);
  const lev = Number(leverage);
  const existingExposure = BigInt(
    state.exposures?.find((x) => x.owner === ownerKey)?.notional ?? "0",
  );
  // Admission observations use server time, just like the displayed quotes.
  // Comparing these timestamps to the device clock makes both sides flicker.
  const poolUsd = poolExposureValue(state.poolExposure, priceNow);
  const longCapacity = canOpenUsd(
    quantities.value,
    lev,
    existingExposure,
    market,
    true,
    poolUsd,
  );
  const shortCapacity = canOpenUsd(
    quantities.value,
    lev,
    existingExposure,
    market,
    false,
    poolUsd,
  );
  const balanceReady = !!ownerKey && balanceOwner === ownerKey,
    openSol =
      (state.positions.some(
        (x) =>
          x.owner === ownerKey &&
          x.pool === market?.pool &&
          x.recyclable &&
          !x.archived,
      )
        ? 0
        : (state.positionRentLamports ?? 0)) +
      (state.exposures?.some((x) => x.owner === ownerKey)
        ? 0
        : (state.exposureRentLamports ?? 0)) +
      OPEN_BASE_FEE,
    lowSol = !deployment?.er && !useSponsorship && balanceReady && sol * 1e9 < openSol,
    canRefillSol = balanceReady && sol * 1e9 < TEST_SOL_LOW,
    hasTestTokens = deployment?.assets.some(
      (a) => a.collateral && (balances[a.mint] ?? 0n) > 0n,
    );
  // Build with VITE_PERPS_ENTRY_HOLD=1 during a coordinated mainnet cutover.
  const entriesPaused = client.profile.mainnet && import.meta.env.VITE_PERPS_ENTRY_HOLD === "1";
  const canTrade =
    !entriesPaused &&
    !!owner &&
    !!market &&
    quantities.valid &&
    Number.isInteger(lev) &&
    lev >= 1 &&
    lev <= 1000 &&
    balanceReady &&
    !busy &&
    !!asset &&
    custodyBalances[asset.mint] !== undefined;
  const insufficientBalance =
    balanceReady &&
    !!asset &&
    custodyBalances[asset.mint] !== undefined &&
    quantities.atoms > 0n &&
    (availableBalances[asset.mint] ?? 0n) < quantities.atoms;
  const showInsufficientBalance =
    balanceNoticeUntil > now && insufficientBalance && !busy && !progress.open;
  useEffect(() => {
    clearBalanceNotice();
  }, [ownerKey, asset?.mint, amount, clearBalanceNotice]);
  useEffect(() => {
    if (!insufficientBalance) clearBalanceNotice();
  }, [insufficientBalance, clearBalanceNotice]);
  useEffect(() => {
    if (!balanceReady || !deployment || !state.contextSlot ||
        (deployment.er && state.erSnapshotAgeMs == null)) return;
    const assets = walletAssets(deployment);
    const changes = walletChanges.observe(ownerKey, balances, erTrader, walletBankCustody, assets);
    if (!changes.length) return;
    const id = (walletNoticeId.current = Math.max(Date.now(), walletNoticeId.current + 1));
    setWalletNotices(previous => [...previous.slice(-49), { id, changes, assets }]);
  }, [balanceReady, deployment, ownerKey, balances, erTrader, walletBankCustody, state.contextSlot, state.erSnapshotAgeMs, walletChanges]);
  const visibleSnapshot = useMemo(() => new VisibleValue<Snapshot>(snapshot => {
    setLivePrices(previous => receiveSnapshotPrices(previous, snapshot.feeds, displayClock.current.now(snapshot)));
    setState(snapshot);
  }), []);
  useEffect(() => {
    const resume = () => {
      if (!document.hidden) { visibleSnapshot.flush(); setNow(Date.now()); }
    };
    document.addEventListener('visibilitychange', resume);
    return () => document.removeEventListener('visibilitychange', resume);
  }, [visibleSnapshot]);
  const acceptSnapshot = useCallback((snapshot: Snapshot) => {
    if (snapshot.programId !== client.profile.programId.toBase58()) return;
    if (snapshotOrder.current.accept(snapshot)) {
      displayClock.current.receive(snapshot);
      openingSnapshot.current = { snapshot, receivedAt: Date.now() };
      visibleSnapshot.receive(snapshot, !document.hidden);
    }
  }, [client, visibleSnapshot]);
  const refresh = useCallback(async () => {
    acceptSnapshot(await readStateSnapshot());
  }, [acceptSnapshot]);
  const readBalance = useCallback(async () => {
    if (!owner || !deployment) return;
    const address = owner.toBase58();
    const assets = walletAssets(deployment);
    // Native SOL and token balances from the same confirmed bank, in one RPC.
    const response = await connection.getMultipleAccountsInfoAndContext(
      [...assets.map((a) => client.ata(owner, a)), owner, erCustodyPda(owner)],
      {
        commitment: "confirmed",
        minContextSlot: latestSnapshotSlot.current || undefined,
      },
    );
    const accounts = response.value;
    const balance = accounts[assets.length]?.lamports ?? 0;
    const custodyAccount = accounts[assets.length+1];
    const bankCustody = custodyAccount?.owner.equals(PROGRAM)
      ? jsonValue(client.program.coder.accounts.decode("erCustody",custodyAccount.data)) : undefined;
    if (active.current !== address) return;
    if (response.context.slot < balanceSlot.current) return;
    balanceSlot.current = response.context.slot;
    const next = Object.fromEntries(
      assets.map((a, i) => [
        a.mint,
        (accounts[i] ? accounts[i]!.data.readBigUInt64LE(64) : 0n) +
          (isSol(a) ? BigInt(balance) : 0n),
      ]),
    );
    setSol(balance / 1e9);
    setBalanceOwner(address);
    setBalances(next);
    setWalletBankCustody(bankCustody);
  }, [ownerKey, deployment, connection, client]);
  const balanceRefresh = useMemo(
    () => new WalletBalanceRefresh(readBalance),
    [readBalance],
  );
  const refreshBalance = useCallback(
    (afterCurrent = true) => balanceRefresh.run(afterCurrent),
    [balanceRefresh],
  );
  useEffect(() => {
    let done = false;
    let lastEvent = 0;
    const stopEvents = startEventStream(events => {
    events.addEventListener("prices", (event) => {
      if (done || document.hidden) return;
      try {
        const updates: unknown = JSON.parse(event.data);
        setLivePrices(previous => receiveLivePrices(previous, updates, displayClock.current.now()));
      } catch {}
    });
    events.addEventListener("transaction", (event) => {
      if (done) return;
      try {
        sponsoredConfirmations.current.record(JSON.parse(event.data));
      } catch {}
    });
    listenForSnapshots(events, (snapshot) => {
      if (done) return;
      try {
        acceptSnapshot(snapshot);
        lastEvent = Date.now();
      } catch {}
    });
    });
    const loop = async () => {
      try {
        if (!document.hidden && Date.now() - lastEvent > 5000) await refresh();
      } catch {}
      if (!done) timer = setTimeout(loop, 5000);
    };
    let timer: ReturnType<typeof setTimeout>;
    void loop();
    const tick = setInterval(() => { if (!document.hidden) setNow(Date.now()); }, 500);
    return () => {
      done = true;
      stopEvents();
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [refresh, acceptSnapshot]);
  useEffect(() => {
    return startWalletBalancePolling({
      refresh: refreshBalance,
      intervalMs: dialog === "funding" ? 3000 : 15000,
      visibility: document,
    });
  }, [refreshBalance, dialog]);
  const walletActivity =
    [...positions]
      .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
      .map((x) => `${x.key}:${x.state}:${x.remaining}`)
      .join("|") +
    (state.ownershipTraders ?? [])
      .filter((x) => x.owner === ownerKey)
      .map((x) => `${x.key}:${x.claimed}`)
      .join("|") + JSON.stringify([erTrader?.nextNonce, erTrader?.assets,
        state.custodies?.find(row=>row.owner===ownerKey)?.assets]);
  useEffect(() => {
    // Keeper liquidations and automatic FIFO payouts happen without a click.
    const timer = setTimeout(() => {
      if (!document.hidden) void refreshBalance().catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [walletActivity, refreshBalance]);
  const previous = useRef<Record<string, number>>({});
  useEffect(() => {
    for (const x of positions) {
      if (previous.current[x.key] === 0 && x.state !== 0) {
        setReceipts((current) => ({
          ...current,
          [x.key]: Number.MAX_SAFE_INTEGER,
        }));
      }
      if (x.state !== 0) {
        setCloseErrors((current) => {
          if (!current[x.key]) return current;
          const next = { ...current };
          delete next[x.key];
          return next;
        });
      }
      previous.current[x.key] = x.state;
    }
  }, [state.positions, ownerKey]);
  useEffect(() => {
    const closed = state.positions.filter(
      (x) => x.state !== 0 && progress[x.key],
    );
    if (closed.length)
      setProgress((current) => {
        const next = { ...current };
        for (const x of closed) delete next[x.key];
        return next;
      });
  }, [state.positions, progress]);
  async function submit(
    ixs: TransactionInstruction[],
    accountRent = 0,
    intent?: SponsoredAction | ErAction,
    sponsorOnly = false,
    onProgress: ReportProgress = () => {},
    onWithdrawalPrepared?: (slot: number, nonce: bigint) => void,
    priceWindow?: PriceAttempt,
  ) {
    if(thesisPreview)throw Error('Local preview only. No transaction was signed or sent.');
    onProgress("preparing");
    assertTradingWallet();
    if (!owner || !deployment) throw Error("Connect a wallet");
    if (sponsorOnly && !browserMode && !deployment.sponsorship)
      throw Error("Sponsored withdrawals are temporarily unavailable");
    const erAction = !!intent && ["releaseBrowserGas","withdrawBrowserGas","open", "close", "waiveCollateralProfit", "initializeTrading", "depositCollateral", "withdrawCollateral", "changeCoreStake"].includes(intent.kind);
    if (useSponsorship || (!browserMode&&sponsorOnly) || erAction) {
      if (!intent) throw Error("Sponsored action unavailable");
      const post = (url: '/api/sponsor/prepare' | '/api/sponsor/submit', data: unknown) => tradingRequest(url, data, fetch);
      if(!browserMode)priceWindow?.assertBeforeSubmit();
      const prepare=()=>{assertTradingWallet();return post("/api/sponsor/prepare",{...intent,walletMode:mode,
        ...(!browserMode&&priceWindow?{priceWaitMs:priceWindow.remainingMs()}:{})});};
      const prepared = await (["initializeTrading","depositCollateral","stakeOwnership","claimOwnership","contributePool"].includes(intent.kind)
        ? withPreparationPacing(prepare) : prepare());
      let tx = VersionedTransaction.deserialize(
        Buffer.from(prepared.transaction, "base64"),
      );
      if(intent.kind === "withdrawCollateral" && onWithdrawalPrepared) {
        const decoded = tx.message.compiledInstructions.flatMap(ix=>{
          if(!tx.message.staticAccountKeys[ix.programIdIndex]?.equals(PROGRAM)) return [];
          const instruction=(client.program.coder.instruction as BorshInstructionCoder).decode(Buffer.from(ix.data));
          return instruction?.name === "erWithdraw" ? [instruction.data as {slot:number;nonce:{toString():string};amount:{toString():string}}] : [];
        });
        if(decoded.length!==1 || decoded[0].amount.toString()!==intent.amount) throw Error("Withdrawal instruction mismatch; nothing was signed");
        onWithdrawalPrepared(decoded[0].slot,BigInt(decoded[0].nonce.toString()));
      }
      const layer: ExecutionLayer = erAction && !["initializeTrading", "depositCollateral","withdrawBrowserGas"].includes(intent.kind) ? "er" : "base";
      if ((prepared.executionLayer ?? "base") !== layer) throw Error("Unexpected transaction execution layer");
      if (!tx.message.staticAccountKeys[0].equals(browserMode?owner:sponsoredPayer(deployment, layer)))
        throw Error("Unexpected fee payer");
      if (intent.kind === "withdraw") {
        const a = walletAssets(deployment).find((a) => a.mint === intent.mint);
        const withdrawalPlan = await planWalletWithdrawal(connection, owner, intent.mint,
          BigInt(intent.amount), intent.recipient, sponsoredPayer(deployment, 'base'), a);
        const expected = new TransactionMessage({
          payerKey: sponsoredPayer(deployment, "base"),
          recentBlockhash: tx.message.recentBlockhash,
          instructions: [
            ComputeBudgetProgram.requestHeapFrame({ bytes: 128 * 1024 }),
            ComputeBudgetProgram.setComputeUnitLimit({ units: 800000 }),
            ...withdrawalPlan.ixs,
          ],
        }).compileToV0Message();
        if (
          !Buffer.from(expected.serialize()).equals(
            Buffer.from(tx.message.serialize()),
          )
        )
          throw Error("Withdrawal details changed; nothing was signed");
      }
      if (active.current !== owner.toBase58())
        throw Error("Wallet changed; please retry");
      if(!browserMode)priceWindow?.assertBeforeSubmit();
      onProgress("signing");
      tx=await approveTransaction(tx);
      if(!browserMode)priceWindow?.assertBeforeSubmit();
      onProgress("sending");
      const result = await post("/api/sponsor/submit", {
        id: prepared.id,
        transaction: Buffer.from(tx.serialize()).toString("base64"),
      });
      return confirm(result.signature, onProgress, true, layer);
    }
    await client.assertNetwork();
    if(browserMode&&intent?.kind==='withdraw') {
      const plan=await planWalletWithdrawal(connection,owner,intent.mint,BigInt(intent.amount),intent.recipient,owner,
        walletAssets(deployment).find(a=>a.mint===intent.mint));
      ixs=plan.ixs;
    }
    if(!ixs.length)throw Error('No wallet operation was prepared');
    const [hash, table] = await Promise.all([
      connection.getLatestBlockhash("confirmed"),
      transactionTables(connection, deployment, ixs),
    ]);
    if (!table.length && intent?.kind!=='withdraw') throw Error("Transaction lookup table unavailable");
    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: owner,
        recentBlockhash: hash.blockhash,
        instructions: [
          ComputeBudgetProgram.requestHeapFrame({ bytes: 128 * 1024 }),
          ComputeBudgetProgram.setComputeUnitLimit({ units: 800000 }),
          ...ixs,
        ],
      }).compileToV0Message(table),
    );
    // Check fresh funds before signing. The UI balance poll is only a hint:
    // another bet/tab may have used the wallet's SOL since its last refresh.
    const [balance, fee] = await Promise.all([
      connection.getBalance(owner, "confirmed"),
      connection.getFeeForMessage(tx.message, "confirmed"),
    ]);
    if (active.current !== owner.toBase58())
      throw Error("Wallet changed; please try again");
    setSol(balance / 1e9);
    setBalanceOwner(owner.toBase58());
    if (fee.value === null)
      throw Error("Transaction fee unavailable; please try again");
    if (balance < accountRent + fee.value)
      throw Error(solRequiredMessage(accountRent + fee.value, balance, deployment.cluster));
    onProgress("signing");
    return broadcast(await approveTransaction(tx), onProgress);
  }
  async function broadcast(
    tx: VersionedTransaction,
    onProgress: ReportProgress = () => {},
  ) {
    onProgress("sending");
    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      maxRetries: 4,
    });
    return confirm(sig, onProgress);
  }
  async function confirm(
    sig: string,
    onProgress: ReportProgress = () => {},
    sponsored = false,
    layer: ExecutionLayer = "base",
  ) {
    setSignature(sig);
    onProgress(layer === "er" ? "er-confirming" : "confirming");
    const result = sponsored
      ? await waitForSponsoredSignature(
          layer === "er" ? erConnection : connection,
          sig,
          sponsoredConfirmations.current,
        )
      : await waitForSignature(layer === "er" ? erConnection : connection, sig);
    if (result.err) {
      // The failure is already confirmed. Diagnostics must not keep controls
      // waiting on another public-RPC request; the signature links to its logs.
      throw failedTransaction(result.err, undefined, sig);
    }
    return sig;
  }

  async function action(key: string, fn: () => Promise<unknown>) {
    if (busy) return;
    return pendingActions.current.run("global", async () => {
      setBusy(key);
      setMessage("");
      try {
        await fn();
        if (key === "open") arrival.finish();
      } catch (e) {
        if (key === "open") arrival.cancel();
        console.error(
          "[acidpump-transaction] " +
            JSON.stringify({
              action: key,
              owner: ownerKey,
              ...transactionDiagnostics(e),
            }),
        );
        if(key==='open'&&browserMode&&client.profile.mainnet&&browserGasRequiredError(e)) requireSettlementGas();
        else setMessage(error(e));
      } finally {
        // Funding may have succeeded even if the subsequent bet was rejected.
        // Reconcile that balance on both paths without blocking the controls.
        void Promise.allSettled([refresh(), refreshBalance()]);
        setBusy("");
        clearProgress(key);
      }
    });
  }
  function chooseOwnSol(enabled: boolean) {
    const key = enabled ? selfPayKey(ownerKey, Date.now()) : "";
    localStorage.setItem(SELF_PAY_STORAGE_KEY, key);
    setOwnSolDay(key);
    setMessage("");
    setDialog(null);
  }
  const readFundingAccounts=useCallback(async(sender:import('@solana/web3.js').PublicKey,asset:DepositAsset)=>{
    if(![TOKEN_PROGRAM_ID.toBase58(),TOKEN_2022_PROGRAM_ID.toBase58()].includes(asset.tokenProgram))throw Error('Unsupported token program');
    const keys=[...new Set(asset.accounts?.map(a=>a.address)??[getAssociatedTokenAddressSync(pk(asset.mint),sender,false,pk(asset.tokenProgram)).toBase58()])].map(pk);
    if(!keys.length||keys.length>64)throw Error('Too many funding token accounts. Consolidate this token in your browser wallet first.');
    const infos=await connection.getMultipleAccountsInfo(keys,'confirmed');
    return infos.flatMap((info,i)=>{
      if(!info)return [];
      const account=unpackAccount(keys[i],info,pk(asset.tokenProgram));
      if(!account.owner.equals(sender)||account.mint.toBase58()!==asset.mint)throw Error('Funding token account does not match your wallet');
      return [account];
    });
  },[connection]);
  const readDepositBalance=useCallback(async(asset?:DepositAsset)=>{
    if(!browserAddress)throw Error('Connect a browser wallet first');
    await client.assertNetwork();
    if(!asset)return BigInt(await connection.getBalance(pk(browserAddress),'confirmed'));
    return (await readFundingAccounts(pk(browserAddress),asset)).reduce((sum,a)=>sum+a.amount,0n);
  },[browserAddress,client,connection,readFundingAccounts]);
  const readFundingInventory=useCallback(async(nativeOnly=false):Promise<FundingSnapshot>=>{
    if(!browserAddress)throw Error('Connect a browser wallet first');
    await client.assertNetwork();
    if(nativeOnly)return {owner:browserAddress,tokens:[],truncated:false,checkedAt:Date.now(),nativeLamports:String(await connection.getBalance(pk(browserAddress),'confirmed'))};
    const [response,native]=await Promise.all([
      fetch('/api/wallet/funding?owner='+encodeURIComponent(browserAddress),{signal:AbortSignal.timeout(15_000)}),
      connection.getBalance(pk(browserAddress),'confirmed'),
    ]);
    if(!response.ok)throw Error('Funding balances unavailable');
    const data=await response.json();
    if(data.owner!==browserAddress||!Array.isArray(data.tokens))throw Error('Funding wallet changed');
    return {...data,nativeLamports:String(native)};
  },[browserAddress,client,connection]);
  const maxFundingSol=useCallback(async()=>{
    if(!browserAddress)throw Error('Connect a browser wallet first');
    await client.assertNetwork();
    const sender=pk(browserAddress),[balance,block]=await Promise.all([connection.getBalance(sender,'confirmed'),connection.getLatestBlockhash('confirmed')]);
    const tx=new Transaction({...block,feePayer:sender}).add(...depositInstructions(sender,owner,1n));
    const fee=await connection.getFeeForMessage(tx.compileMessage(),'confirmed');
    if(fee.value===null)throw Error('Network fee unavailable. Try again.');
    return BigInt(Math.max(0,balance-fee.value));
  },[browserAddress,client,connection,ownerKey]);
  async function transferDeposit(
    amount: string,
    asset?: DepositAsset,
    destination: "local" | "reserve" = "local",
  ) {
    assertTradingWallet();
    if(!browserMode&&destination==='local'&&client.profile.mainnet&&!hasWalletBackup(localStorage,initialDeployment,ownerKey))
      throw Error('Download your wallet backup before depositing');
    if (depositLock.current || busy)
      throw Error("Wait for the current transaction");
    if (!owner || !wallet.publicKey || !wallet.wallet)
      throw Error("Connect a browser wallet first");
    if (destination === "local" && wallet.publicKey.equals(owner))
      throw Error("Choose a different funding wallet");
    if (destination === "reserve" && asset)
      throw Error("The gas reserve accepts native SOL only");
    // The shared reserve is pinned to this program's PDA, never a server-supplied address.
    const recipient = destination === "reserve" ? gasReservePda() : owner,
      localOwner = ownerKey,
      sender = wallet.publicKey,
      atoms = depositAtoms(amount, asset?.decimals ?? 9);
    depositLock.current = true;
    setBusy("fund-wallet");
    try {
      const fundingSession = await authorizeDepositWallet(() => fundingWallet.current, sender.toBase58(),
        deployment.cluster === "mainnet-beta" ? "mainnet-beta" : "devnet");
      await client.assertNetwork();
      let rent=0,sources:DepositSource[]|undefined;
      if(asset) {
        const [mint,accounts,destinationInfo]=await Promise.all([
          getMint(connection,pk(asset.mint),'confirmed',pk(asset.tokenProgram)),
          readFundingAccounts(sender,asset),
          connection.getAccountInfo(getAssociatedTokenAddressSync(pk(asset.mint),recipient,false,pk(asset.tokenProgram)),'confirmed'),
        ]);
        if(mint.decimals!==asset.decimals)throw Error('Token decimals changed; refresh balances');
        sources=depositSources(sender,asset,accounts,atoms);
        if(!destinationInfo)rent=await connection.getMinimumBalanceForRentExemption(getAccountLenForMint(mint));
      }
      const block = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({ ...block, feePayer: sender }).add(
        ...depositInstructions(sender, recipient, atoms, asset, sources),
      );
      const [balance, fee] = await Promise.all([
        connection.getBalance(sender, "confirmed"),
        connection.getFeeForMessage(tx.compileMessage(), "confirmed"),
      ]);
      if (
        fee.value === null ||
        BigInt(balance) < (asset ? 0n : atoms) + BigInt(rent + (fee.value ?? 0))
      )
        throw Error(
          "Your browser wallet needs more SOL for the deposit and account fees",
        );
      const assertDepositWallet = () => {
        fundingSession.assertCurrent();
        assertTradingWallet();
        if (active.current !== localOwner)
          throw Error("App wallet changed; transfer was not submitted. Please retry.");
        if (fundingSender.current !== sender.toBase58())
          throw Error("Funding wallet changed; transfer was not submitted. Please reconnect and retry.");
      };
      const approved = await approveDeposit(tx, fundingSession.sign, assertDepositWallet,
        async message => (await connection.getFeeForMessage(message, "confirmed")).value);
      if (BigInt(balance) < (asset ? 0n : atoms) + BigInt(rent + approved.feeLamports))
        throw Error("Your browser wallet needs more SOL for the approved network fee. Leave a little SOL for fees and retry; transfer was not submitted.");
      assertDepositWallet();
      const sig = await connection.sendRawTransaction(approved.bytes, {
        skipPreflight: false,
        maxRetries: 4,
      });
      await confirm(sig);
      void refreshBalance().catch(() => {});
      if(destination==='local')walletDiscovery.refreshAfterDeposit();
      return sig;
    } finally {
      depositLock.current = false;
      setBusy("");
    }
  }
  const deposit: DepositProps = {
    cluster: deployment.cluster,
    owner: ownerKey,
    assets: deployment ? walletAssets(deployment) : [],
    quotes:displayQuotes,quoteMint:deployment.quoteMint,now:priceNow,
    readInventory:readFundingInventory,maxSol:maxFundingSol,
    browserAddress,
    connecting: wallet.connecting,
    disconnecting: wallet.disconnecting,
    connectionError: walletConnection.error,
    cancelConnect: walletConnection.cancel,
    busy: !!busy,
    connect: () => setVisible(true),
    disconnect: () => {
      void wallet.disconnect().catch((e) => setMessage(error(e)));
    },
    readBalance: readDepositBalance,
    transfer: transferDeposit,
  };
  const reserveDeposit: DepositProps = {
    ...deposit,
    owner: gasReservePda().toBase58(),
    transfer: (amount) => transferDeposit(amount, undefined, "reserve"),
  };
  // Both wallet modes use the same signed ER intent and verified base receipt.
  // Returning custody funds ends here; it never sends an external transfer.
  async function restoreTradingTokens(a: AssetInfo, atoms: bigint,
    onProgress?: (step: string) => void, fullBalance = false) {
    let withdrawalBaseFloor=latestSnapshotSlot.current, withdrawalErFloor=state.erContextSlot??0;
    const read = async () => {
      if(active.current!==ownerKey) throw Error("Wallet changed; please retry");
      const response=await fetch("/api/state",{cache:"no-store",signal:AbortSignal.timeout(15_000)});
      if(!response.ok) throw Error("Unable to check token settlement; no external withdrawal sent");
      const snapshot:Snapshot=await response.json();acceptSnapshot(snapshot);
      if((snapshot.contextSlot??0)<withdrawalBaseFloor || (snapshot.erContextSlot??0)<withdrawalErFloor)
        throw Error("Token balances are still syncing; no external withdrawal sent");
      withdrawalBaseFloor=Math.max(withdrawalBaseFloor,snapshot.contextSlot??0);
      withdrawalErFloor=Math.max(withdrawalErFloor,snapshot.erContextSlot??0);
      if((snapshot.snapshotAgeMs??Infinity)>15_000 || (snapshot.erSnapshotAgeMs??Infinity)>5_000)
        throw Error("Token balances are still syncing; no external withdrawal sent");
      const accounts=await connection.getMultipleAccountsInfoAndContext([client.ata(owner,a),owner],{
        commitment:"confirmed",minContextSlot:Math.max(snapshot.contextSlot??0,balanceSlot.current)||undefined,
      });
      let walletAmount=(accounts.value[0]?.data.readBigUInt64LE(64)??0n)+(isSol(a)?BigInt(accounts.value[1]?.lamports??0):0n);
      if(!isSol(a)) {
        const inventory=await connection.getTokenAccountsByOwner(owner,{mint:pk(a.mint)},{commitment:'confirmed',minContextSlot:accounts.context.slot});
        walletAmount=inventory.value.reduce((sum,row)=>{
          const account=unpackAccount(row.pubkey,row.account,pk(a.tokenProgram));
          if(!account.owner.equals(owner)||account.mint.toBase58()!==a.mint)throw Error('Withdrawal account unavailable');
          return sum+(account.isInitialized&&!account.isFrozen?account.amount:0n);
        },0n);
      }
      const trader=snapshot.erTraders?.find(row=>row.owner===ownerKey);
      const key=assetPda(pk(a.mint)).toBase58();
      return {snapshot,wallet:walletAmount,available:tradingBalances(snapshot,ownerKey,{...deployment,assets:walletAssets(deployment)})[a.mint]??0n,
        pendingCredit:pendingTradingCredit(snapshot,ownerKey,a.mint),
        pendingWithdrawal:(trader?.slots??[]).filter((row:Row)=>row.state===2&&row.kind===2&&row.asset===key)
          .reduce((total:bigint,row:Row)=>total+BigInt(row.margin??0),0n)};
    };
    if(fullBalance) {
      const current=await read();
      if(current.wallet===0n&&current.available===0n&&current.pendingCredit===0n&&current.pendingWithdrawal===0n)return undefined;
    }
    return restoreWithdrawalBalance(atoms,{
      read,onProgress,
      withdraw:async available=>{
        let intent:{slot:number;nonce:bigint}|undefined;
        await submit([],0,{kind:"withdrawCollateral",owner:ownerKey,mint:a.mint,amount:available.toString()},false,
          ()=>{},(slot,nonce)=>{intent={slot,nonce};});
        if(!intent) throw Error("Withdrawal acknowledgement unavailable; no external withdrawal sent");
        const deadline=Date.now()+180_000;
        do {
          const current=await read();
          if(withdrawalAcknowledged(current.snapshot,ownerKey,intent.slot,intent.nonce)) return;
          onProgress?.("Confirming returned tokens on Solana…");
          await new Promise(resolve=>setTimeout(resolve,1000));
        } while(Date.now()<deadline);
        throw Error("Your tokens are still returning. No external withdrawal was sent; try again after settlement.");
      },
    });
  }
  const withdrawal: WithdrawProps = {
    tradingBalances: walletTradingBalances,
    returnToWallet: async (a, onProgress) => {
      assertTradingWallet();
      if (depositLock.current || busy) throw Error("Wait for the current transaction");
      const registered = walletAssets(deployment).find(token => token.mint === a.mint);
      if (!registered) throw Error("Trading token is unavailable");
      depositLock.current = true;
      setBusy("withdraw");
      try {
        await restoreTradingTokens(registered, 1n, step => onProgress?.(
          step.startsWith("Sending to your wallet address") ? "Tokens returned to your wallet" : step), true);
        await Promise.allSettled([refreshBalance(),refresh()]);
        walletDiscovery.refreshAfterDeposit();
      } finally {
        depositLock.current = false;
        setBusy("");
      }
    },
    feeCovered:!browserMode,
    cluster: deployment.cluster,
    owner: ownerKey,
    assets: deployment ? walletAssets(deployment) : [],
    balances: availableBalances,
    discovered: walletDiscovery.snapshot,
    inventoryError: walletDiscovery.error,
    quotes: displayQuotes, quoteMint: deployment.quoteMint, displays: tokenDisplays, now: priceNow,
    ready: balanceReady,
    busy: !!busy,
    browserAddress,
    connect: () => setVisible(true),
    transfer: async (a, amount, address, onProgress) => {
      assertTradingWallet();
      if (depositLock.current || busy)
        throw Error("Wait for the current transaction");
      const recipient = withdrawalRecipient(address, owner);
      const fullBalance = amount === 'all';
      let atoms = fullBalance ? 1n : depositAtoms(amount, a.decimals);
      depositLock.current = true;
      setBusy("withdraw");
      try {
        const registered = walletAssets(deployment).find(token => token.mint === a.mint);
        if (registered) {
        const a = registered;
        const restored = await restoreTradingTokens(a, atoms, onProgress, fullBalance);
        if (!restored) return '';
        if (fullBalance) atoms = restored.wallet;
        } else if (fullBalance) {
          const inventory = await connection.getTokenAccountsByOwner(owner, {mint:pk(a.mint)}, 'confirmed');
          atoms = inventory.value.reduce((sum, row) => {
            const account = unpackAccount(row.pubkey, row.account, pk(a.tokenProgram));
            if (!account.owner.equals(owner) || account.mint.toBase58() !== a.mint) throw Error('Withdrawal account unavailable');
            return sum + (account.isInitialized && !account.isFrozen ? account.amount : 0n);
          }, 0n);
          if (atoms === 0n) return '';
        }
        if(browserMode&&fullBalance&&a.mint===NATIVE_MINT.toBase58()) {
          atoms=browserWithdrawableSol(atoms);
          if(atoms===0n)return '';
        }
        const sig = await submit(
          [],
          0,
          {
            kind: "withdraw",
            owner: ownerKey,
            mint: a.mint,
            amount: atoms.toString(),
            recipient: recipient.toBase58(),
          },
          true,
          stage=>onProgress?.(stage==="confirming"?"Confirming withdrawal on Solana…":"Sending withdrawal…"),
        );
        walletDiscovery.recordWithdrawal(a.mint, atoms);
        void refreshBalance().catch(() => {});
        return sig;
      } finally {
        depositLock.current = false;
        setBusy("");
      }
    },
  };
  function open(long: boolean, button: HTMLButtonElement) {
    if(thesisPreview){setMessage('Local preview only. Trading becomes available when the USDC market is live.');return;}
    if (!canTrade || !owner || !asset || !market || !feed) return;
    if (!(long ? longCapacity : shortCapacity)) return;
    if (insufficientBalance) {
      warnInsufficientBalance();
      return;
    }
    clearBalanceNotice();
    // This existing reserve poll must be checked before waiting for prices or
    // transferring collateral, so missing gas opens the funding UI immediately.
    if(browserMode&&client.profile.mainnet&&!browserGasReady(gasStatus,ownerKey)) {
      requireSettlementGas();return;
    }
    void action("open", async () => {
      setSignature("");
      const needsBacking = client.profile.coreBacking && !exemptAssets.includes(assetPda(pk(asset.mint)).toBase58());
      if(needsBacking&&!coreAsset)throw Error("Bet backing token is unavailable; please retry");
      if(needsBacking&&!hasBackingReserve(erTrader)) {
        setDialog("backing");throw Error(`Add bet backing or choose SOL, USDC or ${coreAsset?.symbol ?? tokens.primary}`);
      }
      arrival.begin(button, {
        market: market.key,
        collateral: assetPda(pk(asset.mint)).toBase58(),
        margin: quantities.atoms.toString(),
        leverage: lev,
        long,
      });
      setOpenSide(long);
      report("open")("preparing");
      const assertActive = () => { if(active.current!==ownerKey) throw Error("Wallet changed; bet not placed. Please retry."); };
      const onWait = () => report("open")("waiting-prices");
      const checkOpening = async (deadline?: number) => {
        const {quote: executionQuote, snapshot: executionState, market: executionMarket, backing, poolUsd: executionPoolUsd} = await waitForOpeningPrices(
          () => openingSnapshot.current, market.key, asset.feedId, assetPda(pk(asset.mint)).toBase58(), {
            deadline, onWait, assertActive,
            backing: needsBacking ? {owner:ownerKey,asset:assetPda(pk(coreAsset!.mint)).toBase58(),exemptAssets} : undefined,
          },
        );
        const value = collateralUsd(quantities.atoms, executionQuote);
        if(needsBacking) {
          if(backing!.available<value) {setDialog("backing");throw Error("Add bet backing or reduce the bet to fit your available backing");}
        }
        const exposure = BigInt(executionState.exposures?.find(row=>row.owner===ownerKey)?.notional ?? "0");
        if (!canOpenUsd(value, lev, exposure, executionMarket, long, executionPoolUsd))
          throw Error("Bet size is outside the current market limits. Please adjust it and try again.");
      };
      // Check prices, backing and limits before moving collateral. Funding can
      // take time, so the same checks run again immediately before the open.
      await checkOpening();
      if(browserMode)await initializeTrading();
      let fundedState=state;
      await fundTradingShortfall(quantities.atoms,{
        onWait: () => report("open")("syncing-collateral"),
        read: async(signal)=>{
          if(active.current!==ownerKey) throw Error("Wallet changed; please retry");
          const response=await fetch("/api/state", {cache:"no-store", signal});
          if(!response.ok) throw Error("Trading balance unavailable");
          fundedState=await response.json();acceptSnapshot(fundedState);
          return {initialized:!!fundedState.custodies?.some(row=>row.owner===ownerKey),available:tradingBalances(fundedState,ownerKey,deployment)[asset.mint]??0n,wallet:balances[asset.mint]??0n,pendingCredit:pendingTradingCredit(fundedState,ownerKey,asset.mint)};
        },
        initialize: async()=>{await initializeTrading();},
        deposit: async(atoms)=>{
          await prepareTradingToken(asset,fundedState,report("open"));
          await submit([],0,{kind:"depositCollateral",owner:ownerKey,mint:asset.mint,amount:atoms.toString()},false,report("open"));
        },
      });
      await withPriceRetries("open", async window => {
        await checkOpening(window.deadline);
        await submit([], 0, {
          kind: "open", owner: ownerKey, mint: asset.mint, market: market.key,
          amount: quantities.atoms.toString(), leverage: lev, long,
        }, false, report("open"), undefined, window);
      }, { onWait, assertActive });
    });
  }
  async function initializeTrading() {
    const started=Date.now();
    try { await submit([],0,{kind:"initializeTrading",owner:ownerKey}); }
    catch(error) { if(!(error instanceof Error)||error.message!=="Trading account is already initialized") throw error; }
    // Setup and its immediate deposit respect the shared sponsorship pacing.
    const remaining=1500-(Date.now()-started);
    if(!browserMode&&remaining>0) await new Promise(resolve=>setTimeout(resolve,remaining));
  }
  async function returnCommitGas() {
    assertTradingWallet();
    if(!browserMode||busy)throw Error('Wait for the current operation');
    const trader=state.erTraders?.find(t=>t.owner===ownerKey);
    if(trader&&(trader.slots.some((s:Row)=>s.state!==0)||hasBackingReserve(trader)||trader.assets.some((a:Row)=>BigInt(a.available)>0n)))
      throw Error('Close positions, finish settlement, unlock backing and withdraw trading collateral first');
    setBusy('return-commit-gas');
    try {
      const key=client.addresses.erTraderPda(owner);
      let account=await connection.getAccountInfo(key,'confirmed');
      if(!account)throw Error('No trading session to close');
      if(!account.owner.equals(PROGRAM)) {
        await submit([],0,{kind:'releaseBrowserGas',owner:ownerKey});
        const deadline=Date.now()+120_000;
        do {
          assertTradingWallet();account=await connection.getAccountInfo(key,'confirmed');
          if(account?.owner.equals(PROGRAM))break;
          await new Promise(resolve=>setTimeout(resolve,1500));
        }while(Date.now()<deadline);
        if(!account?.owner.equals(PROGRAM))throw Error('Your session is still returning to Solana. Retry to finish returning commit gas.');
      }
      const rent=await connection.getMinimumBalanceForRentExemption(account.data.length);
      if(account.lamports<=rent)return '';
      return await submit([],0,{kind:'withdrawBrowserGas',owner:ownerKey});
    }finally{setBusy('');void refresh().catch(()=>{});}
  }
  async function prepareTradingToken(a:AssetInfo,initial:Snapshot,onProgress:ReportProgress=()=>{}) {
    await ensureCollateralDepositRoom(deployment,ownerKey,a.mint,{
      initial,
      assertActive:()=>{if(active.current!==ownerKey)throw Error("Wallet changed; bet not placed. Please retry.");},
      read:async()=>{
        const response=await fetch("/api/state",{cache:"no-store"});
        if(!response.ok)throw Error("Unable to confirm your token balance. Please retry after settlement.");
        const snapshot:Snapshot=await response.json();acceptSnapshot(snapshot);return snapshot;
      },
      onProgress:()=>onProgress("preparing-collateral"),
      withdraw:async balance=>{
        let intent:{slot:number;nonce:bigint}|undefined;
        await submit([],0,{kind:"withdrawCollateral",owner:ownerKey,mint:balance.asset.mint,amount:String(balance.amount)},false,
          ()=>onProgress("preparing-collateral"),(slot,nonce)=>{intent={slot,nonce};});
        if(!intent)throw Error("Token return acknowledgement unavailable. Please wait for settlement before retrying.");
        return intent;
      },
    });
  }
  async function changeCoreStake(atoms:bigint,unstake:boolean,selectedAsset?:AssetInfo) {
    const core=selectedAsset??primaryAsset(deployment);
    if(!core||!owner)throw Error("Core-token backing is unavailable");
    await action("core-stake",async()=>{
      if(browserMode&&!unstake)await initializeTrading();
      let fundedState=state;
      if(!unstake)await fundTradingShortfall(atoms,{
        read:async()=>{
          if(active.current!==ownerKey)throw Error("Wallet changed; please retry");
          const response=await fetch("/api/state",{cache:"no-store"});
          if(!response.ok)throw Error("Trading balance unavailable");
          const fresh:Snapshot=await response.json();fundedState=fresh;acceptSnapshot(fresh);
          return {initialized:!!fresh.custodies?.some(t=>t.owner===ownerKey),available:tradingBalances(fresh,ownerKey,deployment)[core.mint]??0n,
            wallet:balances[core.mint]??0n,pendingCredit:pendingTradingCredit(fresh,ownerKey,core.mint)};
        },initialize:initializeTrading,
        deposit:async amount=>{
          await prepareTradingToken(core,fundedState,report("core-stake"));
          await submit([],0,{kind:"depositCollateral",owner:ownerKey,mint:core.mint,amount:String(amount)});
        },
      });
      await submit([],0,{kind:"changeCoreStake",owner:ownerKey,amount:String(atoms),unstake,mint:core.mint});
    });
  }
  function requestFaucet(solOnly = false) {
    if (client.profile.mainnet) return;
    if (!owner) return;
    void action(solOnly ? "sol-faucet" : "faucet", async () => {
      const r = await fetch(solOnly ? "/api/faucet/sol" : "/api/faucet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ owner: ownerKey, mint: asset?.mint }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setSignature(data.signature);
    });
  }
  function close(x: Row, waiveProfit=false) {
    const a = findAsset(x.collateral),
      m = state.markets.find((m) => m.key === x.market);
    if (!owner || !a || !m || x.state !== 0 || (x.erPending&&!waiveProfit) || (progress[x.key]&&!waiveProfit)) return;
    if (!x.erPending && manualCloseRemainingMs({state: x.state, openedAt: x.openedAt}, closeClock()) !== 0) return;
    if(waiveProfit&&!window.confirm("Some collateral observations are missing. Close without any profit payout? Your remaining collateral will be returned; any trading loss still applies. This cannot be undone."))return;
    void pendingActions.current.run(x.key, async () => {
      let confirmed = false;
      report(x.key)("preparing");
      setCloseErrors((current) => {
        const next = { ...current };
        delete next[x.key];
        return next;
      });
      try {
        await withPriceRetries("close", async window => submit(
          [],
          0,
          { kind: waiveProfit?"waiveCollateralProfit":"close", owner: ownerKey, position: x.key },
          false,
          report(x.key),
          undefined,
          window,
        ), {
          onWait: () => report(x.key)("waiting-prices"),
          assertActive: () => { if(active.current!==ownerKey) throw Error("Wallet changed; close not submitted. Please retry."); },
        });
        confirmed = true;
        report(x.key)("committing");
        // The confirmed snapshot, not the click or a live estimate, triggers Closed!.
        await refresh().catch(() => {});
        void refreshBalance().catch(() => {});
      } catch (e) {
        console.error(
          "[acidpump-transaction] " +
            JSON.stringify({
              action: "close",
              position: x.key,
              owner: ownerKey,
              ...transactionDiagnostics(e),
            }),
        );
        setCloseErrors((current) => ({ ...current, [x.key]: error(e) }));
      } finally {
        if (!confirmed) clearProgress(x.key);
      }
    });
  }
  return (
    <PlatformTokensContext.Provider value={displayTokens}><main>
      <AcidBackdrop />
      <header className="top">
        <div className="top-intro">
          <a className="brand" href={appPath("/")} aria-label={`${appName} home`} style={{ textDecoration: "none" }}>
            <AcidBrand />
          </a>
          <button className="top-how" onClick={() => setDialog("how")}>
            <AcidHowButtonSkin />
            <span className="how-slime-label">How it works</span>
          </button>
        </div>
        <nav aria-label={`Leaderboard and ${tokens.primary} Pool`}>
          <button className="top-acid-pool top-leaderboard" onClick={() => setDialog("leaderboard")}>
            <AcidPoolButtonSkin tone="gold" />
            <span className="pool-gel-label">Leaderboard</span>
          </button>
          <button
            className="top-acid-pool"
            onClick={() => {
              setDialog("metrics");
            }}
          >
            <AcidPoolButtonSkin />
            <span className="pool-gel-label">{`${tokens.primary} Pool`}</span>
          </button>
        </nav>
      </header>
      <TradeActivityBar positions={state.positions} markets={state.markets} assets={assetsByKey} displays={tokenDisplays}
        volumes={state.betVolumeTotals} pool={state.pools.find(p=>p.id===0)?.key} ready={!!state.contextSlot&&!!state.erContextSlot}/>
      <div className="toolbar">
        <button
          className="market-select"
          aria-label={`Market: ${symbol}`}
          aria-haspopup="dialog"
          onClick={() => setDialog("market")}
        >
          <span className="market-label">{thesisSkin?'Trade':'Market'}</span>
          <Coin symbol={symbol} />
          <b className="market-ticker">${symbol}</b>
          <span className="chevron" aria-hidden="true">
            ⌄
          </span>
        </button>
        {!sdiceSkin && <SwapEffects positions={state.positions} pools={state.pools} assets={assetsByKey} quotes={state.quotes} ready={!!state.contextSlot && !!deployment} />}
        {client.profile.coreBacking && coreAsset && <button className="backing-trigger" aria-haspopup="dialog" onClick={()=>{setWalletOpen(false);setDialog("backing");}}>
          <span>Bet backing</span><strong>{backingValue===undefined?"—":"$"+usdFormat.format(Number(backingValue)/1e6)}<BackingCountdown seconds={displayedBacking.seconds}/></strong>
          <span className="backing-trigger-usage" aria-hidden="true"><i style={{width:backingValue&&backingValue>0n?`${Math.min(100,Number(displayedBacking.backing!.reserved*100n/backingValue))}%`:"0%"}}/></span>
        </button>}
        <WalletDropdown
          browserMode={browserMode}
          modeControls={modeControls}
          gasBalance={gasBalance}
          walletStatus={client.profile.mainnet?(browserMode?
            <button className="wallet-mode-status" onClick={()=>{setWalletOpen(false);setGasOpen(true);}}>Settlement gas · {gasBalance===undefined?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(gasBalance/1e9)+' SOL'} <span aria-hidden="true">→</span></button>:
            <InstantActivation owner={ownerKey} deployment={initialDeployment} onBusy={setActivationBusy}/>):undefined}
          open={walletOpen}
          onOpenChange={setWalletOpen}
          notices={walletNotices}
          discovered={walletDiscovery.snapshot}
          displays={tokenDisplays}
          register={client.profile.mainnet?registerBetToken:undefined}
          discoveryError={walletDiscovery.error}
          backingRequired={backingRequired}
          owner={ownerKey}
          assets={deployment?.assets ?? []}
          selected={asset}
          balances={balances}
          tradingBalances={walletTradingBalances}
          marketName={coreAsset?.symbol??tokens.primary}
          quotes={displayQuotes}
          now={priceNow}
          quoteMint={deployment.quoteMint}
          usdc={
            deployment ? Number(availableBalances[deployment.quoteMint] ?? 0n) / 1e6 : 0
          }
          ready={balanceReady}
          busy={busy}
          deposit={deposit}
          withdrawal={withdrawal}
          recovery={local?{wallet:local,deployment:initialDeployment,busy:!!busy||Object.keys(progress).length>0,
            backupReady,onBackupSaved:()=>setBackupReady(true),
            canRestore:()=>!depositLock.current&&!busy&&Object.keys(progress).length===0}:undefined}
          onMarket={a=>{if(a)selectBetToken(a);}}
          onFaucet={client.profile.mainnet ? undefined : requestFaucet}
          cluster={deployment.cluster}
        />
      </div>
      {browserMode&&client.profile.mainnet&&<BrowserGas owner={ownerKey} deployment={initialDeployment} connection={connection} onBusy={setActivationBusy} returnCommitGas={returnCommitGas} hideTrigger visible={gasOpen} onVisibleChange={setGasOpen} onStatus={setGasStatus}/>}
      <PriceHero feed={displayFeeds.find(row => row.id === feedId)} symbol={symbol} now={priceNow} />
      <div className="inputs">
        <div className="bet-input input-card">
          <div className="bet-heading">
            <span className="input-title">Bet with</span>
            <button
              className="collateral-select"
              aria-label={`Bet with ${asset?.symbol ?? "a token"}`}
              aria-haspopup="dialog"
              onClick={() => setDialog("collateral")}
            >
              {asset && <Coin symbol={asset.symbol} imageUrl={assetImage(tokenDisplays,asset)} />}
              <span>${asset?.symbol ?? "—"}</span>
              <span className="chevron" aria-hidden="true">
                ⌄
              </span>
            </button>
          </div>
          <input
            aria-label="Bet amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(normalizeAmountInput(e.target.value))}
          />
          <div className="bet-input-footer">
            <small title={`≈ ${cash(quantities.value)} entry value`}>≈ {cash(quantities.value)} entry value</small>
            <BetAmountPresets available={asset?availableBalances[asset.mint]??0n:0n} decimals={asset?.decimals??6}
              disabled={!balanceReady||!!busy||!!progress.open} onSelect={setAmount}/>
          </div>
        </div>
        <div className="input-card leverage-card">
          <LeverageSlider
            value={lev}
            onChange={(value) => setLeverage(String(value))}
          />
        </div>
      </div>
      <div
        className={`trade-buttons${entriesPaused ? " is-maintenance" : ""}${showInsufficientBalance ? " has-insufficient-balance" : ""}`}
      >
        {entriesPaused && <div className="entry-maintenance" role="status">UNDER MAINTENANCE</div>}
        {showInsufficientBalance && (
          <div
            className="trade-balance-overlay"
            id="trade-balance-message"
            role="status"
          >
            <span aria-hidden="true">!</span>
            <p>Insufficient balance for the bet</p>
            <button
              type="button"
              className="trade-balance-wallet"
              onClick={() => {
                clearBalanceNotice();
                setWalletOpen(true);
              }}
            >
              Open wallet
            </button>
          </div>
        )}
        <button
          className={progress.open && openSide === true ? "is-progress" : ""}
          aria-busy={!!progress.open && openSide === true}
          disabled={!canTrade || !longCapacity}
          aria-describedby={
            showInsufficientBalance ? "trade-balance-message" : undefined
          }
          onClick={(event) => open(true, event.currentTarget)}
        >
          <AcidTradeSkin long />
          <span className="acid-trade-label">
            <span aria-hidden="true">↑</span> Long
          </span>
          <small>{entriesPaused ? "Paused for upgrade" : "Bet it goes up"}</small>
          <TransactionProgress
            stage={openSide === true ? progress.open : undefined}
            label="Placing Long"
          />
        </button>
        <button
          className={progress.open && openSide === false ? "is-progress" : ""}
          aria-busy={!!progress.open && openSide === false}
          disabled={!canTrade || !shortCapacity}
          aria-describedby={
            showInsufficientBalance ? "trade-balance-message" : undefined
          }
          onClick={(event) => open(false, event.currentTarget)}
        >
          <AcidTradeSkin long={false} />
          <span className="acid-trade-label">
            <span aria-hidden="true">↓</span> Short
          </span>
          <small>{entriesPaused ? "Paused for upgrade" : "Bet it goes down"}</small>
          <TransactionProgress
            stage={openSide === false ? progress.open : undefined}
            label="Placing Short"
          />
        </button>
      </div>
      <div className="under">
        <div className="trade-info">
          <AcidInfoBorder />
          <p>
            Liquidation:{" "}
            <b>{lev >= 1 && lev <= 1000 ? fmt(100 / lev) : "—"}%</b>{" "}
            against you
          </p>
          <p className="accent">Loss → ${tokens.primary} → ${tokens.secondary}</p>
          <p className="ownership-info">Stake ${tokens.secondary} → {tokens.reward?`$${tokens.reward}`:'platform profit'}</p>
        </div>
        <div className="pool-reward-station" role="group" aria-label="Pool and available rewards">
          <RewardBeaker tone="teal" active={hasStakeRewards} onClick={showCurrentPool} />
          <AcidPoolButton
            hasRewards={hasStakeRewards || hasClaimRewards}
            symbol={tokens.reward ?? findAsset(pool?.settlement)?.symbol ?? tokens.primary}
            onClick={showCurrentPool}
          />
          <RewardBeaker tone="lime" active={hasClaimRewards} onClick={showCurrentPool} />
        </div>
      </div>
      {lowSol && (
        <p className="notice">
          Refill {client.profile.mainnet ? "SOL" : "devnet SOL"} from your wallet to place a bet
        </p>
      )}
      {quantities.value > 0n && (!longCapacity || !shortCapacity) && (
        <p className="notice">
          {quantities.value < 1_000_000n
            ? "Minimum entry value is $1"
            : poolUsd === null
              ? "Refreshing market limits… Please wait a moment."
            : quantities.value *
                  BigInt(Number.isInteger(lev) && lev > 0 ? lev : 1) +
                  existingExposure >
                poolExposureLimit(poolUsd)
              ? `Maximum combined open exposure in this market is ${cash(poolExposureLimit(poolUsd))}`
              : "This size exceeds the available directional exposure limit"}
        </p>
      )}
      {(!Number.isInteger(lev) || lev < 1 || lev > 1000) && (
        <p className="notice">
          Choose a whole-number leverage from 1× to 1000×
        </p>
      )}
      {message && (
        <div role="status" className="message">
          <div className="message-content">
            <span>{message}</span>
            {isSolFundingError(message) && owner && (
              <button
                className="message-funding"
                onClick={() => openFunding(message)}
              >
                Add SOL
              </button>
            )}
          </div>
          <button aria-label="Dismiss message" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      <section className="positions" ref={arrival.listRef}>
        {visiblePositions.map((x) => {
          const a = findAsset(x.collateral),
            m = state.markets.find((m) => m.key === x.market),
            displayFeed = displayFeeds.find((f) => f.key === m?.feed),
            f = x.erPending && displayFeed ? { ...displayFeed, price:x.exit, observations:[] } : displayFeed,
            cp = state.pools.find((p) => p.key === x.pool),
            poolToken = findAsset(cp?.settlement);
          if (!a || !f) return null;
          const ownershipIssued =
            x.state === 0
              ? (state.snapshotAgeMs ?? 1e9) < 15000
                ? estimateOwnership(
                    x,
                    f,
                    cp,
                    displayQuotes.find((q) => q.id === a.feedId),
                    state.quotes.find((q) => q.id === poolToken?.feedId),
                    priceNow,
                    {
                      treasury: BigInt(
                        state.inventories.find(
                          (i) =>
                            i.pool === x.pool && i.asset === cp?.settlement,
                        )?.treasury ?? "0",
                      ),
                      highwater: BigInt(
                        state.ownershipPools?.find((p) => p.pool === x.pool)
                          ?.tailProgressUsd ?? "0",
                      ),
                      backing: backingEstimate,
                    },
                  )
                : null
              : (state.ownershipReceipts?.find((r) => r.position === x.key)
                  ?.issued ?? null);
          const ownershipText = `${ownershipIssued === null ? "—" : "+" + units(ownershipIssued, poolToken?.decimals)} $${tokens.secondary}`;
          const displayPnl = positionPnls.get(x.key) ?? null;
          const livePnl = displayPnl ?? 0n;
          const locked = positionLock(x);
          const poolChange = estimatePoolChange(
            x,
            f,
            cp,
            displayQuotes.find((q) => q.id === a.feedId),
            state.quotes.find((q) => q.id === poolToken?.feedId),
            priceNow,
            {
              treasury: BigInt(
                state.inventories.find(
                  (i) => i.pool === x.pool && i.asset === cp?.settlement,
                )?.treasury ?? "0",
              ),
              snapshotAgeMs: state.snapshotAgeMs,
              backing: backingEstimate,
              payoutBasis: "claim",
            },
          );
          const notional = cash(BigInt(x.entryValue) * BigInt(x.leverage));
          return (
            <article
              className={
                "position " +
                (x.state === 0 ? "open" : "closed") +
                (receipts[x.key] > now ? " has-overlay" : "")
              }
              key={x.key}
              data-position-key={x.key}
              onClick={(event) => {
                if (
                  x.state !== 0 &&
                  !(event.target as Element).closest(
                    "button, a, input, select, .position-overlay",
                  )
                ) {
                  manualReceipts.current.add(x.key);
                  setReceipts((current) => ({
                    ...current,
                    [x.key]: Number.MAX_SAFE_INTEGER,
                  }));
                }
              }}
            >
              {x.state === 0 && <ActivePositionAcid />}
              <div className="position-top">
                <div className="position-summary">
                  <h3>
                    <Coin symbol={f.symbol} />
                    <span>
                      {f.symbol} {x.long ? "Long" : "Short"}
                    </span>
                    <span
                      className={
                        "position-direction " +
                        (x.long ? "positive" : "negative")
                      }
                      aria-hidden="true"
                    >
                      {x.long ? "↑" : "↓"}
                    </span>
                  </h3>
                  <b
                    className="bet"
                    style={
                      {
                        "--bet-em":
                          (units(x.margin, a.decimals).length +
                            a.symbol.length +
                            4) *
                          0.58,
                      } as React.CSSProperties
                    }
                  >
                    <span className="bet-amount">
                      <Coin symbol={a.symbol} imageUrl={assetImage(tokenDisplays,a)} />
                      {units(x.margin, a.decimals)}
                    </span>
                    <span className="bet-token">${a.symbol}</span>
                  </b>
                  <small>
                    {cash(x.entryValue)} × {x.leverage}
                  </small>
                </div>
                <PositionResult position={x} pnl={displayPnl} poolToken={poolToken}
                  quote={displayQuotes.find(q => q.id === poolToken?.feedId)} now={priceNow}
                  ownershipText={ownershipText} onStake={() => showOwnership(x.pool)}/>
                <div className="close-control">
                  <div className="close-button-wrap">
                    <PositionCloseButton position={x} closing={!!progress[x.key]}
                      clock={closeClock} onClose={() => close(x)} />
                    <TransactionProgress
                      stage={x.state === 0 ? (x.erPending ? x.settlementStage ?? "committing" : progress[x.key]) : undefined}
                      label={locked === "price" ? "Price locked" : "Closing"}
                      compact
                    />
                  </div>
                  <small>Open {clockTime(x.openedAt)}</small>
                  <small>Close {x.state ? clockTime(x.closedAt) : "—"}</small>
                </div>
              </div>
              {x.state === 0 && closeErrors[x.key] && (
                <div className="close-error" role="alert">
                  <span>{closeErrors[x.key]}</span>
                  {isSolFundingError(closeErrors[x.key]) && (
                    <button onClick={() => openFunding(closeErrors[x.key])}>
                      Add SOL
                    </button>
                  )}
                  <button
                    aria-label="Dismiss close error"
                    onClick={() =>
                      setCloseErrors((current) => {
                        const next = { ...current };
                        delete next[x.key];
                        return next;
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              )}
              <PositionLiquidationMeter
                position={x}
                price={x.erPending ? x.exit : f.price}
                pnl={livePnl}
                fresh={x.erPending || isFresh(f, priceNow)}
                liquidatable={x.state === 0 && (x.erPending ? x.liquidated : crossed(x, f))}
              />
              <small
                className="position-pool-flow"
                title={
                  x.state === 0
                    ? poolChange === null
                      ? "Pool-change estimate unavailable · final amount uses the executed swap"
                      : poolChange > 0n
                        ? "Estimated pool swap receipt if closed now · before surplus transfers or older FIFO payouts"
                        : `Estimated $${tokens.primary} needed for this profit at the current spot price · unpaid profit waits in FIFO`
                    : poolChange === null
                      ? "Reading confirmed token payout records"
                      : "Confirmed pool receipts or tokens paid for this position"
                }
              >
                {poolChange === null ? (
                  "—"
                ) : (
                  <>
                    {x.state === 0 ? "≈ " : ""}
                    {poolChange < 0n ? "−" : "+"}
                    {units(
                      poolChange < 0n ? -poolChange : poolChange,
                      poolToken?.decimals,
                    )}
                  </>
                )}{" "}
                ${poolToken?.symbol ?? tokens.primary}
              </small>
              <div className="position-bottom">
                <div className="position-exposure">
                  <div className="position-exposure-value">
                    <b>{notional}</b>{" "}
                    <span className={x.long ? "positive" : "negative"}>
                      {f.symbol} {x.long ? "Long" : "Short"}
                    </span>{" "}
                    <span className="position-entry-price">
                      @ {formatMarketValue(Number(x.entry) / 1e12)}
                    </span>
                  </div>
                </div>
                <div className="position-bottom-actions">
                  <button
                    className="position-receipt-button"
                    style={x.state === 0 ? { visibility: "hidden" } : undefined}
                    disabled={x.state === 0}
                    tabIndex={x.state === 0 ? -1 : 0}
                    aria-hidden={x.state === 0 || undefined}
                    aria-label="Replay settlement story"
                    onClick={() => {
                      manualReceipts.current.add(x.key);
                      setReceipts((current) => ({
                        ...current,
                        [x.key]: Number.MAX_SAFE_INTEGER,
                      }));
                    }}
                  >
                    Replay ↻
                  </button>
                  <PositionShareButton
                    cluster={deployment.cluster}
                    details={{
                      state: x.state,
                      long: x.long,
                      market: f.symbol,
                      margin: x.margin,
                      decimals: a.decimals,
                      collateral: a.symbol,
                      entryValue: x.entryValue,
                      leverage: x.leverage,
                      pnl: displayPnl?.toString() ?? null,
                      poolTokens: poolChange?.toString() ?? null,
                      ownershipTokens: ownershipIssued?.toString() ?? null,
                      platformToken: poolToken?.symbol ?? tokens.primary,
                      ownershipToken: tokens.secondary,
                      platformDecimals: poolToken?.decimals ?? 6,
                    }}
                  />
                </div>
              </div>
              {receipts[x.key] > now && (
                <SettlementReceipt
                  position={x}
                  cluster={deployment.cluster}
                  collateral={a}
                  collateralImageUrl={assetImage(tokenDisplays,a)}
                  poolToken={poolToken}
                  rewardToken={isPerpsMarket(deployment) ? perpsRewardAsset(deployment) : poolToken}
                  payoutQuote={displayQuotes.find(q => q.id === poolToken?.feedId)}
                  priceNow={priceNow}
                  pnl={livePnl}
                  ownership={ownershipIssued}
                  onStake={() => showOwnership(x.pool)}
                  onComplete={() => {
                    if(!manualReceipts.current.has(x.key))
                      setReceipts(current=>({...current,[x.key]:0}));
                  }}
                  onInteract={() => {
                    manualReceipts.current.add(x.key);
                    setReceipts((current) => ({
                      ...current,
                      [x.key]: Number.MAX_SAFE_INTEGER,
                    }));
                  }}
                  onPayoutUpdate={() =>
                    setReceipts((current) => {
                      const visibleUntil = current[x.key] ?? 0;
                      const updatedAt = Date.now();
                      return visibleUntil > updatedAt
                        ? {
                            ...current,
                            [x.key]: Math.max(visibleUntil, updatedAt + 12_000),
                          }
                        : current;
                    })
                  }
                  onDismiss={() => {
                    manualReceipts.current.delete(x.key);
                    setReceipts((current) => ({ ...current, [x.key]: 0 }));
                  }}
                />
              )}
            </article>
          );
        })}
        {positions.length > visiblePositions.length && <p className="position-history-limit">Showing the latest {HISTORY_LIMIT} completed positions. Open positions and pending payouts stay visible.</p>}
      </section>
      {dialog === "backing" && coreAsset && <Modal title="Bet backing" close={closeDialog}>
        <CoreBacking asset={coreAsset} trader={erTrader} backing={displayedBacking.backing} refreshSeconds={displayedBacking.seconds} exemptAssets={exemptAssets}
          choices={client.program.idl.instructions.some(ix=>ix.name==='erChangeBacking')?[...new Map([coreAsset,...deployment.assets.filter(a=>auxiliaryBackingMints(deployment).includes(a.mint))].map(a=>[a.mint,a])).values()].map(a=>{
            const quote=state.erQuotes?.find(q=>q.asset===assetPda(pk(a.mint)).toBase58());
            return {asset:a,available:availableBalances[a.mint]??0n,quoteSample:quote?{quote,at:priceNow}:undefined};
          }):undefined}
          quoteSample={displayedBacking.quoteSample} available={availableBalances[coreAsset.mint]??0n} busy={busy==="core-stake"} onChange={changeCoreStake}/>
      </Modal>}
      {dialog === "ownership" && (
        <Modal title="Pool & Rewards" close={closeDialog}>
          <AcidRewards
            key={ownerKey + rewardPool?.key}
            walletReady={balanceReady}
            treasury={rewardTreasury}
            treasurySymbol={tokens.primary}
            treasuryDecimals={coreAsset?.decimals??6}
            available={BigInt(rewardTrader?.available ?? "0")}
            staked={BigInt(rewardTrader?.staked ?? "0")}
            claimable={revenueAvailable}
            claimed={BigInt(rewardTrader?.claimed ?? "0")}
            walletBalance={availableBalances[rewardAsset?.mint ?? ""] ?? 0n}
            decimals={rewardAsset?.decimals ?? 6}
            symbol={rewardAsset?.symbol ?? tokens.primary}
            busy={busy}
            onStake={() => ownershipAction("stakeOwnership")}
            onClaim={() => ownershipAction("claimOwnership")}
            confirmation={
              rewardConfirmation?.owner === ownerKey &&
              rewardConfirmation.pool === rewardPool?.key
                ? rewardConfirmation
                : null
            }
          />
          {owner && rewardAsset && !client.addresses.venueConfig && client.program.idl.instructions.some(ix=>ix.name==='contributePool') &&
            <PoolContribution key={ownerKey} balance={balances[rewardAsset.mint]??0n} decimals={rewardAsset.decimals}
              queued={BigInt(rewardPool?.queueUsd??0)>0n || BigInt(rewardPool?.queueHead??0)<BigInt(rewardPool?.queueTail??0)}
              poolUsd={state.poolExposure?poolUsd:null} busy={!!busy}
              status={busy==='contributePool'?progress[busy]?.replaceAll('-',' '):undefined} onContribute={contributePool}/>}
          {(busy === 'stakeOwnership' || busy === 'claimOwnership') && <p role="status" className="ownership-note">
            {progress[busy] === 'confirming' ? 'Confirming on Solana. Keep this open; no refresh needed.' :
              progress[busy] === 'signing' ? (browserMode ? 'Approve in your browser wallet…' : 'Signing…') :
              progress[busy] === 'sending' ? 'Sending transaction…' : 'Preparing transaction…'}
            {progress[busy] === 'confirming' && signature && <a href={solscanTransaction(signature, deployment.cluster) ?? undefined} target="_blank" rel="noopener noreferrer"> View transaction ↗</a>}
          </p>}
          {message && (
            <p role="status" className="ownership-note">
              {message}
              {isSolFundingError(message) && (
                <button onClick={() => openFunding(message)}>Add SOL</button>
              )}
            </p>
          )}
        </Modal>
      )}
      {dialog === "funding" && owner && (
        <SolFunding
          key={ownerKey}
          platformTrading
          owner={ownerKey}
          sol={sol}
          ready={balanceReady}
          selfPay={selfPay}
          close={closeDialog}
          deposit={deposit}
          reserveDeposit={reserveDeposit}
          reason={fundingReason}
          proceed={() => chooseOwnSol(true)}
          sponsored={() => chooseOwnSol(false)}
        />
      )}
      {dialog === "market" && (
        <Modal title="Market" close={closeDialog}>
          <div className="token-options">
            <small className="option-group">Core markets</small>
            {CORE_MARKETS.map(({ symbol: s, id }) => (
              <button
                key={s}
                aria-pressed={feedId === id}
                onClick={() => {
                  setFeedId(id);
                  closeDialog();
                }}
              >
                <Coin symbol={s} />
                <span>{s}</span>
                {feedId === id && <span className="chosen">✓</span>}
              </button>
            ))}
          </div>
          <p className="market-note">USDC payout pool · Profits paid in USDC</p>
        </Modal>
      )}
      {dialog === "collateral" && (
        <Modal title="Bet with" close={closeDialog}>
          <BetTokenList assets={deployment.assets} balances={availableBalances} quotes={displayQuotes} quoteMint={deployment.quoteMint}
            now={priceNow} ready={balanceReady} selected={asset?.mint} discovered={walletDiscovery.snapshot} error={walletDiscovery.error} backingRequired={backingRequired}
            displays={tokenDisplays} register={client.profile.mainnet?registerBetToken:undefined}
            select={selectBetToken}/>

        </Modal>
      )}
      {dialog === "how" && (
        <Modal title={`How ${appName} works`} close={closeDialog}>
          <AcidHow cluster={deployment.cluster} />
        </Modal>
      )}
      {registrationToken&&<TokenRegistration token={registrationToken} wallet={local} deployment={deployment} connection={connection}
        onClose={()=>setRegistrationToken(null)} onReady={next=>{client.deployment=next;setDeployment(next);setAssetIndex(next.assets.findIndex(a=>a.mint===registrationToken.mint));setRegistrationToken(null);setWalletOpen(false);setDialog(null);}}/>}
      {dialog === "metrics" && (
        <Modal title={`${tokens.primary} Pool`} close={closeDialog}>
          <AcidMetrics model={platformMetrics(state, priceNow)} cluster={deployment.cluster} />
        </Modal>
      )}
      {dialog==='leaderboard'&&<Modal title="Leaderboard" close={closeDialog}><Leaderboard deployment={deployment} state={{...state,feeds:displayFeeds,quotes:displayQuotes}} now={priceNow} tokenDisplays={tokenDisplays} owner={ownerKey}
        signMessage={async message=>{assertTradingWallet();const signature=local?ed25519.sign(message,local.secretKey.slice(0,32)):await wallet.signMessage?.(message);assertTradingWallet();if(!signature)throw Error('This browser wallet does not support message signing');return signature;}}/></Modal>}
      <nav className="public-site-links" aria-label="Site pages"><a href={appPath("/")}>Home</a><a href={docsHref()}>Docs</a></nav>
    </main></PlatformTokensContext.Provider>
  );
}

