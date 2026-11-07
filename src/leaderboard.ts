import type {Row} from './client.ts';

export type LeaderboardPosition={id:string;position:string;owner:string;market:string;collateral:string;long:boolean;leverage:number;profitUsd:string;entryUsd:string;margin?:string;closedAt:number;signature?:string};
export type LeaderboardResponse={positions:(LeaderboardPosition&{username?:string})[];usernames:Record<string,string>;updatedAt:number};
export type OpenLeaderboardPosition=Omit<LeaderboardPosition,'profitUsd'|'closedAt'>&{openedAt:number;leveragedUsd:string};
/** Uses the existing shared trading snapshot; no leaderboard RPC or price feed. */
export function rankOpenPositions(positions:Row[],limit=100):OpenLeaderboardPosition[]{
  const rows=positions.flatMap((p):OpenLeaderboardPosition[]=>{
    try {
      const leverage=Number(p.leverage),openedAt=Number(p.openedAt);
      if(p.state!==0||p.erPending||!p.key||!p.owner||!p.market||!p.collateral||
        !/^\d+$/.test(String(p.openedSlot))||!/^\d+$/.test(String(p.entryValue))||BigInt(p.entryValue)<=0n||
        !Number.isSafeInteger(leverage)||leverage<=0||!Number.isSafeInteger(openedAt)||openedAt<=0)return [];
      return [{id:`${p.key}:${p.openedSlot}:${p.nonce}`,position:p.key,owner:p.owner,market:p.market,collateral:p.collateral,
        long:p.long===true,leverage,entryUsd:String(p.entryValue),leveragedUsd:(BigInt(p.entryValue)*BigInt(leverage)).toString(),
        ...(/^\d+$/.test(String(p.margin))?{margin:String(p.margin)}:{}),openedAt}];
    }catch{return [];}
  });
  return [...new Map(rows.map(row=>[row.id,row])).values()].sort((a,b)=>{
    const difference=BigInt(b.leveragedUsd)-BigInt(a.leveragedUsd);
    return difference>0n?1:difference<0n?-1:a.openedAt-b.openedAt||a.id.localeCompare(b.id);
  }).slice(0,limit);
}
export function profitablePositions(positions:Row[]):LeaderboardPosition[]{
  return positions.flatMap(p=>{
    try {
      if(p.erPending||![1,2].includes(p.state)||BigInt(p.profit)<=0n||BigInt(p.loss??0)>0n||
        !p.key||!p.owner||!p.market||!p.collateral||!/^\d+$/.test(String(p.openedSlot))||!/^\d+$/.test(String(p.entryValue)))return [];
      const closedAt=Number(p.closedAt);if(!Number.isSafeInteger(closedAt)||closedAt<=0)return [];
      return [{id:`${p.key}:${p.openedSlot}:${p.nonce}`,position:p.key,owner:p.owner,market:p.market,collateral:p.collateral,long:p.long===true,
        leverage:Number(p.leverage),profitUsd:String(p.profit),entryUsd:String(p.entryValue),
        ...(/^\d+$/.test(String(p.margin))?{margin:String(p.margin)}:{}),closedAt,signature:p.settlementSignature}];
    }catch{return [];}
  });
}
export function leaderboardBetAmount(margin:string|undefined,decimals:number|undefined){
  if(!margin||!/^\d+$/.test(margin)||decimals===undefined||!Number.isInteger(decimals)||decimals<0||decimals>255)return '—';
  const amount=BigInt(margin),scale=10n**BigInt(decimals);
  const fraction=(amount%scale).toString().padStart(decimals,'0').replace(/0+$/,'');
  return (amount/scale).toLocaleString('en-US')+(fraction?'.'+fraction:'');
}
export function rankPositions(rows:LeaderboardPosition[],limit=100){
  return [...new Map(rows.map(row=>[row.id,row])).values()].sort((a,b)=>{
    const d=BigInt(b.profitUsd)-BigInt(a.profitUsd);
    return d>0n?1:d<0n?-1:a.closedAt-b.closedAt||a.id.localeCompare(b.id);
  }).slice(0,limit);
}
export function usernameMessage(program:string,origin:string,owner:string,username:string,nonce:string,expires:number){
  return `Claim an acidpump.fun leaderboard username\nWebsite: ${origin}\nProgram: ${program}\nWallet: ${owner}\nUsername: ${username}\nNonce: ${nonce}\nExpires: ${expires}\nThis message does not authorize a transaction or transfer.`;
}
export const USERNAME_CHALLENGE_TTL_MS=300000;
export type UsernameChallenge={owner:string;username:string;nonce:string;issuedAt:number;expires:number;message:string};
/** Compare the server's two timestamps, never its clock against the user's clock.
 * The server still enforces expiration and single use when the signature returns. */
export function validUsernameChallenge(value:unknown,expected:{program:string;origin:string;owner:string;username:string}):value is UsernameChallenge{
  if(!value||typeof value!=='object')return false;
  const c=value as UsernameChallenge;
  return c.owner===expected.owner&&c.username===expected.username&&typeof c.nonce==='string'&&/^[a-f0-9]{48}$/.test(c.nonce)&&
    Number.isSafeInteger(c.issuedAt)&&c.issuedAt>0&&Number.isSafeInteger(c.expires)&&c.expires-c.issuedAt===USERNAME_CHALLENGE_TTL_MS&&
    c.message===usernameMessage(expected.program,expected.origin,expected.owner,expected.username,c.nonce,c.expires);
}
export function validUsername(name:unknown):name is string {return typeof name==='string'&&/^[A-Za-z0-9_]{3,20}$/.test(name)&&!['admin','support','acidpump','moderator'].includes(name.toLowerCase());}
