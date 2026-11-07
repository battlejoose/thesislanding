import { isPrimary, type AssetInfo, type Row } from "./client.ts";
import { collateralFresh, collateralUsd } from "./collateral-value.ts";
import { NATIVE_MINT } from '@solana/spl-token';

/** Reuses streamed quotes and combined available wallet/ER balances. */
export function walletRows(assets: AssetInfo[], balances: Record<string,bigint>, quotes: Row[], quoteMint: string, now=Date.now()) {
  const pinned=(a:AssetInfo)=>isPrimary(a)?0:a.mint===NATIVE_MINT.toBase58()?1:a.mint===quoteMint?2:3;
  return [...new Map(assets.map(asset=>[asset.mint,asset])).values()]
    .filter(asset=>pinned(asset)<3||(balances[asset.mint]??0n)>0n)
    .map(asset=>{
      const balance=balances[asset.mint]??0n;
      let usd:bigint|undefined=balance===0n?0n:asset.mint===quoteMint?balance:undefined;
      if(usd===undefined) {
        const quote=quotes.find(q=>q.id===asset.feedId);
        try { if(quote&&collateralFresh(quote,now))usd=collateralUsd(balance,quote); } catch { /* Missing valuation is never zero. */ }
      }
      return {asset,balance,usd};
    }).sort((a,b)=>{
      if(pinned(a.asset)!==pinned(b.asset))return pinned(a.asset)-pinned(b.asset);
      if(a.usd===undefined||b.usd===undefined) {
        if(a.usd!==b.usd)return a.usd===undefined?1:-1;
      } else if(a.usd!==b.usd)return a.usd>b.usd?-1:1;
      return a.asset.symbol.localeCompare(b.asset.symbol)||a.asset.mint.localeCompare(b.asset.mint);
    });
}
