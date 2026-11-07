import { sdiceSkin, thesisSkin, appName } from "./app-url.ts";
import "./sdice-theme.css";
import "./polyfills.ts";
import React from "react";
import { createRoot } from "react-dom/client";
import { publicRoute } from "./public-route.ts";
import "./style.css";
import "./acid-theme.css";
import "./acid-reactive.css";
import "./thesis-theme.css";
import { installPageMotion } from './page-motion.ts';
import { installMarketRouting, marketPath } from './market-route.ts';

// A created market's page (/m/<SYMBOL>/...) talks to that market's server.
const market = thesisSkin ? '' : installMarketRouting();

if (sdiceSkin) document.documentElement.dataset.sdice = 'true';
if (thesisSkin) { document.documentElement.dataset.thesis = 'true'; document.title = appName; }
const stopPageMotion = installPageMotion();
if (import.meta.hot) import.meta.hot.dispose(stopPageMotion);

const host = document.getElementById("root")!;
if (window.top !== window.self) {
  host.textContent = "Open the trading page in its own tab to use a wallet.";
} else {
  const path = marketPath(window.location.pathname);
  // Created markets open straight into trading; the landing page is the root's.
  const route = thesisSkin && publicRoute(path) !== 'docs' || market && path === "/" ? "trade" : publicRoute(path);
  host.textContent = `Loading ${appName}…`;
  // Public pages never initialize a wallet or verify an RPC connection.
  // The trading route keeps the existing deployment and genesis checks.
  const ready = route === "trade"
    ? import("./mount-trading.tsx").then(({ mountTrading }) => mountTrading())
    : import("./PublicPages.tsx").then(({ PublicPages }) => {
        createRoot(host).render(<React.StrictMode><PublicPages route={route} /></React.StrictMode>);
      });
  void ready.catch(() => { host.textContent = "Could not load the page. Please reload to try again."; });
}
