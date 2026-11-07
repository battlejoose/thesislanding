export type WalletToken = {
  accounts?:{address:string;amount:string;frozen:boolean}[];
  mint:string; tokenProgram:string; decimals:number; amount:string; symbol:string; name:string; pumpfun:boolean|null;
};
export type WalletTokenSnapshot = {owner:string; tokens:WalletToken[]; checkedAt:number; truncated:boolean};
export const discoveredTokenStatus=(token:WalletToken)=>token.pumpfun===false?'not a pumpfun token':token.pumpfun===true?'Trading setup required':'Checking token…';
