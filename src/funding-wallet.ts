import {NATIVE_MINT} from '@solana/spl-token';
import type {AssetInfo,Row} from './client.ts';
import type {WalletTokenSnapshot} from './wallet-discovery.ts';
import {walletTokenRows,type WalletTokenRow} from './wallet-token-list.ts';
import type {TokenDisplays} from './token-display.ts';
import {tokenAmountInput} from './withdrawal.ts';
import type {DepositAsset} from './wallet-deposit.ts';

export type FundingSnapshot=WalletTokenSnapshot & {nativeLamports:string};
export type FundingOption=WalletTokenRow & {id:string;spendable:bigint;transferAsset?:DepositAsset};
export function fundingFraction(balance:bigint,decimals:number,percent:25|50|100,fee=0n) {
  const spendable=balance>fee?balance-fee:0n;
  return tokenAmountInput(spendable*BigInt(percent)/100n,decimals);
}
/** Browser holdings only: never add the app wallet or ER trading balances. */
export function fundingOptions(snapshot:FundingSnapshot|undefined,assets:AssetInfo[],quotes:Row[],quoteMint:string,displays:TokenDisplays={},now=Date.now()):FundingOption[] {
  if(!snapshot)return [];
  const balances=Object.fromEntries(snapshot.tokens.map(t=>[t.mint,BigInt(t.amount)]));
  const rows=walletTokenRows(assets,balances,quotes,quoteMint,snapshot,displays,now).filter(r=>r.balance>0n);
  const result:FundingOption[]=rows.map(row=>{
    const token=snapshot.tokens.find(t=>t.mint===row.mint)!;
    const frozen=(token.accounts??[]).reduce((sum,a)=>sum+(a.frozen?BigInt(a.amount):0n),0n);
    const spendable=token.accounts?.length&&row.balance>frozen?row.balance-frozen:0n;
    const symbol=row.mint===NATIVE_MINT.toBase58()?'WSOL':row.symbol;
    return {...row,symbol,id:row.mint,spendable,transferAsset:{mint:token.mint,tokenProgram:token.tokenProgram,decimals:token.decimals,symbol,accounts:token.accounts}};
  });
  const native=BigInt(snapshot.nativeLamports);
  const sol=assets.find(a=>a.mint===NATIVE_MINT.toBase58());
  if(native>0n) {
    const row=sol?walletTokenRows([sol],{[sol.mint]:native},quotes,quoteMint,undefined,displays,now)[0]:
      {mint:NATIVE_MINT.toBase58(),symbol:'SOL',name:'Solana',balance:native,decimals:9,rank:1};
    result.unshift({...row,id:'SOL',spendable:native,transferAsset:undefined});
  }
  return result.sort((a,b)=>(a.id==='SOL'?-1:b.id==='SOL'?1:0)||
    (a.usd===undefined?b.usd===undefined?0:1:b.usd===undefined?-1:a.usd>b.usd?-1:a.usd<b.usd?1:0)||a.symbol.localeCompare(b.symbol));
}
