import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
  createCloseAccountInstruction,
} from "@solana/spl-token";
import type { WithdrawalAsset } from './withdrawal-plan.ts';

// Covers the maximum wallet-added priority fee accepted by wallet-approval.ts
// plus the owner signature fee. SOL is withdrawn last in a browser batch.
export const BROWSER_WITHDRAW_FEE_RESERVE=1_010_000n;
export function browserWithdrawableSol(balance:bigint){return balance>BROWSER_WITHDRAW_FEE_RESERVE?balance-BROWSER_WITHDRAW_FEE_RESERVE:0n;}

export function withdrawalRecipient(value: string, owner: PublicKey) {
  let recipient: PublicKey;
  try {
    recipient = new PublicKey(value.trim());
  } catch {
    throw Error("Enter a valid Solana wallet address");
  }
  if (!PublicKey.isOnCurve(recipient.toBytes()) || recipient.equals(owner))
    throw Error("Enter another wallet’s address");
  return recipient;
}

export function tokenAmountInput(amount: bigint, decimals: number) {
  const scale = 10n ** BigInt(decimals);
  const fraction = (amount % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${amount / scale}${fraction ? "." + fraction : ""}`;
}

export function withdrawalInstructions(
  owner: PublicKey,
  recipient: PublicKey,
  asset: WithdrawalAsset,
  amount: bigint,
  payer: PublicKey,
  unwrapSol = false,
  sources?: { address: PublicKey; amount: bigint }[],
) {
  withdrawalRecipient(recipient.toBase58(), owner);
  if (amount <= 0n || amount > (1n << 64n) - 1n)
    throw Error("Invalid withdrawal amount");
  const mint = new PublicKey(asset.mint),
    program = new PublicKey(asset.tokenProgram);
  const source = getAssociatedTokenAddressSync(mint, owner, false, program);
  if (mint.equals(NATIVE_MINT)) return [
    ...(unwrapSol ? [createCloseAccountInstruction(source,owner,owner)] : []),
    SystemProgram.transfer({fromPubkey:owner,toPubkey:recipient,lamports:amount}),
  ];
  const destination = getAssociatedTokenAddressSync(
    mint,
    recipient,
    false,
    program,
  );
  if (sources && (!sources.length || new Set(sources.map(s => s.address.toBase58())).size !== sources.length ||
    sources.some(s => s.amount <= 0n) || sources.reduce((sum, s) => sum + s.amount, 0n) !== amount))
    throw Error('Invalid withdrawal sources');
  return [
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      destination,
      recipient,
      mint,
      program,
    ),
    ...(sources ?? [{ address: source, amount }]).map(part => createTransferCheckedInstruction(
      part.address,
      mint,
      destination,
      owner,
      part.amount,
      asset.decimals,
      [],
      program,
    )),
  ];
}
