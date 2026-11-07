import type {Row} from './client.ts';
export type TradeActivity={id:string;kind:'open'|'close';collateral:string;market:string;long:boolean;usd:number;at:number};
/** Diff the confirmed shared snapshot. ER closing intents count once; later
 * base settlement/receipt updates must not replay the same close animation. */
export class TradeActivityTracker {
  private seen=new Map<string,number>();
  private started=0;
  receive(rows:Row[],now=Date.now()):TradeActivity[]{
    const initial=!this.started;if(initial)this.started=now;
    const events:TradeActivity[]=[];
    for(const row of rows){
      if(!row.owner||row.nonce===undefined||![0,1,2].includes(row.state))continue;
      const id=`${row.owner}:${row.nonce}`,phase=row.state===0&&!row.erPending?1:2,previous=this.seen.get(id)??0;
      if(phase<=previous)continue;
      this.seen.set(id,phase);
      const opened=Number(row.openedAt)*1000,closed=Number(row.closedAt)*1000;
      if(initial||!previous&&!(opened>=this.started-1000||closed>=this.started-1000))continue;
      const usd=Number(row.entryValue)*Number(row.leverage)/1e6;
      if(!Number.isFinite(usd)||usd<0)continue;
      const add=(kind:'open'|'close',at:number)=>events.push({id:id+':'+kind,kind,collateral:row.collateral,market:row.market,long:row.long===true,usd,at:Number.isFinite(at)?at:now});
      if(!previous&&opened>=this.started-1000)add('open',opened);
      if(phase===2)add('close',closed||now);
    }
    // Old historical rows are excluded by timestamp even after eviction.
    while(this.seen.size>10000)this.seen.delete(this.seen.keys().next().value!);
    return events.sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));
  }
}
