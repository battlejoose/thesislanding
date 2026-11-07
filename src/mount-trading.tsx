import { appFetch as fetch, appRoute, appName } from "./app-url.ts";
import React from "react";
import { createRoot } from "react-dom/client";
import {
  ConnectionContext,
} from "@solana/wallet-adapter-react";
import { BrowserWalletProvider } from './BrowserWalletProvider.tsx';
import { Connection } from "@solana/web3.js";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { App } from "./ui.tsx";
import { BlinkApp } from "./BlinkApp.tsx";
import { browserDeployment, prepareBrowserDeployment } from "./browser-deployment.ts";
import { PlatformTokensContext } from './PlatformTokens.tsx';
import { platformTokens } from './platform-tokens.ts';
import {isPerpsMarket} from './perps-market.ts';
const WalletConnection = ConnectionContext as unknown as React.Context<{
  connection: Connection;
}>;
export function mountTrading() {
  const root = document.getElementById("root")!;
  root.textContent = `Connecting to ${appName}…`;
  void (async () => {
    const response = await fetch("/deployment.json", { cache: "no-store" });
    if (!response.ok) throw Error("Platform configuration is unavailable");
    const { connection, deployment, profile } = await prepareBrowserDeployment(browserDeployment(await response.json()));
    if (!deployment.usdcOnly || deployment.venue?.mint !== deployment.quoteMint || profile.mainnet&&!isPerpsMarket(deployment))
      throw Error('Connect this build to its USDC-only service');
    const blink = appRoute(window.location.pathname).replace(/\/$/, "") === "/blink";
    if (blink && profile.mainnet) throw Error("Blinks are currently paused");
    // The installed Standard adapter destroys event listeners on effect cleanup.
    // Keep its provider outside dev StrictMode's teardown/replay; still check App.
    createRoot(root).render(
      <WalletConnection.Provider value={{ connection }}>
        <BrowserWalletProvider>
          <React.StrictMode>
          <WalletModalProvider>
            <PlatformTokensContext.Provider value={platformTokens(deployment)}>
              {blink ? <BlinkApp /> : <App initialDeployment={deployment} />}
            </PlatformTokensContext.Provider>
          </WalletModalProvider>
          </React.StrictMode>
        </BrowserWalletProvider>
      </WalletConnection.Provider>,
    );
  })().catch(() => {
    root.textContent = "Could not verify the platform connection. Please reload to try again.";
  });
}
