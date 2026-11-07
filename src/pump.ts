import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  type AccountMeta,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import type { AssetInfo, Deployment, Row } from "./client.ts";
import { sellUsd, ceil } from "./math.ts";
export const PUMP = new PublicKey(
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA",
);
export const FEE_PROGRAM = new PublicKey(
  "pfeeUxB6jkeY1Hxd7CsFCAjcbHA9rWtchMGdZ6VojVZ",
);
const pda = (program: PublicKey, ...seeds: (string | Uint8Array)[]) =>
  PublicKey.findProgramAddressSync(
    seeds.map((s) => Buffer.from(s)),
    program,
  )[0];
export const FEES = pda(FEE_PROGRAM, "fee_config", PUMP.toBytes());
export const GLOBAL = pda(PUMP, "global_config");
export const externalVaults = (a: AssetInfo, quoteMint: string) => a.mint===quoteMint ? {
  dexPool: new PublicKey(quoteMint), dexBase: new PublicKey(quoteMint),
  dexQuote: new PublicKey(quoteMint), feeConfig: FEES,
} : ({
  dexPool: new PublicKey(a.dexPool),
  dexBase: getAssociatedTokenAddressSync(
    new PublicKey(a.mint),
    new PublicKey(a.dexPool),
    true,
    new PublicKey(a.tokenProgram),
  ),
  dexQuote: getAssociatedTokenAddressSync(
    new PublicKey(quoteMint),
    new PublicKey(a.dexPool),
    true,
    TOKEN_PROGRAM_ID,
  ),
  feeConfig: FEES,
});
// One getMultipleAccounts call returns at most 100 accounts: the clock, the
// fee configuration and three accounts per token.
const QUOTE_TOKENS_PER_READ = 32;
export async function readQuotes(
  connection: Connection,
  d: Deployment,
  minContextSlot?: number,
): Promise<Row[]> {
  const assets = [...new Map([...d.assets, ...(d.gasAsset ? [d.gasAsset] : [])].filter(a=>a.mint!==d.quoteMint).map(a=>[a.mint,a])).values()];
  if (assets.length <= QUOTE_TOKENS_PER_READ) return readQuoteSnapshot(connection, d, assets, minContextSlot);
  // Each read is its own consistent snapshot; rows carry their own slot and time.
  const reads: AssetInfo[][] = [];
  for (let i = 0; i < assets.length; i += QUOTE_TOKENS_PER_READ) reads.push(assets.slice(i, i + QUOTE_TOKENS_PER_READ));
  // The quote token's own fixed row comes once, from the first read.
  return (await Promise.all(reads.map((read, index) => readQuoteSnapshot(connection, d, read, minContextSlot, index === 0)))).flat();
}
async function readQuoteSnapshot(
  connection: Connection,
  d: Deployment,
  assets: AssetInfo[],
  minContextSlot?: number,
  quoteRow = true,
): Promise<Row[]> {
  const groups = assets.map((a) => externalVaults(a, d.quoteMint));
  const snapshot = await connection.getMultipleAccountsInfoAndContext(
    [
      SYSVAR_CLOCK_PUBKEY,
      FEES,
      ...groups.flatMap((g) => [g.dexPool, g.dexBase, g.dexQuote]),
    ],
    { commitment: "confirmed", minContextSlot },
  );
  const [clock, fee] = snapshot.value;
  if (!clock || clock.data.length !== 40) throw Error("Swap quote unavailable: missing chain clock");
  if (clock.data.readBigUInt64LE(0) !== BigInt(snapshot.context.slot))
    throw Error(`Swap quote unavailable: clock slot ${clock.data.readBigUInt64LE(0)} differs from snapshot slot ${snapshot.context.slot}`);
  if (!fee || !fee.owner.equals(FEE_PROGRAM)) throw Error("Swap quote unavailable: invalid fee configuration");
  const feeBps = [
    Number(fee.data.readBigUInt64LE(41)),
    Number(fee.data.readBigUInt64LE(49)),
    0,
  ];
  const quotes = assets.map((a, i) => {
    const [pool, base, quote] = snapshot.value.slice(2 + i * 3, 5 + i * 3);
    if (!pool?.owner.equals(PUMP) || !base || !quote)
      throw Error("Missing PumpSwap test pool");
    if (!base.owner.equals(new PublicKey(a.tokenProgram)) || !quote.owner.equals(TOKEN_PROGRAM_ID) ||
        base.data.length < 165 || quote.data.length < 165 ||
        !new PublicKey(base.data.subarray(0, 32)).equals(new PublicKey(a.mint)) ||
        !new PublicKey(quote.data.subarray(0, 32)).equals(new PublicKey(d.quoteMint)) ||
        !new PublicKey(base.data.subarray(32, 64)).equals(new PublicKey(a.dexPool)) ||
        !new PublicKey(quote.data.subarray(32, 64)).equals(new PublicKey(a.dexPool)))
      throw Error("Invalid collateral quote vault binding");
    const baseReserve = base.data.readBigUInt64LE(64),
      quoteReserve = quote.data.readBigUInt64LE(64);
    return {
      key: a.dexPool,
      id: a.feedId,
      price: (
        baseReserve===0n ? 0n : (quoteReserve * 10n ** BigInt(a.decimals) * 1000000n) /
        baseReserve
      ).toString(),
      baseReserve: baseReserve.toString(),
      quoteReserve: quoteReserve.toString(),
      realQuoteReserve: quoteReserve.toString(),
      quoteUsd: "1000000000000",
      quoteDecimals: 6,
      feeBps,
      publishTime: clock.data.readBigInt64LE(32).toString(),
      sourceSlot: String(snapshot.context.slot),
    };
  });
  if (quoteRow && d.assets.some(a=>a.mint===d.quoteMint)) quotes.push({key:d.quoteMint,id:104,price:"1000000000000",baseReserve:"0",quoteReserve:"0",realQuoteReserve:"0",quoteUsd:"1000000000000",quoteDecimals:6,feeBps:[0,0,0],publishTime:clock.data.readBigInt64LE(32).toString(),sourceSlot:String(snapshot.context.slot),quoteCollateral:true} as any);
  return quotes;
}
export function buyOut(quote: bigint, f: Row) {
  const fees = (f.feeBps as number[]).map(BigInt);
  let net = (quote * 10000n) / (10000n + fees.reduce((s, x) => s + x, 0n));
  const total = net + fees.reduce((s, x) => s + ceil(net * x, 10000n), 0n);
  if (total > quote) net -= total - quote;
  if (net <= 1n) return 0n;
  net -= 1n;
  return (BigInt(f.baseReserve) * net) / (BigInt(f.quoteReserve) + net);
}
export function routeEstimate(amount: bigint, from: Row, to: Row) {
  return buyOut(sellUsd(amount, from), to);
}
/** Cached, executable mainnet sale in quote atoms, including all pool fees. */
export function sellQuoteAtoms(amount:bigint, quote:Row):bigint {
  const base=BigInt(quote.baseReserve), reserve=BigInt(quote.quoteReserve);
  if(amount<0n||base<=0n||reserve<=0n||!Array.isArray(quote.feeBps)||quote.feeBps.length!==3||
    quote.feeBps.some((f:number)=>!Number.isInteger(f)||f<0)||quote.feeBps.reduce((n:number,f:number)=>n+f,0)>=10000)
    throw Error('Executable sale quote unavailable');
  const gross=amount*reserve/(base+amount),fees=quote.feeBps.map((f:number)=>ceil(gross*BigInt(f),10000n));
  if(gross-fees[0]>BigInt(quote.realQuoteReserve))return 0n;
  const total=fees.reduce((n:bigint,f:bigint)=>n+f,0n);
  return gross>total?gross-total:0n;
}
/** Native-market and mixed-backing estimates keep SOL/USDC atoms distinct. */
export function mainnetSolProceeds(amount:bigint,from:Row):bigint {
  if(from.id===103&&from.erNative)return amount;
  if(from.id===104&&from.quoteCollateral)return sellQuoteAtoms(amount,from.conversionPool);
  const quote=sellQuoteAtoms(amount,from);
  return from.quoteDecimals===6?sellQuoteAtoms(quote,from.conversionPool):quote;
}
export function mainnetPrimaryReceipt(sol:bigint,to:Row):bigint {
  if(to.id===103&&to.erNative)return sol;
  return buyOut(sol,to.id===104&&to.quoteCollateral?to.conversionPool:to);
}
export function swapAccounts(
  d: Deployment,
  a: AssetInfo,
  authority: PublicKey,
  base: PublicKey,
  quote: PublicKey,
  buy: boolean,
): AccountMeta[] {
  const v = externalVaults(a, d.quoteMint),
    q = new PublicKey(d.quoteMint),
    bp = new PublicKey(a.tokenProgram);
  const creator = pda(PUMP, "creator_vault", PublicKey.default.toBytes());
  const recipient = new PublicKey(d.feeRecipient!),
    buyback = new PublicKey(d.buybackRecipient!);
  const keys: [PublicKey, boolean][] = [
    [v.dexPool, true],
    [authority, true],
    [GLOBAL, false],
    [new PublicKey(a.mint), false],
    [q, false],
    [base, true],
    [quote, true],
    [v.dexBase, true],
    [v.dexQuote, true],
    [recipient, false],
    [getAssociatedTokenAddressSync(q, recipient, true), true],
    [bp, false],
    [TOKEN_PROGRAM_ID, false],
    [SystemProgram.programId, false],
    [ASSOCIATED_TOKEN_PROGRAM_ID, false],
    [pda(PUMP, "__event_authority"), false],
    [PUMP, false],
    [getAssociatedTokenAddressSync(q, creator, true), true],
    [creator, false],
  ];
  if (buy)
    keys.push(
      [pda(PUMP, "global_volume_accumulator"), false],
      [pda(PUMP, "user_volume_accumulator", authority.toBytes()), true],
    );
  keys.push(
    [FEES, false],
    [FEE_PROGRAM, false],
    [buyback, false],
    [getAssociatedTokenAddressSync(q, buyback, true), true],
  );
  // Acidpump's PDA signs inside CPI; it is not an outer-transaction signer.
  return keys.map(([pubkey, isWritable]) => ({
    pubkey,
    isWritable,
    isSigner: false,
  }));
}
