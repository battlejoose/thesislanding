import {
  PublicKey,
  SystemProgram,
  type TransactionInstruction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  type Account,
} from "@solana/spl-token";
import type { AssetInfo } from "./client.ts";

export type DepositAsset = Pick<AssetInfo,'mint'|'tokenProgram'|'decimals'|'symbol'> & {accounts?:{address:string;amount:string;frozen:boolean}[]};
export type DepositSource = {address:PublicKey;amount:bigint};

/** Only owner-controlled, initialized accounts for this exact mint can fund a deposit. */
export function depositSources(sender:PublicKey,asset:DepositAsset,accounts:Account[],amount:bigint):DepositSource[] {
  if(![TOKEN_PROGRAM_ID.toBase58(),TOKEN_2022_PROGRAM_ID.toBase58()].includes(asset.tokenProgram))throw Error('Unsupported token program');
  const seen=new Set<string>();let remaining=amount;
  const sources:DepositSource[]=[];
  for(const account of [...accounts].sort((a,b)=>a.amount>b.amount?-1:a.amount<b.amount?1:0)) {
    if(seen.has(account.address.toBase58()))continue;
    seen.add(account.address.toBase58());
    if(!account.owner.equals(sender)||account.mint.toBase58()!==asset.mint)throw Error('Funding token account does not match your wallet');
    if(!account.isInitialized||account.isFrozen||account.amount<=0n)continue;
    const take=account.amount<remaining?account.amount:remaining;
    if(take>0n){sources.push({address:account.address,amount:take});remaining-=take;}
  }
  if(remaining>0n)throw Error(`Not enough transferable $${asset.symbol} in your browser wallet. Refresh balances.`);
  if(sources.length>12)throw Error('This balance is spread across too many token accounts. Try a smaller amount.');
  return sources;
}

export function depositAtoms(amount: string, decimals: number): bigint {
  const normalized = amount.startsWith(".") ? `0${amount}` : amount;
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw Error("Enter a valid amount");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals)
    throw Error(`Use at most ${decimals} decimals`);
  const value =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (value <= 0n || value > (1n << 64n) - 1n)
    throw Error("Enter a valid amount");
  return value;
}

/** A deposit only moves the explicitly selected asset into the local wallet. */
export function depositInstructions(
  sender: PublicKey,
  recipient: PublicKey,
  amount: bigint,
  asset?: DepositAsset,
  sources?: DepositSource[],
): TransactionInstruction[] {
  if (sender.equals(recipient))
    throw Error("Choose a different funding wallet");
  if (amount <= 0n || amount > (1n << 64n) - 1n)
    throw Error("Invalid deposit amount");
  if (!asset)
    return [
      SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: recipient,
        lamports: amount,
      }),
    ];
  const mint = new PublicKey(asset.mint),
    program = new PublicKey(asset.tokenProgram);
  if(!program.equals(TOKEN_PROGRAM_ID)&&!program.equals(TOKEN_2022_PROGRAM_ID))throw Error('Unsupported token program');
  if(sources&&(!sources.length||new Set(sources.map(s=>s.address.toBase58())).size!==sources.length||
    sources.some(s=>s.amount<=0n)||sources.reduce((sum,s)=>sum+s.amount,0n)!==amount))throw Error('Invalid funding sources');
  const source = getAssociatedTokenAddressSync(mint, sender, false, program);
  const destination = getAssociatedTokenAddressSync(
    mint,
    recipient,
    false,
    program,
  );
  return [
    createAssociatedTokenAccountIdempotentInstruction(
      sender,
      destination,
      recipient,
      mint,
      program,
    ),
    ...(sources??[{address:source,amount}]).map(part=>createTransferCheckedInstruction(
      part.address,
      mint,
      destination,
      sender,
      part.amount,
      asset.decimals,
      [],
      program,
    )),
  ];
}
