import {isPrimary,type AssetInfo,type Row} from './client.ts';
import type {WalletToken,WalletTokenSnapshot} from './wallet-discovery.ts';
import {walletRows} from './wallet-rows.ts';
import {tokenDisplayUsd,type TokenDisplays} from './token-display.ts';

export type WalletTokenRow={mint:string;symbol:string;name:string;balance:bigint;decimals:number;asset?:AssetInfo;token?:WalletToken;usd?:bigint;imageUrl?:string;rank:number};
export const walletTokenAction=(row:WalletTokenRow)=>row.asset?.collateral?'select':!row.asset&&row.token?.pumpfun===true?'register':'none';

/** Both panels share ordering, values, identity and click eligibility. */
export function walletTokenRows(assets:AssetInfo[],balances:Record<string,bigint>,quotes:Row[],quoteMint:string,discovered?:WalletTokenSnapshot,displays:TokenDisplays={},now=Date.now()):WalletTokenRow[] {
  const rows:WalletTokenRow[]=walletRows(assets,balances,quotes,quoteMint,now).map(({asset,balance,usd})=>{
    const display=displays[asset.sourceMint]??displays[asset.mint];
    return {mint:asset.mint,symbol:asset.symbol,name:asset.name,balance,decimals:asset.decimals,asset,
      usd:usd??tokenDisplayUsd(balance,asset.decimals,display,now),imageUrl:display?.imageUrl,
      rank:isPrimary(asset)?0:asset.mint==='So11111111111111111111111111111111111111112'?1:asset.mint===quoteMint?2:3};
  });
  const known=new Set([...assets.map(a=>a.mint),quoteMint]);
  for(const token of discovered?.tokens??[]){
    if(known.has(token.mint)||!/^\d+$/.test(token.amount)||BigInt(token.amount)===0n)continue;
    known.add(token.mint);
    const balance=BigInt(token.amount),display=displays[token.mint];
    rows.push({mint:token.mint,symbol:token.symbol,name:token.name,balance,decimals:token.decimals,token,
      usd:tokenDisplayUsd(balance,token.decimals,display,now),imageUrl:display?.imageUrl,rank:3});
  }
  return rows.sort((a,b)=>a.rank-b.rank||(a.usd===undefined?b.usd===undefined?0:1:b.usd===undefined?-1:a.usd>b.usd?-1:a.usd<b.usd?1:0)||a.symbol.localeCompare(b.symbol)||a.mint.localeCompare(b.mint));
}
