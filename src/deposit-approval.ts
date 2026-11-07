import { Buffer } from 'buffer';
import { ComputeBudgetProgram, Message, PublicKey, Transaction } from '@solana/web3.js';

const changed = (detail: string) => Error(`Deposit not submitted: the wallet returned an unexpected ${detail}.`);
// A wallet may add its user-approved priority fee, but never an unbounded one.
export const MAX_DEPOSIT_PRIORITY_LAMPORTS = 1_000_000n;
const LIGHTHOUSE = new PublicKey('L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95');

/** Validate the signed wire transaction, allowing bounded compute fees and
 * Lighthouse read-only assertions. Phantom adds these at signing time. Compare resolved instructions and account
 * privileges rather than serialized message bytes (account indexes can change).
 */
export function validateDepositApproval(expectedBytes: Uint8Array, signed: Transaction) {
  // Verify signatures and retain precisely these bytes for submission.
  const bytes = signed.serialize();
  const actual = Transaction.from(bytes), expected = Transaction.populate(Message.from(expectedBytes));
  const before = expected.compileMessage(), after = actual.compileMessage();
  if (!actual.feePayer?.equals(expected.feePayer!)) throw changed('fee payer');
  // The wallet can refresh the blockhash during approval. approveDeposit checks
  // that the final message is recognized by this deployment's RPC before use.

  const budgetId = ComputeBudgetProgram.programId;
  const allowedExtraAccounts = new Set([budgetId.toBase58(), LIGHTHOUSE.toBase58()]);
  for (const ix of actual.instructions) {
    if (!ix.programId.equals(LIGHTHOUSE)) continue;
    // Lighthouse's immutable program uses a one-byte Borsh instruction enum.
    // Tags 2..15 only assert account/clock state. Never permit MemoryWrite (0),
    // MemoryClose (1), or the separate compressed-NFT CPI routes (16+).
    // Source: Jac0xb/lighthouse@4c579479, programs/lighthouse/src/instruction.rs.
    // Lighthouse itself validates the assertion payload during preflight.
    const tag = ix.data[0], accountCount = tag === 4 ? 2 : tag === 15 ? 0 : 1;
    if (ix.data.length < 3 || tag < 2 || tag > 15 || ix.keys.length !== accountCount)
      throw changed(`Lighthouse assertion (${tag}: encoding or accounts)`);
    for (const key of ix.keys) allowedExtraAccounts.add(key.pubkey.toBase58());
  }
  for (let i = 0; i < after.accountKeys.length; i++) {
    const key = after.accountKeys[i], old = before.accountKeys.findIndex(k => k.equals(key));
    if (old < 0) {
      if (!allowedExtraAccounts.has(key.toBase58()) || after.isAccountSigner(i) || after.isAccountWritable(i)) throw changed(`account (${key.toBase58()})`);
    } else if (before.isAccountSigner(old) !== after.isAccountSigner(i) ||
               before.isAccountWritable(old) !== after.isAccountWritable(i)) throw changed(`account permission (${key.toBase58()})`);
  }
  if (before.accountKeys.some(key => !after.accountKeys.some(k => k.equals(key)))) throw changed('missing account');

  let units: number | undefined, price: bigint | undefined;
  const budgets = new Set<number>();
  const transfers = actual.instructions.filter(ix => {
    if (ix.programId.equals(LIGHTHOUSE)) return false;
    if (!ix.programId.equals(budgetId)) return true;
    const tag = ix.data[0];
    if (ix.keys.length || budgets.has(tag)) throw changed(`compute budget (${tag}: accounts or duplicate)`);
    budgets.add(tag);
    if (tag === 2 && ix.data.length === 5) {
      units = ix.data.readUInt32LE(1);
      if (!units || units > 1_400_000) throw changed('compute unit limit');
    } else if (tag === 3 && ix.data.length === 9) {
      price = ix.data.readBigUInt64LE(1);
    } else if (tag === 1 && ix.data.length === 5) {
      const heap = ix.data.readUInt32LE(1);
      if (heap < 32_768 || heap > 262_144 || heap % 1024) throw changed('heap limit');
    } else if (tag === 4 && ix.data.length === 5) {
      const loaded = ix.data.readUInt32LE(1);
      if (!loaded || loaded > 67_108_864) throw changed('loaded account data limit');
    } else throw changed(`compute budget (${tag}: encoding)`);
    return false;
  });
  if (!expected.instructions.length || transfers.length !== expected.instructions.length) throw changed('instruction count');
  for (let i = 0; i < transfers.length; i++) {
    const a = transfers[i], b = expected.instructions[i];
    if (!a.programId.equals(b.programId)) throw changed(`program at instruction ${i + 1}`);
    if (!a.data.equals(b.data)) throw changed(`amount or instruction data at instruction ${i + 1}`);
    if (a.keys.length !== b.keys.length || a.keys.some((k,j) => !k.pubkey.equals(b.keys[j].pubkey) ||
        k.isSigner !== b.keys[j].isSigner || k.isWritable !== b.keys[j].isWritable))
      throw changed(`token or account at instruction ${i + 1}`);
  }
  // Use the protocol maximum if the wallet supplies a price without a CU limit.
  const priorityCeiling = (BigInt(units ?? 1_400_000) * (price ?? 0n) + 999_999n) / 1_000_000n;
  if (priorityCeiling > MAX_DEPOSIT_PRIORITY_LAMPORTS)
    throw Error('Wallet priority fee exceeds 0.001 SOL. Lower the wallet network fee and retry; transfer was not submitted.');
  return { bytes, message: after, feeAdded: price !== undefined && price > 0n,
    blockhashRefreshed: after.recentBlockhash !== before.recentBlockhash };
}

export async function approveDeposit(
  transaction: Transaction,
  sign: (transaction: Transaction) => Promise<Transaction>,
  assertWallet: () => void,
  readFee: (message: Message) => Promise<number | null>,
) {
  assertWallet();
  // Copy before calling the wallet: adapters may mutate the original object.
  const expected = Buffer.from(transaction.serializeMessage());
  const signed = await sign(transaction);
  assertWallet();
  const approved = validateDepositApproval(expected, signed);
  // A fee quote uses the signed message's blockhash on the configured chain.
  // Unknown/expired hashes fail before broadcast, including wrong-network hashes.
  const feeLamports = await readFee(approved.message);
  assertWallet();
  if (feeLamports === null)
    throw Error('Deposit approval is not current on this network; transfer was not submitted. Please retry.');
  if (!Number.isSafeInteger(feeLamports) || feeLamports < 0)
    throw Error('Deposit network fee unavailable; transfer was not submitted. Please retry.');
  return { ...approved, feeLamports };
}
