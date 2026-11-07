import { apiUrl } from "./app-url.ts";
import { Connection, PublicKey } from "@solana/web3.js";
import type { Deployment } from "./client.ts";
import { assertBaseNetwork, profileForDeployment } from "./deployment-profile.ts";
import { validateErDeployment } from "./execution-layer.ts";
import { platformTokens } from "./platform-tokens.ts";

export function browserDeployment(value: unknown): Deployment {
  const deployment = value as Deployment;
  if (!deployment || !Array.isArray(deployment.assets) || !deployment.assets.length)
    throw Error("Platform configuration is unavailable");
  profileForDeployment(deployment);
  platformTokens(deployment);
  validateErDeployment(deployment);
  sponsoredPayer(deployment, "base");
  return deployment;
}

/** Never create a wallet or render transaction controls before choosing the
 * deployment. Browser RPC URLs are public; private backend URLs stay server-side. */
export async function prepareBrowserDeployment(deployment: Deployment,
  connect = (endpoint: string) => {
    const connection=new Connection(endpoint,{commitment:'confirmed',disableRetryOnRateLimit:true});
    if(endpoint.endsWith('/api/rpc')) {
      // The gateway is HTTP. Confirmation's existing HTTP fallback handles
      // wallet-funded deposits without opening a nonexistent websocket route.
      connection.onSignature=()=>{throw Error('Use HTTP confirmation for the browser gateway');};
    }
    return connection;
  }, origin=typeof window==='undefined'?undefined:window.location.origin) {
  const profile = profileForDeployment(deployment);
  const endpoint = profile.mainnet ? (origin?new URL(apiUrl('/api/rpc'),origin).href:"https://api.mainnet-beta.solana.com")
    : profile.modular && deployment.baseRpcUrl ? deployment.baseRpcUrl : "https://api.devnet.solana.com";
  const connection = connect(endpoint);
  await assertBaseNetwork(connection, profile);
  return { deployment, profile, connection };
}

export function localWalletStorageKey(deployment: Deployment) {
  const profile = profileForDeployment(deployment);
  return profile.mainnet ? `perpderp:acidpump-er:${deployment.cluster}:${deployment.programId}:local`
    : "perpderp:acidpump-er:local";
}
export function sponsoredPayer(deployment: Deployment, layer: "base" | "er") {
  const mainnet = profileForDeployment(deployment).mainnet;
  const address = layer === "er" ? deployment.er?.payer : deployment.sponsor;
  if (mainnet && !address) throw Error("Mainnet fee payer configuration is unavailable");
  return new PublicKey(address ?? deployment.publisher);
}
export function transactionExplorer(signature: string, cluster: string = "devnet") {
  return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}${cluster === "mainnet-beta" ? "" : "?cluster=devnet"}`;
}
