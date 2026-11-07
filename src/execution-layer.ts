import { Connection } from "@solana/web3.js";
import type { Deployment } from "./client.ts";
import { profileForDeployment } from "./deployment-profile.ts";

export type ExecutionLayer = "base" | "er";

/** Slot numbers and signatures belong to one execution bank. Never use an ER
 * confirmation or slot floor for a base custody read, or vice versa. */
export function executionConnection(
  layer: ExecutionLayer,
  base: Connection,
  er: Connection,
) {
  return layer === "er" ? er : base;
}

export function validateErDeployment(deployment: Deployment) {
  const profile = profileForDeployment(deployment);
  if (deployment.er?.validator !== profile.validator.toBase58() || !deployment.er.rpcUrl)
    throw Error("The ER endpoint and validator are required");
  const endpoint = new URL(deployment.er.rpcUrl);
  if (!["http:", "https:"].includes(endpoint.protocol))
    throw Error("Invalid ER endpoint");
  if (profile.mainnet && (endpoint.protocol !== "https:" || endpoint.username || endpoint.password))
    throw Error("Mainnet ER requires a secure endpoint without embedded credentials");
  return deployment.er;
}
