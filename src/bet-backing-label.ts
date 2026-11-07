import type {AssetInfo,Row} from './client.ts';
import {isPrimary,isSol} from './client.ts';
import {collateralFresh,collateralUsd} from './collateral-value.ts';
import {parseUnits} from './math.ts';

export function betBackingRequired(asset:AssetInfo,quoteMint:string,available:bigint|undefined,amount:string,quotes:Row[],now:number,exemptMints:readonly string[]=[]) {
  if(exemptMints.includes(asset.mint))return false;
  if(isPrimary(asset)||isSol(asset)||asset.mint===quoteMint)return false;
  if(available===undefined||available<=0n)return true;
  try {
    const quote=quotes.find(q=>q.id===asset.feedId);
    if(!quote||!collateralFresh(quote,now))return false; // Unknown price is not proof of insufficient backing.
    return collateralUsd(parseUnits(amount,asset.decimals),quote)>available;
  }catch{return false;}
}
