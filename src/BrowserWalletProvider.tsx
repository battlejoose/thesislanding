import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { WalletContext, WalletProvider, useWallet, type WalletContextState } from '@solana/wallet-adapter-react';
import type { Adapter, WalletName } from '@solana/wallet-adapter-base';
import { connectBrowserWallet, disconnectBrowserWallet, connectionMessage } from './wallet-connection.ts';

const adapters: Adapter[] = [];
const ConnectionWallet = WalletContext as unknown as React.Context<WalletContextState>;
const ConnectionStatus = createContext({ error: '', cancel: () => {} });
export const useBrowserWalletConnection = () => useContext(ConnectionStatus);

/** Own connection attempts without remounting the trading UI or its local wallet.
 * WalletProvider still owns discovery, mobile adapters, events and signing.
 */
function Connections({ children }: { children: React.ReactNode }) {
  const raw = useWallet(), current = useRef(raw); current.current = raw;
  const attempt = useRef<AbortController>();
  const explicit = useRef<WalletName | null>(null);
  const [connecting, setConnecting] = useState(false), [error, setError] = useState('');
  const [disconnecting, setDisconnecting] = useState(false);
  const closing = useRef<Promise<void>>();
  const forgotten = useRef<Adapter | null>(null);
  const selection = useRef(0);
  const [authorized, setAuthorized] = useState<Adapter | null>(null);
  const stop = () => { attempt.current?.abort(); attempt.current = undefined; setConnecting(false); };
  const disconnect = (): Promise<void> => {
    stop(); setAuthorized(null); explicit.current = null;
    if (closing.current) return closing.current;
    const adapter = current.current.wallet?.adapter ?? forgotten.current;
    if (!adapter) { current.current.select(null); return Promise.resolve(); }
    forgotten.current = adapter;
    setDisconnecting(true);
    const operation = disconnectBrowserWallet(adapter).then(() => {
      forgotten.current = null;
    }).catch(e => { setError(connectionMessage(e)); throw e; }).finally(() => {
      // Adapter disconnect normally emits the event that clears WalletProvider's
      // selection. Clear its remembered choice as well if that event was absent.
      current.current.select(null);
      if (closing.current === operation) { closing.current = undefined; setDisconnecting(false); }
    });
    closing.current = operation;
    return operation;
  };
  const begin = async (adapter: Adapter, silent: boolean) => {
    if (closing.current) return;
    stop();
    const controller = new AbortController(); attempt.current = controller;
    setConnecting(true); setError(''); setAuthorized(null);
    try {
      await connectBrowserWallet(adapter, silent, controller.signal);
      if (attempt.current !== controller || current.current.wallet?.adapter !== adapter) return;
      setAuthorized(adapter);
    } catch (e) {
      if (attempt.current !== controller) return;
      // Abort continuation after a timeout as well as explicit cancellation.
      controller.abort();
      // Close the same injected provider that may have connected before the
      // bridge failed. Late approvals are drained by the disconnect boundary.
      void disconnect().catch(() => {});
      setError(silent ? '' : connectionMessage(e));
    } finally {
      if (attempt.current === controller) { attempt.current = undefined; setConnecting(false); }
    }
  };
  const selected = raw.wallet?.adapter;
  useEffect(() => {
    if (!selected || closing.current) return;
    // Deferral prevents StrictMode's discarded mount from opening a second request.
    const timer = setTimeout(() => {
      const interactive = explicit.current === selected.name;
      explicit.current = null;
      void begin(selected, !interactive);
    }, 0);
    return () => { clearTimeout(timer); stop(); };
  }, [selected]);
  const select = (name: WalletName | null) => {
    if (closing.current) { setError('Wallet is still disconnecting. Please wait.'); return; }
    const choice = ++selection.current;
    if (!name) { void disconnect().catch(() => {}); return; }
    if (current.current.wallet || forgotten.current) {
      void (async () => {
        try {
          await disconnect();
          // Let WalletProvider commit its disconnect event/selection before
          // selecting the same adapter again; do not race its async cleanup.
          await new Promise(resolve => setTimeout(resolve, 0));
          if (selection.current !== choice) return;
          setError(''); explicit.current = name; current.current.select(name);
        } catch { /* disconnect displays its recoverable error */ }
      })();
      return;
    }
    stop(); setError(''); setAuthorized(null); explicit.current = name;
    current.current.select(name);
  };
  const connected = !!selected && authorized === selected && raw.connected;
  return <ConnectionStatus.Provider value={{ error, cancel: () => {
    selection.current++;
    void disconnect().catch(() => {}); setError('Connection cancelled. Close any open wallet prompt before trying again.');
  } }}>
    <ConnectionWallet.Provider value={{ ...raw, connecting, disconnecting, connected: connected && !disconnecting,
      publicKey: connected && !disconnecting ? raw.publicKey : null, select,
      connect: async () => { if (selected) await begin(selected, false); },
      disconnect: async () => { selection.current++; setError(''); await disconnect(); },
    }}>{children}</ConnectionWallet.Provider>
  </ConnectionStatus.Provider>;
}

export function BrowserWalletProvider({ children }: { children: React.ReactNode }) {
  return <WalletProvider wallets={adapters} autoConnect={false}
    onError={() => { /* Connection rejection is handled once by Connections; signing callers display their own errors. */ }}>
    <Connections>{children}</Connections>
  </WalletProvider>;
}
