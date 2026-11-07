import type { WalletContextState } from "@solana/wallet-adapter-react";
import type { SolanaSignTransactionFeature } from "@solana/wallet-standard-features";
import { VersionedTransaction } from "@solana/web3.js";

const SIGN_TRANSACTION = "solana:signTransaction";
type SigningWallet = Pick<WalletContextState, "wallet" | "publicKey" | "signTransaction">;

/** The adapter's sign-only convenience method drops the optional chain field.
 * An ER blockhash cannot identify its base network, so label approvals with
 * the deployment's chain. Signing does not submit or choose who pays fees. */
export async function signBlinkWalletTransaction(wallet: SigningWallet, owner: string, transaction: VersionedTransaction, cluster:'devnet'|'mainnet-beta'='devnet') {
  const chain=cluster==='mainnet-beta'?'solana:mainnet':'solana:devnet';
  const adapter = wallet.wallet?.adapter;
  if (!adapter || wallet.publicKey?.toBase58() !== owner || adapter.publicKey?.toBase58() !== owner)
    throw Error("Wallet changed. Please reconnect the original wallet.");
  if (!("wallet" in adapter)) {
    // The mobile adapter receives its network from our Connection provider.
    if (!wallet.signTransaction) throw Error("This wallet cannot sign transactions");
    return wallet.signTransaction(transaction);
  }
  const standard = adapter.wallet;
  const account = standard.accounts.find(account => account.address === owner);
  if (!account) throw Error("Wallet account is no longer connected");
  if (!standard.chains.includes(chain) || !account.chains.includes(chain))
    throw Error(cluster==='devnet'?"This connected wallet account does not support Solana devnet. Keep testnet mode enabled and reconnect.":"This connected wallet account does not support Solana mainnet. Disable testnet mode and reconnect.");
  const feature = (standard.features as Partial<SolanaSignTransactionFeature>)[SIGN_TRANSACTION];
  if (!feature || !account.features.includes(SIGN_TRANSACTION) || !feature.supportedTransactionVersions.includes(0))
    throw Error(`This wallet cannot sign the versioned ${cluster} transaction`);
  const results = await feature.signTransaction({
    account,
    chain,
    transaction: transaction.serialize(),
  });
  if (results.length !== 1) throw Error("Unexpected wallet signing response; nothing was submitted");
  return VersionedTransaction.deserialize(results[0].signedTransaction);
}
