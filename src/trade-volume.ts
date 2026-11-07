export type VolumeReading={pool:string;atoms:string|null;animate:boolean};
export type VolumeReaction=VolumeReading&{from:string|null;revision:number};
export function volumeAtoms(value:string|undefined,ready:boolean):string|null{
  return ready&&typeof value==='string'&&/^\d+$/.test(value)?BigInt(value).toString():null;
}
export function formatTradeVolume(atoms:string|null){
  if(atoms===null)return '—';
  const cents=(BigInt(atoms)+5000n)/10000n;
  return '$'+(cents/100n).toLocaleString('en-US')+'.'+(cents%100n).toString().padStart(2,'0');
}
/** One reaction per increase. Initial loads, pool changes and hidden-page
 * catch-up establish a baseline without replaying old volume. */
export function advanceVolumeReaction(previous:VolumeReaction|undefined,next:VolumeReading):VolumeReaction{
  if(previous&&previous.pool===next.pool&&previous.atoms===next.atoms&&previous.animate===next.animate)return previous;
  const increased=!!previous&&previous.pool===next.pool&&previous.animate&&next.animate&&previous.atoms!==null&&next.atoms!==null&&BigInt(next.atoms)>BigInt(previous.atoms);
  return {...next,from:increased?formatTradeVolume(previous!.atoms):null,revision:(previous?.revision??0)+(increased?1:0)};
}
/** Two quick turns per digit, then land exactly on the newest total. Align
 * from the right so carries such as $999.99 → $1,000.00 roll correctly. */
export function volumeReels(from:string,to:string){
  const old=from.replace(/\D/g,'').padStart(to.replace(/\D/g,'').length,'0');let digit=0;
  return [...to].map(char=>{
    if(!/\d/.test(char))return {char};
    const start=Number(old[digit++]??0),end=start+20+(Number(char)-start+10)%10;
    return {char,start,end};
  });
}
