import { Connection, PublicKey, SYSVAR_CLOCK_PUBKEY, type AccountInfo } from "@solana/web3.js";
import { NATIVE_MINT, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { PUMP_AMM_SDK } from "@pump-fun/pump-swap-sdk";
import type { AssetInfo } from "./client.ts";
import { GLOBAL, FEES } from "./pump.ts";
import { MAINNET_USDC, MAINNET_USDC_POOL } from "./deployment-profile.ts";
import { validatedMainnetSolPool, type MainnetPoolSnapshot } from "../server/mainnet-pool.ts";
import { mainnetSwapAccounts, mainnetSwapV2Accounts, mainnetTokenSwapAccounts, mainnetTokenSwapPreparation } from "../server/mainnet-swap.ts";
import { isRegisteredCurve, validatedMainnetSolRoute, validatedMainnetTokenRoute } from "../server/mainnet-route.ts";

type Route={mint:string;pool:string;tokenProgram:string;quoteMint:string};
function validateRoute(snapshot:MainnetPoolSnapshot,registered:PublicKey,quoteMint:PublicKey,allowEmpty=false){
  if(quoteMint.equals(NATIVE_MINT))return validatedMainnetSolRoute(snapshot,registered,allowEmpty);
  if(quoteMint.toBase58()!==MAINNET_USDC)throw Error('Quote token requires an executable USD conversion route');
  return validatedMainnetTokenRoute(snapshot,quoteMint,registered,allowEmpty);
}

/** Reuse account snapshots supplied by the runtime. Builders perform a bounded
 * batched fetch only when those snapshots are missing or stale; no polling timer. */
export class MainnetRoutes {
  private readonly snapshots = new Map<string, { value: MainnetPoolSnapshot; observedAt: number }>();
  private readonly loading = new Map<string, Promise<void>>();
  constructor(readonly connection: Connection, readonly now = Date.now) {}
  install(snapshot: MainnetPoolSnapshot, allowEmptyCollateral = false, registered = snapshot.pool, quoteMint=NATIVE_MINT) {
    validateRoute(snapshot, registered, quoteMint, allowEmptyCollateral);
    const key = registered.toBase58(), old = this.snapshots.get(key);
    if (old && snapshot.slot < old.value.slot) throw Error("Mainnet route snapshot moved backwards");
    this.snapshots.set(key, { value: snapshot, observedAt: this.now() });
  }
  private route(asset: AssetInfo) {
    if(asset.mint!==NATIVE_MINT.toBase58()&&asset.mint!==MAINNET_USDC&&isRegisteredCurve(new PublicKey(asset.mint),new PublicKey(asset.dexPool)))throw Error('Token must graduate to PumpSwap before registration');
    return asset.mint === NATIVE_MINT.toBase58() || asset.mint === MAINNET_USDC
      ? { mint: MAINNET_USDC, pool: MAINNET_USDC_POOL, tokenProgram:TOKEN_PROGRAM_ID.toBase58(),quoteMint:NATIVE_MINT.toBase58() }
      : { mint: asset.mint, pool: asset.dexPool, tokenProgram:asset.tokenProgram,quoteMint:asset.quoteMint??NATIVE_MINT.toBase58() };
  }
  snapshot(asset: AssetInfo) {
    const route = this.route(asset), result = this.snapshots.get(route.pool)?.value;
    if (!result || result.mint.toBase58() !== route.mint) throw Error("Mainnet settlement route not loaded");
    return result;
  }
  async ensure(assets: AssetInfo[], allowEmptyCollateral = false) {
    const routes = [...new Map(assets.map(asset => { const r = this.route(asset); return [r.pool, r] as const; })).values()];
    const needed = routes.filter(r => { const cached = this.snapshots.get(r.pool); return !cached || this.now() - cached.observedAt > 1000; });
    const validateCached = () => routes.forEach(r => {
      const cached=this.snapshots.get(r.pool);
      if (!cached) throw Error('Mainnet route snapshot unavailable');
      validateRoute(cached.value,new PublicKey(r.pool),new PublicKey(r.quoteMint),allowEmptyCollateral);
    });
    // A shared zero-value observation must not bypass stricter registration or
    // payout requirements just because the cache is fresh. No extra RPC reads.
    if (!needed.length) return validateCached();
    const key = `${allowEmptyCollateral}:` + needed.map(r => `${r.pool}:${r.mint}:${r.quoteMint}`).sort().join(",");
    const previous = this.loading.get(key); if (previous) { await previous; return validateCached(); }
    const task = this.load(needed, allowEmptyCollateral).finally(() => this.loading.delete(key));
    this.loading.set(key, task); await task; validateCached();
  }
  /** Shared quote polling also refreshes the execution-route cache. The clock
   * travels in the existing reserve batch, without another RPC request. */
  async refresh(assets: AssetInfo[]) {
    const routes = [...new Map(assets.map(asset => { const r = this.route(asset); return [r.pool, r] as const; })).values()];
    await this.load(routes, true, true);
    return assets.map(asset => this.snapshot(asset));
  }
  private async load(routes: Route[], allowEmptyCollateral = false, requireClock = false) {
    // Each final read contains every account used to validate that route.
    // Keep batches below the RPC's 100-account limit.
    const batchSize=20;
    for (let start = 0; start < routes.length; start += batchSize) {
      const group = routes.slice(start, start + batchSize);
      // Reuse only validated pool ACCOUNT ADDRESSES. Reserves, mint state,
      // configuration, fees and Clock are still read together from a fresh
      // bank below. This removes a serial discovery RPC from each quote tick.
      const missing=group.filter(r=>!this.snapshots.has(r.pool));
      const discovered=missing.length?await this.connection.getMultipleAccountsInfoAndContext(missing.map(r=>new PublicKey(r.pool)),"confirmed"):undefined;
      let discoveryFloor=discovered?.context.slot??0;
      const keys = new Map<string, PublicKey>([SYSVAR_CLOCK_PUBKEY, GLOBAL, FEES].map(k => [k.toBase58(), k]));
      group.forEach(r => {
        const mint=new PublicKey(r.mint),registered=new PublicKey(r.pool),quoteMint=new PublicKey(r.quoteMint);
        if(!quoteMint.equals(NATIVE_MINT)&&r.quoteMint!==MAINNET_USDC)throw Error('Quote token requires an executable USD conversion route');
        if(!quoteMint.equals(NATIVE_MINT))keys.set(r.quoteMint,quoteMint);
        const cached=this.snapshots.get(r.pool)?.value;
        discoveryFloor=Math.max(discoveryFloor,cached?.slot??0);
        const account = cached?.accounts.get(r.pool)??discovered?.value[missing.findIndex(next=>next.pool===r.pool)];
        if (!account) throw Error("Mainnet pool unavailable");
        const pool = PUMP_AMM_SDK.decodePool(account);
        for (const k of [new PublicKey(r.pool), new PublicKey(r.mint), pool.poolBaseTokenAccount, pool.poolQuoteTokenAccount]) keys.set(k.toBase58(), k);
      });
      const addresses = [...keys.values()];
      let response = await this.connection.getMultipleAccountsInfoAndContext(addresses, { commitment: "confirmed", minContextSlot: discoveryFloor });
      if(requireClock) {
        // Some RPC banks briefly return a Clock from a different slot. Re-read
        // the ENTIRE reserve batch, never splice in a newer Clock or retime a
        // cached quote. Keep recovery bounded and fail closed if it persists.
        const clockIndex=addresses.findIndex(key=>key.equals(SYSVAR_CLOCK_PUBKEY));
        for(let attempt=0;;attempt++) {
          const clock=response.value[clockIndex];
          if(!clock||clock.data.length!==40)throw Error('Mainnet pool clock unavailable');
          if(clock.data.readBigUInt64LE(0)===BigInt(response.context.slot))break;
          if(attempt===2)throw Error('Mainnet collateral needs a coherent chain clock');
          const floor=Math.max(discoveryFloor,response.context.slot);
          response=await this.connection.getMultipleAccountsInfoAndContext(addresses,{commitment:'confirmed',minContextSlot:floor});
          if(response.context.slot<floor)throw Error('Mainnet reserve recovery moved backwards');
        }
      }
      if (response.context.slot < discoveryFloor || response.value.length !== addresses.length) throw Error("Incomplete mainnet route snapshot");
      const accounts = new Map<string, AccountInfo<Buffer>>();
      response.value.forEach((value, index) => { if (value) accounts.set(addresses[index].toBase58(), value); });
      const snapshots = group.map(r => ({slot:response.context.slot,pool:new PublicKey(r.pool),mint:new PublicKey(r.mint),accounts}));
      try {snapshots.forEach((s,i)=>validateRoute(s,new PublicKey(group[i].pool),new PublicKey(group[i].quoteMint),allowEmptyCollateral));}
      catch(error){
        // A pool layout/vault change must rediscover its addresses next time,
        // never fall back to old reserves from the validated cache.
        for(const r of group)this.snapshots.delete(r.pool);
        throw error;
      }
      // Validate the whole batch before installing any snapshot.
      snapshots.forEach((s,i)=>{const old=this.snapshots.get(group[i].pool)?.value;
        if(old&&s.slot<old.slot)throw Error('Mainnet route snapshot moved backwards');});
      snapshots.forEach((s,i)=>this.install(s,allowEmptyCollateral,new PublicKey(group[i].pool),new PublicKey(group[i].quoteMint)));
    }
  }
  valuation(asset: AssetInfo) {
    const source = this.snapshot(asset),spec=this.route(asset),route=validateRoute(source,new PublicKey(spec.pool),new PublicKey(spec.quoteMint),true);
    const payout = this.snapshots.get(MAINNET_USDC_POOL)?.value;
    if (!payout) throw Error("USDC payout route not loaded");
    const usdPool = validatedMainnetSolPool(payout).pool;
    return { dexPool: source.pool, dexMint: source.mint, dexBase: route.baseVault,
      dexQuote: route.quoteVault, globalConfig: GLOBAL, feeConfig: FEES, sourceGlobal:route.global, sourceFees:route.fees,
      usdPool: payout.pool, usdMint: payout.mint, usdBase: usdPool.poolBaseTokenAccount, usdQuote: usdPool.poolQuoteTokenAccount };
  }
  swap(asset: AssetInfo, authority: PublicKey, base: PublicKey, quote: PublicKey, buy: boolean, allowEmptyCollateral = false) {
    if (asset.mint === NATIVE_MINT.toBase58()) throw Error("Native SOL uses a vault transfer, not a swap");
    if(asset.quoteMint&&asset.quoteMint!==NATIVE_MINT.toBase58()) {
      if(asset.quoteMint!==MAINNET_USDC)throw Error('Quote token requires an executable USD conversion route');
      if(buy)throw Error('Token-quoted primary buying is not enabled');
      const snapshot=this.snapshot(asset),mint=new PublicKey(MAINNET_USDC);
      const route=validatedMainnetTokenRoute(snapshot,mint,new PublicKey(asset.dexPool),allowEmptyCollateral);
      if(route.value.tokenProgram.toBase58()!==asset.tokenProgram)throw Error('Mainnet asset and route token program differ');
      const intermediate=getAssociatedTokenAddressSync(mint,authority,true,TOKEN_PROGRAM_ID);
      const source=mainnetTokenSwapAccounts(snapshot,mint,authority,base,intermediate,false,allowEmptyCollateral);
      const payout=this.snapshots.get(MAINNET_USDC_POOL)?.value;
      if(!payout)throw Error('USDC conversion route not loaded');
      const conversion=validatedMainnetSolPool(payout).pool.isCashbackCoin
        ?mainnetSwapAccounts(payout,authority,intermediate,quote,false)
        :mainnetSwapV2Accounts(payout,authority,intermediate,quote);
      return [...source,...conversion];
    }
    const snapshot = this.snapshot(asset), route=validatedMainnetSolRoute(snapshot,new PublicKey(asset.dexPool),allowEmptyCollateral),validated=route.value;
    if (snapshot.mint.toBase58() !== asset.mint || validated.tokenProgram.toBase58() !== asset.tokenProgram)
      throw Error("Mainnet asset and route token program differ");
    return route.value.pool.isCashbackCoin ? mainnetSwapAccounts(snapshot, authority, base, quote, buy, allowEmptyCollateral)
      : mainnetSwapV2Accounts(snapshot,authority,base,quote,allowEmptyCollateral);
  }
  prepareSell(asset:AssetInfo,payer:PublicKey,authority:PublicKey) {
    if(asset.mint===NATIVE_MINT.toBase58())return [];
    if(asset.quoteMint&&asset.quoteMint!==NATIVE_MINT.toBase58()) {
      if(asset.quoteMint!==MAINNET_USDC)throw Error('Quote token requires an executable USD conversion route');
      const snapshot=this.snapshot(asset),quote=new PublicKey(asset.quoteMint);
      const route=validatedMainnetTokenRoute(snapshot,quote,new PublicKey(asset.dexPool),true);
      return mainnetTokenSwapPreparation(snapshot,quote,payer,authority);
    }
    const snapshot=this.snapshot(asset),route=validatedMainnetSolRoute(snapshot,new PublicKey(asset.dexPool),true);
    return [];
  }
}
