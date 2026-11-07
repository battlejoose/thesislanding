import { PublicKey, SystemProgram, type Connection } from '@solana/web3.js';
import {
  NATIVE_MINT, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync,
  unpackMint, unpackAccount, getAccountLen, getAccountLenForMint,
  getExtensionTypes, getAccountTypeOfMintType, ExtensionType,
} from '@solana/spl-token';
import type { AssetInfo } from './client.ts';
import { withdrawalInstructions, withdrawalRecipient } from './withdrawal.ts';

export type WithdrawalAsset = Pick<AssetInfo, 'mint' | 'tokenProgram' | 'decimals' | 'symbol'>;

/** Independently run by the sponsor and signing browser. Registration is a
 * trading requirement, never a requirement to return an owner's tokens. */
export async function planWalletWithdrawal(
  c: Connection, owner: PublicKey, mintAddress: string, amount: bigint,
  address: string, payer: PublicKey, known?: WithdrawalAsset,
) {
  const recipient = withdrawalRecipient(address, owner);
  if (amount <= 0n || amount > (1n << 64n) - 1n) throw Error('Invalid withdrawal amount');
  let mint: PublicKey;
  try { mint = new PublicKey(mintAddress); } catch { throw Error('Unsupported withdrawal token'); }
  if (mint.equals(NATIVE_MINT)) {
    const asset = { mint: mintAddress, tokenProgram: TOKEN_PROGRAM_ID.toBase58(), decimals: 9, symbol: 'SOL' };
    const sourceKey = getAssociatedTokenAddressSync(mint, owner);
    const [source, native, target] = await Promise.all([
      c.getAccountInfo(sourceKey, 'confirmed'), c.getBalance(owner, 'confirmed'), c.getAccountInfo(recipient, 'confirmed'),
    ]);
    if (source && (!source.owner.equals(TOKEN_PROGRAM_ID) || source.data.length < 165 ||
      !new PublicKey(source.data.subarray(0, 32)).equals(mint) ||
      !new PublicKey(source.data.subarray(32, 64)).equals(owner) || source.data[108] !== 1)) throw Error('SOL account unavailable');
    if (BigInt(native) + (source?.data.readBigUInt64LE(64) ?? 0n) < amount) throw Error('Not enough SOL in your local wallet');
    checkRecipient(target);
    return { ixs: withdrawalInstructions(owner, recipient, asset, amount, payer, !!source), ata: undefined, accountSize: 0 };
  }
  let asset = known, accountSize = 165;
  // Known legacy SPL assets are pinned by deployment. Unknown mints and
  // Token-2022 account sizes come from the chain, never request fields.
  if (!asset || asset.tokenProgram !== TOKEN_PROGRAM_ID.toBase58()) {
    const info = await c.getAccountInfo(mint, 'confirmed');
    if (!info || info.executable || ![TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID].some(p => p.equals(info.owner)))
      throw Error('Unsupported withdrawal token');
    const data = unpackMint(mint, info, info.owner);
    if (!data.isInitialized) throw Error('Token mint unavailable');
    asset = { mint: mintAddress, tokenProgram: info.owner.toBase58(), decimals: data.decimals, symbol: known?.symbol ?? mintAddress.slice(0, 6) };
    accountSize = info.owner.equals(TOKEN_2022_PROGRAM_ID)
      ? getAccountLen([...getExtensionTypes(data.tlvData).map(getAccountTypeOfMintType), ExtensionType.ImmutableOwner])
      : getAccountLenForMint(data);
  }
  const program = new PublicKey(asset.tokenProgram);
  const [response, target] = await Promise.all([
    c.getTokenAccountsByOwner(owner, { mint }, 'confirmed'), c.getAccountInfo(recipient, 'confirmed'),
  ]);
  checkRecipient(target);
  const accounts = response.value.map(row => unpackAccount(row.pubkey, row.account, program));
  const seen = new Set<string>();
  let remaining = amount;
  const sources: { address: PublicKey; amount: bigint }[] = [];
  for (const account of accounts.sort((a, b) => a.address.toBase58() < b.address.toBase58() ? -1 : 1)) {
    if (!account.owner.equals(owner) || !account.mint.equals(mint)) throw Error('Withdrawal account unavailable');
    const key = account.address.toBase58();
    if (seen.has(key)) throw Error('Duplicate withdrawal account');
    seen.add(key);
    if (!account.isInitialized || account.isFrozen || account.amount === 0n) continue;
    const take = account.amount < remaining ? account.amount : remaining;
    if (take > 0n) { sources.push({ address: account.address, amount: take }); remaining -= take; }
  }
  if (remaining > 0n) throw Error('Not enough transferable tokens in your local wallet. Frozen tokens cannot be sent.');
  if (sources.length > 12) throw Error('Balance spans too many token accounts; withdraw a smaller amount first.');
  return {
    ixs: withdrawalInstructions(owner, recipient, asset, amount, payer, false, sources),
    ata: getAssociatedTokenAddressSync(mint, recipient, false, program), accountSize,
  };
}

function checkRecipient(target: Awaited<ReturnType<Connection['getAccountInfo']>>) {
  if (target && (!target.owner.equals(SystemProgram.programId) || target.executable || target.data.length !== 0))
    throw Error('Use the recipient’s wallet address, not a token or program account');
}
