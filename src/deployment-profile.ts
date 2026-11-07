import type { Idl } from "@anchor-lang/core";
import { PublicKey, type Connection } from "@solana/web3.js";
import devnetIdl from "../idl.json";
import mainnetTestIdl from "../idl.mainnet-test.json";
import modularIdl from "../idl.modular.json";
import { DEVNET_PROGRAM_ID, MAINNET_TEST_PROGRAM_ID, programAddresses } from "./program-addresses.ts";
import { MAINNET_RELEASES, mainnetRelease, validateMainnetRelease, type MainnetRelease } from './mainnet-release.ts';
import {perpsConfig,PERPS_MINT} from './perps-market.ts';

export const DEVNET_GENESIS = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
export const MAINNET_GENESIS = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
export const MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const MAINNET_USDC_POOL = "Gf7sXMoP8iRw4iiXmJ1nq4vxcRycbGXy5RL8a8LnTd3v";
export const MAINNET_TEST_ADMIN = "7MX8VQiMD7itp21g6TdzrCpFS8NBKytZiaemHbXEFx3w";
export const MAINNET_TEST_PUBLISHER = "5ikTLEQkDJszk4ncQuUWh3fnd4TYUhr8JMu6EEj85nSu";

function profile(cluster: "devnet" | "mainnet-beta", id: string, genesis: string, validator: string, idl: Idl, release?: MainnetRelease,
  modular?: { venueConfig?: string; localnet: boolean }) {
  if (idl.address !== id) throw Error("Contract interface belongs to a different deployment");
  return Object.freeze({ cluster, mainnet: cluster === "mainnet-beta", coreBacking: true, programId: new PublicKey(id),
    genesis, validator: new PublicKey(validator), idl, addresses: programAddresses(id, modular?.venueConfig), release,
    /** Fresh multi-venue deployments built from programs/acidpump-er with venues. */
    modular: !!modular, localnet: modular?.localnet ?? false,
    venueConfig: modular?.venueConfig ? new PublicKey(modular.venueConfig) : undefined });
}
/** Rebind an interface's root address and embedded owner-program constants. */
export function rebindIdl(source: Idl, programId: string): Idl {
  const oldBytes = JSON.stringify([...new PublicKey(source.address).toBytes()]);
  const newBytes = [...new PublicKey(programId).toBytes()];
  const bind = (value: any): any => {
    if (value === source.address) return programId;
    if (Array.isArray(value)) return JSON.stringify(value) === oldBytes ? newBytes : value.map(bind);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, bind(v)]));
    return value;
  };
  return bind(source) as Idl;
}
export const DEVNET_PROFILE = profile("devnet", DEVNET_PROGRAM_ID, DEVNET_GENESIS,
  "MUS3hc9TCw4cGC12vHNoYcCGzJG1txjgQLZWVoeNHNd", devnetIdl as Idl);
/** Rebind both the root address and embedded owner-program/PDA constants.
 * The launch builder compares this interface with the compiler's actual IDL. */
export function mainnetIdl(programId: string): Idl {
  return rebindIdl(mainnetTestIdl as Idl, programId);
}
export function mainnetProfile(release: MainnetRelease) {
  release = validateMainnetRelease(release);
  return profile('mainnet-beta', release.programId, MAINNET_GENESIS, release.validator,
    mainnetIdl(release.programId), release, { localnet: false });
}
const mainnetProfiles = MAINNET_RELEASES.map(mainnetProfile);
export const MAINNET_TEST_PROFILE = mainnetProfiles.find(p => p.programId.toBase58() === MAINNET_TEST_PROGRAM_ID)!;
export type DeploymentProfile = typeof DEVNET_PROFILE;
type DeploymentIdentity = { programId: string; cluster: string; quoteMint: string; admin: string; publisher: string; er?: { validator: string };
  modular?: boolean; localnet?: boolean; genesis?: string; venue?: { config: string; mint: string; pool: string; venue: string; rewardMint?:string } };
const modularProfiles = new Map<string, DeploymentProfile>();
/** A fresh multi-venue deployment on devnet or a local validator. Each venue
 * gets its own (memoized) profile so the client's addresses are namespaced. */
function modularProfile(d: DeploymentIdentity): DeploymentProfile {
  if (d.cluster === 'mainnet-beta') {
    // Resolve and validate the pinned root identities first. A venue cannot
    // replace the program, administrator, publisher, chain or ER validator.
    const root = profileForDeployment({ ...d, modular: false, venue: undefined });
    if (d.localnet || (d.genesis && d.genesis !== MAINNET_GENESIS)) throw Error('Invalid mainnet network identity');
    if (!d.venue) return root;
    if(d.venue.rewardMint && (d.venue.rewardMint!==PERPS_MINT||d.venue.mint!==MAINNET_USDC))throw Error('Unsupported reward market');
    const expected = d.venue.rewardMint?perpsConfig(d.programId):root.addresses.venueConfigPda(new PublicKey(d.venue.mint));
    const addresses = programAddresses(d.programId, expected);
    if (d.venue.config !== expected.toBase58() || d.venue.pool !== addresses.poolPda(0).toBase58()
      || d.venue.venue !== addresses.venuePda().toBase58() || d.venue.mint === root.release!.primaryMint)
      throw Error('Mainnet venue identity mismatch');
    const key = `mainnet:${d.programId}:${d.venue.config}`;
    let selected = modularProfiles.get(key);
    if (!selected) {
      selected = profile('mainnet-beta', d.programId, MAINNET_GENESIS, root.validator.toBase58(), root.idl,
        root.release, { venueConfig: d.venue.config, localnet: false });
      modularProfiles.set(key, selected);
    }
    return selected;
  }
  if (d.cluster !== "devnet" || !d.er?.validator) throw Error("Modular deployments run on devnet or localnet");
  if (!d.localnet && d.genesis && d.genesis !== DEVNET_GENESIS) throw Error("Devnet deployment has a different genesis");
  if (d.localnet && !d.genesis) throw Error("Localnet deployment must record its genesis hash");
  const key = [d.programId, d.er.validator, d.genesis ?? DEVNET_GENESIS, d.venue?.config ?? "root", d.localnet ? "local" : "devnet"].join(":");
  let selected = modularProfiles.get(key);
  if (!selected) {
    selected = profile("devnet", d.programId, d.localnet ? d.genesis! : DEVNET_GENESIS, d.er.validator,
      rebindIdl(modularIdl as Idl, d.programId), undefined, { venueConfig: d.venue?.config, localnet: !!d.localnet });
    modularProfiles.set(key, selected);
  }
  return selected;
}

export function profileForDeployment(d: DeploymentIdentity): DeploymentProfile {
  if (d.modular) return modularProfile(d);
  if (d.venue) throw Error('A venue requires a modular deployment');
  const selected = [DEVNET_PROFILE, ...mainnetProfiles].find(p => p.programId.toBase58() === d.programId && p.cluster === d.cluster);
  if (!selected) throw Error("Unsupported program/network deployment");
  if (d.er && d.er.validator !== selected.validator.toBase58()) throw Error("Deployment uses the wrong ER validator");
  if (selected.mainnet) {
    const release = mainnetRelease(d.programId);
    if (d.quoteMint !== MAINNET_USDC || d.admin !== release.admin || d.publisher !== release.publisher)
      throw Error("Mainnet deployment identity or quote mint mismatch");
  }
  return selected;
}
export async function assertBaseNetwork(connection: Pick<Connection, "getGenesisHash">, selected: DeploymentProfile) {
  if (await connection.getGenesisHash() !== selected.genesis) throw Error(`Expected Solana ${selected.cluster} base network`);
}
