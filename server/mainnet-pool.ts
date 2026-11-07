// Validated mainnet PumpSwap quotes for the settlement and collateral adapters.
import BN from "bn.js";
import { PublicKey, type AccountInfo } from "@solana/web3.js";
import { NATIVE_MINT, NATIVE_MINT_2022, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, MintLayout, unpackMint, unpackAccount, getExtensionTypes, ExtensionType } from "@solana/spl-token";
import { PUMP_AMM_SDK, poolPda, sellBaseInput, buyQuoteInput, computeFeesBps, USDC_MINT } from "@pump-fun/pump-swap-sdk";
import { PUMP, FEE_PROGRAM, FEES, GLOBAL } from "../src/pump.ts";

export type MainnetPoolSnapshot = {
  slot: number; pool: PublicKey; mint: PublicKey;
  accounts: Map<string, AccountInfo<Buffer>>;
};
export function validatedMainnetSolPool(snapshot: MainnetPoolSnapshot, allowEmptyCollateral = false) {
  const q = validatedPool(snapshot, NATIVE_MINT, allowEmptyCollateral);
  return { ...q, sellUsdMicro(baseUnits: bigint, solUsdE12: bigint) {
    if (solUsdE12 <= 0n || solUsdE12 > 1_000_000_000_000_000_000n) throw Error("Invalid verified SOL/USD input");
    return q.sell(baseUnits) * solUsdE12 / 1_000_000_000_000_000n;
  } };
}
export function validatedMainnetTokenPool(snapshot: MainnetPoolSnapshot, expectedQuote: PublicKey, allowEmptyCollateral = false) {
  if ([PublicKey.default, NATIVE_MINT, NATIVE_MINT_2022].some(k => k.equals(expectedQuote)))
    throw Error('A non-native quote mint is required');
  return validatedPool(snapshot, expectedQuote, allowEmptyCollateral);
}
/** Only for an intermediate mint already bound as the preceding Pump venue's
 * quote. Issued currencies (for example wrapped BTC) can retain issuer mint /
 * freeze authority; they never become user collateral through this reader. */
export function validatedMainnetConversionPool(snapshot: MainnetPoolSnapshot, inputMint: PublicKey, expectedQuote: PublicKey, allowEmptyCollateral = false) {
  if (!snapshot.mint.equals(inputMint) || [PublicKey.default,NATIVE_MINT,NATIVE_MINT_2022].some(m=>m.equals(inputMint)) ||
      [PublicKey.default,NATIVE_MINT_2022,inputMint].some(m=>m.equals(expectedQuote)))
    throw Error('Invalid conversion mint binding');
  return validatedPool(snapshot, expectedQuote, allowEmptyCollateral, true);
}
function validatedPool(snapshot: MainnetPoolSnapshot, expectedQuote: PublicKey, allowEmptyCollateral: boolean, intermediate = false) {
  if (!Number.isSafeInteger(snapshot.slot) || snapshot.slot <= 0) throw Error("Invalid finalized snapshot slot");
  const get = (key: PublicKey, owner?: PublicKey) => {
    const account = snapshot.accounts.get(key.toBase58());
    if (!account || account.executable || (owner && !account.owner.equals(owner))) throw Error("Invalid route account owner or missing account");
    return account;
  };
  const poolInfo = get(snapshot.pool, PUMP);
  // Pump's versioned pool reader treats absent appended fields as zero. Reject
  // malformed booleans rather than letting the JS decoder coerce them to true.
  if (poolInfo.data.length < 211 || [243, 244, 269, 270].some(i => (poolInfo.data[i] ?? 0) > 1)) throw Error("Invalid pool layout or mode");
  for (const [start, size] of [[211, 32], [245, 16], [261, 8], [271, 8], [279, 8]])
    if (poolInfo.data.length > start && poolInfo.data.length < start + size) throw Error("Truncated pool field");
  const pool = PUMP_AMM_SDK.decodePool(poolInfo);
  if (!pool.baseMint.equals(snapshot.mint) || !pool.quoteMint.equals(expectedQuote) ||
      !poolPda(pool.index, pool.creator, pool.baseMint, pool.quoteMint).equals(snapshot.pool)) throw Error("Invalid pool mint or PDA binding");
  const mintInfo = get(snapshot.mint);
  if (![TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].some(p => mintInfo.owner.equals(p))) throw Error("Unsupported mint program");
  const mint = unpackMint(snapshot.mint, mintInfo, mintInfo.owner);
  const isUsdc = snapshot.mint.equals(USDC_MINT) && mintInfo.owner.equals(TOKEN_PROGRAM_ID) && mint.decimals === 6;
  if ((!isUsdc && !intermediate && (mint.freezeAuthority || mint.mintAuthority)) || !mint.isInitialized || mint.decimals > 9) throw Error("Unsupported mint authority or precision");
  const extensions = getExtensionTypes(mint.tlvData);
  if (extensions.some(e => ![ExtensionType.MetadataPointer, ExtensionType.TokenMetadata].includes(e))) throw Error("Unsupported mint extension");
  const native = expectedQuote.equals(NATIVE_MINT);
  const quoteInfo = native ? undefined : get(expectedQuote);
  const quoteProgram = quoteInfo?.owner ?? TOKEN_PROGRAM_ID;
  if (![TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].some(p => p.equals(quoteProgram))) throw Error('Unsupported quote token program');
  const quoteMint = quoteInfo ? unpackMint(expectedQuote, quoteInfo, quoteProgram) : undefined;
  if (quoteMint && (!quoteMint.isInitialized || quoteMint.decimals > 9 ||
      (expectedQuote.equals(USDC_MINT) && (!quoteProgram.equals(TOKEN_PROGRAM_ID) || quoteMint.decimals !== 6)) ||
      getExtensionTypes(quoteMint.tlvData).some(e => ![ExtensionType.MetadataPointer, ExtensionType.TokenMetadata].includes(e))))
    throw Error('Unsupported quote mint');
  const base = unpackAccount(pool.poolBaseTokenAccount, get(pool.poolBaseTokenAccount, mintInfo.owner), mintInfo.owner);
  const quote = unpackAccount(pool.poolQuoteTokenAccount, get(pool.poolQuoteTokenAccount, quoteProgram), quoteProgram);
  const feeBuckets = BigInt(pool.protocolFees.add(pool.creatorFees).toString());
  if (feeBuckets > quote.amount) throw Error("Pool retained fees exceed quote vault");
  const availableQuote = quote.amount - feeBuckets;
  if (!base.owner.equals(snapshot.pool) || !quote.owner.equals(snapshot.pool) || !base.mint.equals(snapshot.mint) || !quote.mint.equals(expectedQuote) || !base.isInitialized || !quote.isInitialized || base.isFrozen || quote.isFrozen ||
      (!allowEmptyCollateral && (base.amount <= 0n || availableQuote <= 0n))) throw Error("Invalid vault binding or liquidity");
  const globalConfig = PUMP_AMM_SDK.decodeGlobalConfig(get(GLOBAL, PUMP));
  const feeConfig = PUMP_AMM_SDK.decodeFeeConfig(get(FEES, FEE_PROGRAM));
  // A quote must not claim a route is usable while either swap direction is
  // disabled. Pump bits 3 and 4 disable buy and sell respectively.
  if ((globalConfig.disableFlags & 24) !== 0) throw Error("Pump swaps disabled");
  const effectiveQuote = new BN(quote.amount.toString()).add(pool.virtualQuoteReserves);
  const empty = base.amount === 0n || availableQuote === 0n;
  if (effectiveQuote.lten(0) && !(allowEmptyCollateral && empty)) throw Error("Invalid effective quote reserve");
  const args = {
    globalConfig, feeConfig, baseMint: snapshot.mint, baseMintAccount: MintLayout.decode(mintInfo.data.subarray(0, 82)),
    coinCreator: pool.coinCreator, creator: pool.creator, quoteMint: pool.quoteMint,
    baseReserve: new BN(base.amount.toString()), quoteReserve: new BN(quote.amount.toString()),
    feeBucketsTotal: new BN(feeBuckets.toString()),
    virtualQuoteReserves: pool.virtualQuoteReserves, isMayhemMode: pool.isMayhemMode, creatorFeeBps: pool.creatorFeeBps,
  };
  // No executable trade or fee exists for an empty pool. Record a zero-value
  // collateral observation instead of hiding the drain behind a quote error.
  const fees = allowEmptyCollateral && empty ? {lpFeeBps:new BN(0),protocolFeeBps:new BN(0),creatorFeeBps:new BN(0)}
    : computeFeesBps({ ...args, baseMintSupply: new BN(mint.supply.toString()), quoteReserve: effectiveQuote });
  const feeBps = [fees.lpFeeBps, fees.protocolFeeBps, pool.coinCreator.equals(PublicKey.default) ? new BN(0) : fees.creatorFeeBps].map(f => {
    if (f.isNeg() || f.gten(10000)) throw Error("Invalid swap fee");
    return f.toNumber();
  });
  if (feeBps.reduce((a, b) => a + b, 0) >= 10000) throw Error("Invalid total swap fee");
  const amount = (value: bigint) => {
    if (value <= 0n || value > 18_446_744_073_709_551_615n) throw Error("Amount outside u64 range");
    return new BN(value.toString());
  };
  return {
    slot: snapshot.slot, pool, mint, tokenProgram: mintInfo.owner, globalConfig,
    quoteMint: expectedQuote, quoteProgram, quoteDecimals: quoteMint?.decimals ?? 9,
    // Normalize to the existing ER quote schema: spendable real reserves plus
    // an adjusted virtual component still equals Pump's effective reserves.
    baseReserve: base.amount, quoteReserve: availableQuote, retainedFees: feeBuckets,
    virtualQuoteReserve: BigInt(pool.virtualQuoteReserves.toString()) + feeBuckets, feeBps,
    sell(baseUnits: bigint) {
      const result = sellBaseInput({ ...args, base: amount(baseUnits), slippage: 0 });
      return BigInt(result.uiQuote.toString());
    },
    buy(quoteAtoms: bigint) {
      const result = buyQuoteInput({ ...args, quote: amount(quoteAtoms), slippage: 0 });
      return BigInt(result.base.toString());
    },
  };
}
