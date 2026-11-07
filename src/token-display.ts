/** Display metadata only. Never use these prices for admission or settlement. */
export type TokenDisplay = {mint:string; marketCapUsd?:string; supply?:string; imageUrl?:string; updatedAt:number};
export type TokenDisplays = Record<string,TokenDisplay>;
export function assetImage(displays: TokenDisplays, asset: {mint: string; sourceMint?: string}) {
  const source = asset.sourceMint && asset.sourceMint !== '11111111111111111111111111111111' ? asset.sourceMint : asset.mint;
  return tokenImageUrl(displays[source]?.imageUrl);
}
export const TOKEN_DISPLAY_REFRESH_MS = 5000;
export const TOKEN_DISPLAY_MAX_AGE_MS = 20_000;

export function tokenDisplayUsd(amount:bigint,decimals:number,display?:TokenDisplay,now=Date.now()):bigint|undefined {
  if(amount===0n)return 0n;
  if(!display?.marketCapUsd||!display.supply||now-display.updatedAt>TOKEN_DISPLAY_MAX_AGE_MS||display.updatedAt>now+2000||
    !Number.isInteger(decimals)||decimals<0||decimals>255||!/^\d{1,16}(\.\d{1,30})?$/.test(display.marketCapUsd)||
    !/^\d{1,20}$/.test(display.supply)||BigInt(display.supply)===0n)return;
  // Pump's supply and wallet balance are both base units: no floating-point
  // token conversion, assumed mint decimals, or extra supply RPC is needed.
  const [whole,fraction='']=display.marketCapUsd.split('.');
  return amount*BigInt(whole+fraction)*1_000_000n/(BigInt(display.supply)*10n**BigInt(fraction.length));
}

export function tokenImageUrl(value:unknown):string|undefined {
  if(typeof value!=='string'||value.length>2048)return;
  try {
    const url=new URL(value.startsWith('ipfs://')?'https://ipfs.io/ipfs/'+value.slice(7).replace(/^ipfs\//,''):value);
    // Pump metadata may point at IPFS or the creator's image host. These are
    // browser <img> URLs only; the server never fetches arbitrary metadata URLs.
    if(url.protocol!=='https:'||url.username||url.password||url.port||!url.hostname.includes('.')||
      /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname)||
      /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)||url.hostname.includes(':'))return;
    return url.href;
  }catch{return;}
}
