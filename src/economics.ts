import type { Row, Snapshot } from './client.ts';
import { pnl } from './math.ts';
const PX=1_000_000_000_000n;
const ceil=(n:bigint,d:bigint)=>n/d+(n%d===0n?0n:1n);

/** ETH parameters for every market. Integer order mirrors the contract. */
export function winningProfit(margin:bigint,entry:bigint,exit:bigint,leverage:number,deadband:boolean) {
  if (margin<0n || entry<=0n || !Number.isInteger(leverage) || leverage<1 || leverage>1000) throw Error('Invalid profit inputs');
  const diff=exit>entry?exit-entry:entry-exit, notional=margin*BigInt(leverage);
  const raw=notional*diff/entry, dead=deadband?entry/50_000n:0n;
  const adjusted=diff>dead?diff-dead:0n, afterDeadband=notional*adjusted/entry;
  const move=adjusted*PX/entry;
  if (!move || !afterDeadband) return {raw,afterDeadband,afterImpact:0n,winFee:0n,net:0n};
  const term1=ceil(PX*PX,move*15_000n), term2=ceil(100n*PX*PX,move*483_979n);
  const afterImpact=afterDeadband*(PX*9n/10n)/(PX+term1+term2);
  const net=afterImpact*98n/100n;
  return {raw,afterDeadband,afterImpact,winFee:afterImpact-net,net};
}

export function positionPnl(position:Row,margin:bigint,entry:bigint,exit:bigint,leverage:number,long:boolean) {
  const version=position.economicsVersion??0;
  if(version!==0 && version!==1)throw Error('Unknown position economics');
  const winning=long?exit>entry:exit<entry;
  if(version===0 || !winning)return pnl(margin,entry,exit,leverage,long);
  if(typeof position.profitDeadband!=='boolean')throw Error('Profit policy unavailable');
  return winningProfit(margin,entry,exit,leverage,position.profitDeadband).net;
}

/** Attach authoritative activation metadata to ER-open and archived rows alike.
 * Finalized profit/claim fields are never changed. No client wall-clock cutover.
 */
export function withEconomics(snapshot:Snapshot):Snapshot {
  const policy=snapshot.economicsPolicies?.[0];
  return {...snapshot, positions:snapshot.positions.map(position=>{
    const current=!!policy && BigInt(position.openedAt??0)>=BigInt(policy.activatedAt);
    return {...position,economicsVersion:current?1:0,profitDeadband:current?policy.deadband:true};
  })};
}
