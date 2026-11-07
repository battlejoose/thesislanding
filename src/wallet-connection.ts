import type { Adapter } from '@solana/wallet-adapter-base';
import type { PhantomDepositProvider } from './deposit-wallet.ts';

export const CONNECTION_TIMEOUT_MS = 30_000;
const pending = new WeakMap<Adapter, Promise<void>>();
const disconnecting = new WeakMap<Adapter, Promise<void>>();
const generations = new WeakMap<Adapter, number>();
export const browserWalletGeneration = (adapter: Adapter) => generations.get(adapter) ?? 0;
const invalidate = (adapter: Adapter) => generations.set(adapter, browserWalletGeneration(adapter) + 1);
const injectedPhantom = () => (globalThis as typeof globalThis & {
  phantom?: { solana?: PhantomDepositProvider };
}).phantom?.solana;

const transports = new WeakMap<Adapter, {
  disconnect: () => Promise<void>;
  readPhantom: typeof injectedPhantom;
  clean: boolean;
}>();

/** WalletProvider.select also calls adapter.disconnect without awaiting it.
 * Route that cleanup through the same boundary as our Disconnect button, so
 * deselection cannot start a second close which outlives the next connection.
 */
export function guardBrowserWalletDisconnect(adapter: Adapter, readPhantom = injectedPhantom) {
  let transport = transports.get(adapter);
  if (!transport) {
    transport = { disconnect: adapter.disconnect.bind(adapter), readPhantom, clean: false };
    transports.set(adapter, transport);
    adapter.disconnect = () => {
      const operation = disconnectBrowserWallet(adapter, transport!.readPhantom);
      // WalletProvider does not handle a rejected deselection cleanup. Explicit
      // callers still receive the rejection and can retry through our UI.
      void operation.catch(() => {});
      return operation;
    };
  }
  return transport;
}

async function closeWalletTransports(adapter: Adapter, phantom?: PhantomDepositProvider) {
  // The Standard bridge and the injected signing transport can have separate
  // sessions. Attempt BOTH even if one fails. Never touch another provider.
  const failures: unknown[] = [];
  const onError = (error: Error) => { if (error.name === 'WalletDisconnectionError') failures.push(error); };
  adapter.on?.('error', onError);
  try {
    // Phantom's Standard disconnect may call the very same injected transport.
    // Closing both concurrently races extension requests. Await the bridge,
    // then close the injected session only if it is still connected.
    try { await transports.get(adapter)!.disconnect(); } catch (error) { failures.push(error); }
    if (phantom?.isConnected) {
      try {
        if (typeof phantom.disconnect !== 'function') throw Error('Wallet has no disconnect method');
        await phantom.disconnect();
        if (phantom.isConnected) throw Error('Wallet is still connected');
      } catch (error) { failures.push(error); }
    }
    if (failures.length || adapter.connected)
      throw Error('Wallet could not finish disconnecting. Close any wallet prompt and disconnect again before reconnecting.');
  } finally { adapter.off?.('error', onError); }
}

/** Explicit disconnect is awaited, including cleanup of an abandoned connect.
 * A deadline frees the UI, but cannot authorize another request over a transport
 * which is still closing. No local trading keys or transaction journals change.
 */
export async function disconnectBrowserWallet(
  adapter: Adapter,
  readPhantom = injectedPhantom,
  timeoutMs = 8000,
) {
  const transport = guardBrowserWalletDisconnect(adapter, readPhantom);
  let cleanup = disconnecting.get(adapter);
  if (!cleanup) {
    if (transport.clean && !adapter.connected &&
      !(adapter.name === 'Phantom' && readPhantom()?.isConnected)) return;
    invalidate(adapter); // Invalidates deposit intent even across A -> A reconnect.
    const connection = pending.get(adapter);
    const phantom = adapter.name === 'Phantom' ? readPhantom() : undefined;
    cleanup = Promise.resolve().then(async () => {
      let failure: unknown;
      try { await closeWalletTransports(adapter, phantom); } catch (e) { failure = e; }
      if (connection) {
        // A late extension approval must be disconnected too, before a new
        // attempt is allowed. The caller has already aborted its continuation.
        await connection.catch(() => {});
        await closeWalletTransports(adapter, phantom);
      } else if (failure) throw failure;
      transport.clean = true;
    }).finally(() => disconnecting.delete(adapter));
    disconnecting.set(adapter, cleanup);
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([cleanup, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error('Wallet is still finishing a previous request. Close or dismiss its open prompt, then try connecting again.')), timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
export const connectionMessage = (e: unknown) => {
  const message = e instanceof Error ? e.message : String(e);
  return /rejected|declined|4001/i.test(message)
    ? 'Wallet connection was not approved. Click Connect browser wallet to try again.'
    : message;
};

/** Limit waiting, not wallet permission. A late result never starts a transaction.
 * Keep the underlying request tracked until it settles: timeout/cancel must not
 * create overlapping extension prompts or treat the old response as a retry.
 */
export async function connectBrowserWallet(
  adapter: Adapter,
  silent: boolean,
  signal: AbortSignal,
  readPhantom = injectedPhantom,
  timeoutMs = CONNECTION_TIMEOUT_MS,
) {
  signal.throwIfAborted();
  if (disconnecting.has(adapter))
    throw Error('Wallet is still disconnecting. Finish or dismiss its previous request before connecting again.');
  if (pending.has(adapter) || adapter.connecting)
    throw Error('Finish or dismiss the pending request in your wallet, then connect again.');
  guardBrowserWalletDisconnect(adapter, readPhantom).clean = false;
  const lifetime = new AbortController();
  const abort = () => lifetime.abort(signal.reason);
  signal.addEventListener('abort', abort, { once: true });
  const active = lifetime.signal;
  invalidate(adapter);
  const request = (async () => {
    const phantom = adapter.name === 'Phantom' ? readPhantom() : undefined;
    let owner: string | undefined;
    if (phantom?.isPhantom) {
      // Initial connection must use the same provider as deposit signing.
      // Only a user's explicit selection may open an approval prompt.
      const result = await phantom.connect(silent ? { onlyIfTrusted: true } : undefined);
      active.throwIfAborted();
      owner = result.publicKey.toBase58();
      if (readPhantom() !== phantom || !phantom.isConnected || phantom.publicKey?.toBase58() !== owner)
        throw Error('Wallet account changed while connecting. Please connect again.');
    }
    active.throwIfAborted();
    await (silent ? adapter.autoConnect() : adapter.connect());
    active.throwIfAborted();
    if (!adapter.connected || !adapter.publicKey || (owner && adapter.publicKey.toBase58() !== owner))
      throw Error('Wallet account changed while connecting. Please connect again.');
  })().finally(() => pending.delete(adapter));
  pending.set(adapter, request);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  try {
    await Promise.race([request, new Promise<never>((_, reject) => {
      cancel = () => reject(active.reason ?? Error('Connection cancelled.'));
      active.addEventListener('abort', cancel, { once: true });
      timer = setTimeout(() => lifetime.abort(Error('Wallet did not respond. Close its pending connection prompt, then try again.')), timeoutMs);
    })]);
  } finally {
    clearTimeout(timer);
    active.removeEventListener('abort', cancel);
    signal.removeEventListener('abort', abort);
  }
}
