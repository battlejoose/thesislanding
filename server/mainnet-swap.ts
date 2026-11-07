// Fixed PumpSwap instructions for the mainnet adapter. These builders neither
// submit transactions nor select arbitrary programs supplied by a caller.
import { PublicKey, SystemProgram, TransactionInstruction, type AccountMeta } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import { poolV2Pda, POOL_ACCOUNT_NEW_SIZE } from "@pump-fun/pump-swap-sdk";
import { FEES, FEE_PROGRAM, GLOBAL, PUMP } from "../src/pump.ts";
import { validatedMainnetSolPool, validatedMainnetTokenPool, validatedMainnetConversionPool, type MainnetPoolSnapshot } from "./mainnet-pool.ts";

const derive = (...seeds: (string | Uint8Array)[]) => PublicKey.findProgramAddressSync(seeds.map(s => Buffer.from(s)), PUMP)[0];
export function mainnetSwapAccounts(snapshot: MainnetPoolSnapshot, authority: PublicKey, base: PublicKey, quote: PublicKey, buy: boolean, allowEmptyCollateral = false): AccountMeta[] {
  // Settlement may not need a swap at all (a winner or worthless collateral).
  // Account assembly can allow that state; executed swaps remain strict on chain.
  return legacyAccounts(snapshot, validatedMainnetSolPool(snapshot, allowEmptyCollateral), authority, base, quote, buy);
}
type ValidatedPool = ReturnType<typeof validatedMainnetTokenPool>;
function legacyAccounts(snapshot: MainnetPoolSnapshot, validated: ValidatedPool, authority: PublicKey, base: PublicKey, quote: PublicKey, buy: boolean): AccountMeta[] {
  const pool = validated.pool;
  if (base.equals(quote) || base.equals(pool.poolBaseTokenAccount) || quote.equals(pool.poolQuoteTokenAccount)) throw Error("Swap custody and pool accounts must be distinct");
  const recipient = pool.isMayhemMode ? validated.globalConfig.reservedFeeRecipient : validated.globalConfig.protocolFeeRecipients[0];
  const buyback = validated.globalConfig.buybackFeeRecipients[0];
  if (!recipient || !buyback || recipient.equals(PublicKey.default) || buyback.equals(PublicKey.default)) throw Error("Missing verified Pump fee recipient");
  const creator = derive("creator_vault", pool.coinCreator.toBytes());
  const ata = (owner: PublicKey) => getAssociatedTokenAddressSync(validated.quoteMint, owner, true, validated.quoteProgram);
  const rows: [PublicKey, boolean][] = [
    [snapshot.pool, true], [authority, true], [GLOBAL, false], [snapshot.mint, false], [validated.quoteMint, false],
    [base, true], [quote, true], [pool.poolBaseTokenAccount, true], [pool.poolQuoteTokenAccount, true],
    [recipient, false], [ata(recipient), true], [validated.tokenProgram, false], [validated.quoteProgram, false],
    [SystemProgram.programId, false], [ASSOCIATED_TOKEN_PROGRAM_ID, false], [derive("__event_authority"), false],
    [PUMP, false], [ata(creator), true], [creator, false],
  ];
  const volume = derive("user_volume_accumulator", authority.toBytes());
  if (buy) rows.push([derive("global_volume_accumulator"), false], [volume, true]);
  rows.push([FEES, false], [FEE_PROGRAM, false]);
  // Pump's remaining-account order is significant: cashback, pool v2, buyback.
  if (pool.isCashbackCoin) {
    rows.push([ata(volume), true]);
    if (!buy) rows.push([volume, true]);
  }
  if (!pool.coinCreator.equals(PublicKey.default)) rows.push([poolV2Pda(snapshot.mint), false]);
  rows.push([buyback, false], [ata(buyback), true]);
  return rows.map(([pubkey, isWritable]) => ({ pubkey, isWritable, isSigner: false }));
}

/** The compact PumpSwap ABI keeps fees in the pool, with unchanged execution
 * quotes. Cashback pools must continue using the original instruction. */
export function mainnetSwapV2Accounts(snapshot: MainnetPoolSnapshot, authority: PublicKey, base: PublicKey, quote: PublicKey, allowEmptyCollateral = false): AccountMeta[] {
  return compactAccounts(snapshot,validatedMainnetSolPool(snapshot,allowEmptyCollateral),authority,base,quote);
}
function compactAccounts(snapshot: MainnetPoolSnapshot,v:ValidatedPool,authority:PublicKey,base:PublicKey,quote:PublicKey):AccountMeta[]{
  const p=v.pool;
  if(p.isCashbackCoin)throw Error('Cashback pools require PumpSwap v1');
  if(base.equals(quote)||base.equals(p.poolBaseTokenAccount)||quote.equals(p.poolQuoteTokenAccount))throw Error('Swap custody and pool accounts must be distinct');
  const buyback=v.globalConfig.buybackFeeRecipients[0];
  if(!buyback||buyback.equals(PublicKey.default))throw Error('Missing verified Pump buyback recipient');
  const rows:[PublicKey,boolean][]=[
    [snapshot.pool,true],[authority,true],[GLOBAL,false],[snapshot.mint,false],[v.quoteMint,false],
    [base,true],[quote,true],[p.poolBaseTokenAccount,true],[p.poolQuoteTokenAccount,true],
    [v.tokenProgram,false],[v.quoteProgram,false],[SystemProgram.programId,false],
    [derive('user_volume_accumulator',authority.toBytes()),true],[FEES,false],
    [getAssociatedTokenAddressSync(v.quoteMint,buyback,true,v.quoteProgram),true],
    [derive('__event_authority'),false],[PUMP,false],
  ];
  return rows.map(([pubkey,isWritable])=>({pubkey,isWritable,isSigner:false}));
}

/** Explicit token denomination; never infer a SOL intermediate. */
export function mainnetTokenSwapAccounts(snapshot:MainnetPoolSnapshot,expectedQuote:PublicKey,authority:PublicKey,base:PublicKey,quote:PublicKey,buy:boolean,allowEmptyCollateral=false):AccountMeta[]{
  const v=validatedMainnetTokenPool(snapshot,expectedQuote,allowEmptyCollateral);
  return v.pool.isCashbackCoin?legacyAccounts(snapshot,v,authority,base,quote,buy):compactAccounts(snapshot,v,authority,base,quote);
}
/** Sell a bound intermediate currency through the same PumpSwap ABIs. */
export function mainnetConversionSwapAccounts(snapshot:MainnetPoolSnapshot,inputMint:PublicKey,expectedQuote:PublicKey,authority:PublicKey,base:PublicKey,quote:PublicKey,allowEmptyCollateral=false):AccountMeta[]{
  const v=validatedMainnetConversionPool(snapshot,inputMint,expectedQuote,allowEmptyCollateral);
  return v.pool.isCashbackCoin?legacyAccounts(snapshot,v,authority,base,quote,false):compactAccounts(snapshot,v,authority,base,quote);
}
/** A separate service payer funds every potentially rent-bearing destination.
 * Each instruction is idempotent and can be staged before atomic settlement. */
export function mainnetTokenSwapPreparation(snapshot:MainnetPoolSnapshot,expectedQuote:PublicKey,payer:PublicKey,authority:PublicKey):TransactionInstruction[]{
  return swapPreparation(snapshot,validatedMainnetTokenPool(snapshot,expectedQuote,true),payer,authority);
}
export function mainnetConversionSwapPreparation(snapshot:MainnetPoolSnapshot,inputMint:PublicKey,expectedQuote:PublicKey,payer:PublicKey,authority:PublicKey):TransactionInstruction[]{
  return swapPreparation(snapshot,validatedMainnetConversionPool(snapshot,inputMint,expectedQuote,true),payer,authority);
}
function swapPreparation(snapshot:MainnetPoolSnapshot,v:ValidatedPool,payer:PublicKey,authority:PublicKey):TransactionInstruction[]{
  const expectedQuote=v.quoteMint,volume=derive('user_volume_accumulator',authority.toBytes());
  const event=derive('__event_authority');
  const rows:[PublicKey,boolean,boolean][]=[[payer,true,true],[authority,false,false],[volume,true,false],[SystemProgram.programId,false,false],[event,false,false],[PUMP,false,false]];
  const result:TransactionInstruction[]=[];
  if(snapshot.accounts.get(snapshot.pool.toBase58())!.data.length<POOL_ACCOUNT_NEW_SIZE){
    const extend:[PublicKey,boolean,boolean][]=[[snapshot.pool,true,false],[payer,true,true],[SystemProgram.programId,false,false],[event,false,false],[PUMP,false,false]];
    result.push(new TransactionInstruction({programId:PUMP,data:Buffer.from([234,102,194,203,150,72,62,229]),
      keys:extend.map(([pubkey,isWritable,isSigner])=>({pubkey,isWritable,isSigner}))}));
  }
  result.push(new TransactionInstruction({programId:PUMP,data:Buffer.from([94,6,202,115,255,96,232,183]),keys:rows.map(([pubkey,isWritable,isSigner])=>({pubkey,isWritable,isSigner}))}));
  const buyback=v.globalConfig.buybackFeeRecipients[0];
  const owners=[authority,buyback];
  if(v.pool.isCashbackCoin)owners.push(v.pool.isMayhemMode?v.globalConfig.reservedFeeRecipient:v.globalConfig.protocolFeeRecipients[0],derive('creator_vault',v.pool.coinCreator.toBytes()),volume);
  for(const owner of owners){
    if(!owner||owner.equals(PublicKey.default))throw Error('Missing verified Pump fee recipient');
    result.push(createAssociatedTokenAccountIdempotentInstruction(payer,getAssociatedTokenAddressSync(expectedQuote,owner,true,v.quoteProgram),owner,expectedQuote,v.quoteProgram));
  }
  return result;
}

export function mainnetSwapData(buy: boolean, amount: bigint, minOut: bigint, compact = false) {
  if (amount <= 0n || amount > (1n << 64n) - 1n || minOut <= 0n || minOut > (1n << 64n) - 1n) throw Error("Invalid positive u64 swap amount");
  const data = Buffer.alloc(buy && !compact ? 25 : 24);
  Buffer.from(compact ? (buy ? [194,171,28,70,104,77,91,47] : [93,246,130,60,231,233,64,178])
    : buy ? [198,46,21,82,180,217,232,112] : [51,230,133,164,1,127,131,173]).copy(data);
  data.writeBigUInt64LE(amount, 8); data.writeBigUInt64LE(minOut, 16);
  if (buy && !compact) data[24] = 0;
  return data;
}

/** Standalone form for offline execution tests; production uses PDA-signed CPI. */
export function mainnetSwapInstruction(snapshot: MainnetPoolSnapshot, authority: PublicKey, base: PublicKey, quote: PublicKey, buy: boolean, amount: bigint, minOut: bigint, compact = false) {
  const keys = compact ? mainnetSwapV2Accounts(snapshot,authority,base,quote) : mainnetSwapAccounts(snapshot, authority, base, quote, buy);
  keys[1] = { ...keys[1], isSigner: true };
  return new TransactionInstruction({ programId: PUMP, keys, data: mainnetSwapData(buy, amount, minOut, compact) });
}
