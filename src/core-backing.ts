import { PublicKey } from "@solana/web3.js";
import { NATIVE_MINT } from "@solana/spl-token";
import { isPrimary, type Deployment, type Row } from "./client.ts";
import { programAddresses } from "./program-addresses.ts";
import { sellUsd } from "./math.ts";
import { normalizeMainnetRow } from './quote-context.ts';
import { erCollateralFresh } from './collateral-value.ts';
import { auxiliaryBackingMints } from './backing-assets.ts';

/** Asset identities match the contract; a token named SOL/USDC is not exempt. */
export function backingExemptAssets(deployment: Deployment): readonly string[] {
  const addresses = programAddresses(deployment.programId);
  const core = deployment.assets.find(a => isPrimary(a));
  const auxiliary = auxiliaryBackingMints(deployment);
  return [NATIVE_MINT.toBase58(), deployment.quoteMint, ...(core ? [core.mint] : []),
    ...(auxiliary[1] !== deployment.quoteMint ? [auxiliary[1]] : [])]
    .map(mint => addresses.assetPda(new PublicKey(mint)).toBase58());
}
export function backedPositions(trader: Row, exemptAssets: readonly string[]) {
  return (trader.slots as Row[]).map((s,index):Row & {index:number}=>({...s,index}))
    .filter(s=>s.kind===1&&s.state!==0&&!exemptAssets.includes(s.asset));
}

/** Reconcile confirmed coverage not yet acknowledged by the ER ledger. */
export function availableBackingTokens(trader?: Row, custody?: Row): bigint | null {
  try {
    if (!trader?.coreStake) return null;
    const tokens = BigInt(trader.coreStake.tokens);
    if (tokens === 0n) return 0n;
    if (!custody?.coreCoverage || custody.owner !== trader.owner) return null;
    const debited = BigInt(custody.coreCoverage.debitedTokens), acknowledged = BigInt(trader.coreStake.acknowledgedDebits);
    const pending = debited > acknowledged ? debited - acknowledged : 0n;
    return tokens >= pending && tokens >= 0n ? tokens - pending : null;
  } catch { return null; }
}

/** Reconcile each reserve independently; old accounts have zero auxiliaries. */
export function availableAuxiliaryBacking(trader?:Row,custody?:Row):[bigint,bigint]|null {
  try {
    if(!trader)return null;
    return [0,1].map(i=> {
      const stake=trader.auxiliaryStakes?.[i],tokens=BigInt(stake?.tokens??0);
      if(tokens===0n)return 0n;
      if(tokens<0n||!custody||custody.owner!==trader.owner||!custody.auxiliaryCoverage?.[i])throw Error('Backing acknowledgement unavailable');
      const delta=BigInt(custody.auxiliaryCoverage[i].debitedTokens)-BigInt(stake.acknowledgedDebits);
      const available=tokens-(delta>0n?delta:0n);
      if(available<0n)throw Error('Backing acknowledgement exceeds reserve');
      return available;
    }) as [bigint,bigint];
  }catch{return null;}
}

/** Full-amount swap value from the shared ER quote, including fees and price impact. */
export function coreBackingValue(tokens: bigint, quote: Row, now = Date.now(), kind:'pool'|'sol'|'usdc'='pool') {
  quote=normalizeMainnetRow(quote);
  const m = quote.mainnet;
  if (tokens < 0n || !erCollateralFresh(quote, now,kind))
    throw Error("Waiting for a fresh core-token backing quote");
  if(kind==='usdc')return tokens;
  if(kind==='sol')return tokens*BigInt(quote.quoteReserve)/1_000_000_000_000_000n;
  return sellUsd(tokens, {...quote,
    realQuoteReserve:m?.realQuoteReserve??quote.quoteReserve,
    quoteUsd:quote.quoteUsd??"1000000000000", quoteDecimals:quote.quoteDecimals??6});
}

/** Uses the shared ER quote. No RPC or spot-price multiplication per wallet. */
export function coreBacking(trader: Row, quote: Row, now = Date.now(), exemptAssets: readonly string[] = [], auxiliaryQuotes:readonly Row[] = []) {
  if (!trader.coreStake) throw Error("Waiting for a fresh core-token backing quote");
  const kind=quote.asset&&quote.asset===exemptAssets[0]?'sol':quote.asset&&quote.asset===exemptAssets[1]?'usdc':'pool';
  const primaryTokens=BigInt(trader.coreStake.tokens);
  if(primaryTokens<0n)throw Error('Invalid backing reserve');
  let value = primaryTokens>0n?coreBackingValue(primaryTokens, quote, now,kind):0n;
  const auxiliary=trader.auxiliaryStakes??[];
  for(let i=0;i<2;i++) {
    const tokens=BigInt(auxiliary[i]?.tokens??0);
    if(tokens<0n)throw Error('Invalid backing reserve');
    if(tokens===0n)continue;
    const asset = i === 1 && exemptAssets[3] ? exemptAssets[3] : exemptAssets[i];
    if(!asset||quote.asset===asset)throw Error('Duplicate or unknown backing asset');
    const sample=auxiliaryQuotes.find(q=>q.asset===asset);
    if(!sample)throw Error('Waiting for a fresh core-token backing quote');
    value+=coreBackingValue(tokens,sample,now,i===0?'sol':exemptAssets[3]?'pool':'usdc');
    if(value>(1n<<64n)-1n)throw Error('Backing value exceeds contract capacity');
  }
  const positions = backedPositions(trader, exemptAssets);
  const reserved = positions.reduce((n,s)=>n+BigInt(s.entryValue),0n);
  const pending = positions.some(s=>s.state===2);
  const debt = BigInt(trader.coreStake.incurredUsd)-BigInt(trader.coreStake.repaidUsd);
  if (debt < 0n) throw Error("Invalid core backing liability");
  const oldest = positions.filter(s=>s.state===1).sort((a,b)=>Number(a.openedAt)-Number(b.openedAt)||
    (BigInt(a.nonce)<BigInt(b.nonce)?-1:1))[0];
  return {value,reserved,pending,poolShortfall:debt,available:value<reserved?0n:value-reserved,
    forceSlot:!pending&&oldest&&value<reserved?oldest.index:undefined};
}

export function hasBackingReserve(trader?:Row):boolean {
  return [trader?.coreStake,...(trader?.auxiliaryStakes??[])].some(s=>BigInt(s?.tokens??0)>0n);
}
