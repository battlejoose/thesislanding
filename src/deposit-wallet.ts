import type { WalletContextState } from '@solana/wallet-adapter-react';
import type { SolanaSignTransactionFeature } from '@solana/wallet-standard-features';
import type { StandardConnectFeature } from '@wallet-standard/features';
import { Transaction } from '@solana/web3.js';
import { browserWalletGeneration } from './wallet-connection.ts';

type FundingWallet = Pick<WalletContextState, 'wallet' | 'publicKey' | 'connected' | 'signTransaction'>;
const SIGN = 'solana:signTransaction', CONNECT = 'standard:connect';
const changed = () => Error('Funding wallet changed; nothing was submitted. Select the original wallet and try again.');

type FundingPublicKey = { toBase58(): string };
export type PhantomDepositProvider = {
  isPhantom: boolean;
  isConnected: boolean;
  publicKey: FundingPublicKey | null;
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: FundingPublicKey }>;
  disconnect?(): Promise<void>;
  signTransaction?(transaction: Transaction): Promise<Transaction>;
};
const injectedPhantom = () => (globalThis as typeof globalThis & {
  phantom?: { solana?: PhantomDepositProvider };
}).phantom?.solana;

/** Called once from the user's Deposit tap, before building its transaction.
 * Adapter.connect() can skip authorization when cached accounts are nonempty.
 * Standard.connect can ALSO short-circuit on its own cached account. For the
 * selected Phantom wallet, connect AND sign through the same injected provider.
 * Its Standard bridge can retain an older account/session after a wallet switch
 * even when provider.connect succeeds. Do not mix those two signing sessions.
 * This only requests connection/signing; it never broadcasts or retries a send.
 */
export async function authorizeDepositWallet(
  current: () => FundingWallet,
  owner: string,
  cluster: 'mainnet-beta' | 'devnet',
  readPhantom: () => PhantomDepositProvider | undefined = injectedPhantom,
) {
  const adapter = current().wallet?.adapter;
  const generation = adapter ? browserWalletGeneration(adapter) : -1;
  const assertSelected = () => {
    const wallet = current();
    if (!adapter || browserWalletGeneration(adapter) !== generation || wallet.wallet?.adapter !== adapter || !wallet.connected || !adapter.connected ||
      wallet.publicKey?.toBase58() !== owner || adapter.publicKey?.toBase58() !== owner) throw changed();
  };
  assertSelected();
  if (!adapter) throw changed();

  // Never use window.solana: another installed wallet may own that namespace.
  // Never use signAndSendTransaction: approved bytes must pass our validator
  // and the configured chain's fee/blockhash check before the app sends them.
  const phantom = adapter.name === 'Phantom' ? readPhantom() : undefined;
  const assertProvider = () => {
    if (phantom && (readPhantom() !== phantom || !phantom.isPhantom ||
      !phantom.isConnected || phantom.publicKey?.toBase58() !== owner)) throw changed();
  };
  if (phantom) {
    if (!phantom.isPhantom || typeof phantom.connect !== 'function' ||
      (phantom.publicKey && phantom.publicKey.toBase58() !== owner)) throw changed();
    // Call even when isConnected is true: it can outlive the extension's session.
    // Do not disconnect first (that deselects the wallet/unmounts browser mode).
    const connected = await phantom.connect();
    assertSelected();
    if (connected.publicKey?.toBase58() !== owner) throw changed();
    assertProvider();
  }
  const assertConnection = () => { assertSelected(); assertProvider(); };
  if (phantom && typeof phantom.signTransaction === 'function') {
    const sign = phantom.signTransaction;
    const assertCurrent = () => {
      assertConnection();
      if (phantom.signTransaction !== sign) throw changed();
    };
    return { assertCurrent, sign: async (transaction: Transaction) => {
      assertCurrent();
      const signed = await sign.call(phantom, transaction);
      assertCurrent();
      return signed;
    } };
  }
  if (!('wallet' in adapter)) {
    // Non-Standard/mobile adapters keep their supported signing transport.
    return { assertCurrent: assertConnection, sign: async (transaction: Transaction) => {
      assertConnection();
      const sign = current().signTransaction;
      if (!sign) throw Error('This browser wallet cannot sign deposits');
      const signed = await sign(transaction);
      assertConnection();
      return signed;
    } };
  }

  const standard = adapter.wallet;
  const chain = cluster === 'mainnet-beta' ? 'solana:mainnet' : 'solana:devnet';
  const connect = (standard.features as Partial<StandardConnectFeature>)[CONNECT];
  if (!connect) throw Error('This browser wallet cannot refresh its deposit connection');
  // Deliberately call the wallet feature even when the adapter says connected.
  // A cancelled connection is propagated; it is never treated as permission.
  const authorized = await connect.connect();
  assertConnection();
  const account = standard.accounts.find(account => account.address === owner);
  if (!account || !authorized.accounts.includes(account)) throw changed();
  const assertCurrent = () => {
    assertConnection();
    if (account.address !== owner || !standard.accounts.includes(account)) throw changed();
    if (!standard.chains.includes(chain) || !account.chains.includes(chain))
      throw Error(`The funding wallet account does not support Solana ${cluster === 'mainnet-beta' ? 'mainnet' : 'devnet'}. Check its network and try again.`);
    const feature = (standard.features as Partial<SolanaSignTransactionFeature>)[SIGN];
    if (!feature || !account.features.includes(SIGN) || !feature.supportedTransactionVersions.includes('legacy'))
      throw Error('This browser wallet cannot sign this deposit transaction');
  };
  assertCurrent();
  return { assertCurrent, sign: async (transaction: Transaction) => {
    assertCurrent();
    const feature = (standard.features as SolanaSignTransactionFeature)[SIGN];
    const results = await feature.signTransaction({ account, chain,
      transaction: new Uint8Array(transaction.serialize({ requireAllSignatures: false, verifySignatures: false })) });
    assertCurrent();
    if (results.length !== 1) throw Error('Unexpected wallet signing response; nothing was submitted');
    return Transaction.from(results[0].signedTransaction);
  } };
}
