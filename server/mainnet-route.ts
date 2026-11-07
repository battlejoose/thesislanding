import {PublicKey} from '@solana/web3.js';
import {bondingCurvePda} from '@pump-fun/pump-swap-sdk';
import {GLOBAL,FEES} from '../src/pump.ts';
import {MAINNET_USDC} from '../src/deployment-profile.ts';
import {validatedMainnetSolPool,validatedMainnetTokenPool,type MainnetPoolSnapshot} from './mainnet-pool.ts';

export function isRegisteredCurve(mint:PublicKey,registered:PublicKey) {return registered.equals(bondingCurvePda(mint));}
function binding(snapshot:MainnetPoolSnapshot,registered:PublicKey){
  if(isRegisteredCurve(snapshot.mint,registered))throw Error('Token must graduate to PumpSwap before registration');
  if(!snapshot.pool.equals(registered))throw Error('Collateral and mainnet pool binding differ');
}
/** Registration fixes the actual PumpSwap pool. A different venue cannot
 * replace its valuation or settlement accounts, even for the same mint. */
export function validatedMainnetSolRoute(snapshot:MainnetPoolSnapshot,registered=snapshot.pool,allowEmptyCollateral=false) {
  binding(snapshot,registered);
  const value=validatedMainnetSolPool(snapshot,allowEmptyCollateral);
  return {kind:'amm' as const,value,baseVault:value.pool.poolBaseTokenAccount,quoteVault:value.pool.poolQuoteTokenAccount,global:GLOBAL,fees:FEES};
}
export function validatedMainnetTokenRoute(snapshot:MainnetPoolSnapshot,quoteMint:PublicKey,registered=snapshot.pool,allowEmptyCollateral=false){
  binding(snapshot,registered);
  if(quoteMint.toBase58()!==MAINNET_USDC)throw Error('Only SOL and USDC quote pairs are supported');
  const value=validatedMainnetTokenPool(snapshot,quoteMint,allowEmptyCollateral);
  return {kind:'amm' as const,value,baseVault:value.pool.poolBaseTokenAccount,quoteVault:value.pool.poolQuoteTokenAccount,global:GLOBAL,fees:FEES};
}
