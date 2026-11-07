import { PublicKey } from '@solana/web3.js';
import registry from './generated/mainnet-releases.json';

export type MainnetRelease = {
  name: string; programId: string; admin: string; publisher: string; sponsor: string; validator: string;
  primaryMint: string; primaryPool: string; primaryTokenProgram: string; primarySymbol: string; secondarySymbol: string;
  primaryLogo: string; secondaryLogo: string; requireWalletAdmission: boolean;
};
export function validateMainnetRelease(input: MainnetRelease): MainnetRelease {
  for (const key of ['programId', 'admin', 'publisher', 'sponsor', 'validator', 'primaryMint', 'primaryPool', 'primaryTokenProgram'] as const) {
    if (new PublicKey(input[key]).equals(PublicKey.default)) throw Error(`Invalid release ${key}`);
  }
  if (new Set([input.programId, input.admin, input.publisher, input.sponsor]).size !== 4) throw Error('Release roles must be separate');
  if (!['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'].includes(input.primaryTokenProgram))
    throw Error('Unsupported primary token program');
  for (const symbol of [input.primarySymbol, input.secondarySymbol]) if (!/^[A-Za-z][A-Za-z0-9]{1,11}$/.test(symbol)) throw Error('Invalid release token symbol');
  if (input.primarySymbol === input.secondarySymbol) throw Error('Primary and ownership token symbols must differ');
  for (const logo of [input.primaryLogo, input.secondaryLogo]) if (!/^\/[a-zA-Z0-9/_-]+\.(svg|png|webp)$/.test(logo)) throw Error('Release logos must use local assets');
  if (typeof input.requireWalletAdmission !== 'boolean') throw Error('Explicit wallet admission policy required');
  return Object.freeze({ ...input });
}
export const MAINNET_RELEASES: readonly MainnetRelease[] = Object.freeze(registry.map(validateMainnetRelease));
if (new Set(MAINNET_RELEASES.map(r => r.programId)).size !== MAINNET_RELEASES.length) throw Error('Duplicate mainnet release program');
export function mainnetRelease(programId: string) {
  const release = MAINNET_RELEASES.find(r => r.programId === programId);
  if (!release) throw Error('Unsupported program/network deployment');
  return release;
}
