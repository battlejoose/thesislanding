import type {Row} from './client.ts';
import {collateralFresh} from './collateral-value.ts';
import {crossed,isFresh} from './math.ts';
import {displayedPositionPnl} from './position-order.ts';
import {liquidationMeter,positionMeterState} from './liquidation-meter.ts';

/** Same price, P&L and liquidation model as personal positions. Display only. */
export function leaderboardLiveMark(position:Row,feed:Row|undefined,quote:Row|undefined,now:number,snapshotAgeMs:number|null|undefined){
  const unknown={pnl:null as bigint|null,price:'0',meter:liquidationMeter({entry:0n,bust:0n,margin:0n,price:0n,pnl:0n,long:true,fresh:false})};
  try{
    if(position.state!==0||position.erPending)return unknown;
    const fresh=(snapshotAgeMs??Infinity)<15000&&isFresh(feed,now)&&collateralFresh(quote,now);
    const pnl=fresh?displayedPositionPnl(position,feed,quote):null;
    return {pnl,price:String(feed?.price??'0'),meter:positionMeterState(position as any,{
      price:String(feed?.price??'0'),pnl:pnl??0n,fresh:fresh&&pnl!==null,
      liquidatable:fresh&&!!feed&&crossed(position,feed),
    })};
  }catch{return unknown;}
}
