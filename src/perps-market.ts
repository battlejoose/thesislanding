import {PublicKey} from '@solana/web3.js';
import type {Deployment,AssetInfo,VenueInfo} from './client.ts';
import {programAddresses} from './program-addresses.ts';

export const PERPS_MINT='51H7AzyyUAy6AkTPa2g1AMyfkoEoVXZjAKkqyHTopump';
export const PERPS_OPERATIONS='ELczEiAWnZ4WimPXBoArTeiq4c4x7Y52ud49tSr9q9R5';
export const PERPS_OPERATIONS_SECONDARY='8bCzV1vbWcGBVfdj85YJXtnuQTbJ6fBREsYieaiRPjTm';
export const PERPS_POOL='Ex7py8GH5UgcPDhd5KSGHHR7eTWbAt44p2WWor8MZxPF';
const USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export function perpsConfig(programId:string) {
  return PublicKey.findProgramAddressSync([Buffer.from('config'),Buffer.from('usdc-perps-v1')],new PublicKey(programId))[0];
}
export function isPerpsMarket(d:Pick<Deployment,'programId'|'cluster'|'venue'>) {
  return d.cluster==='mainnet-beta' && d.venue?.config===perpsConfig(d.programId).toBase58();
}
export function perpsRewardAsset(d:Deployment):AssetInfo {
  const asset=d.assets.find(a=>a.mint===PERPS_MINT);
  if(!asset||asset.decimals!==6||asset.sourceMint!==PERPS_MINT||asset.sourcePool!==asset.dexPool)
    throw Error('The canonical PERPS reward asset must be registered');
  return asset;
}
export function perpsVenue(programId:string):VenueInfo {
  const config=perpsConfig(programId),a=programAddresses(programId,config);
  return {config:config.toBase58(),pool:a.poolPda(0).toBase58(),venue:a.venuePda().toBase58(),
    mint:USDC,symbol:'USDC',name:'USDC / pPERPS',rewardMint:PERPS_MINT};
}
/** Validate reward metadata before selecting the account namespace. */
export function registeredVenueConfig(programId:string,venue:VenueInfo):PublicKey {
  if(venue.rewardMint) {
    if(venue.rewardMint!==PERPS_MINT||venue.mint!==USDC)throw Error('Unsupported reward market');
    return perpsConfig(programId);
  }
  return programAddresses(programId).venueConfigPda(new PublicKey(venue.mint));
}
/** The legacy USDC and pPERPS pools intentionally share a payout symbol. */
export function separateUsdcRewardPools(programId:string,a:VenueInfo,b:VenueInfo):boolean {
  if(a.mint!==USDC||b.mint!==USDC||a.rewardMint===b.rewardMint)return false;
  return [a,b].every(v=>{
    try {const config=registeredVenueConfig(programId,v),p=programAddresses(programId,config);
      return v.config===config.toBase58()&&v.pool===p.poolPda(0).toBase58()&&v.venue===p.venuePda().toBase58();
    } catch {return false;}
  });
}
