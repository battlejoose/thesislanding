import type { Project } from './projects';

export const TOKEN_WEBSITE_X = -.38;
export const TOKEN_SOCIALS = [
  {key:'x',label:'X',x:.18},
  {key:'telegram',label:'Telegram',x:.74},
  {key:'discord',label:'Discord',x:1.30},
  {key:'github',label:'GitHub',x:1.86},
] as const;
export type TokenAction = 'title' | 'website' | 'retry' | typeof TOKEN_SOCIALS[number]['key'];
export function tokenFooterControls(p:Project){
  const ids=[...(p.website?['website' as const]:[]),...TOKEN_SOCIALS.filter(s=>!!p[s.key]).map(s=>s.key)];
  return ids.map((id,index)=>({id,x:1.86-(ids.length-1-index)*.56}));
}
export type InfoRegion = {id:string;left:number;right:number;bottom:number;top:number};
export const TOKEN_INFO_REGIONS:InfoRegion[] = [
  {id:'title',left:-1.22,right:1.98,bottom:-.65,top:-.17},
  {id:'price',left:-2.08,right:.02,bottom:-1.31,top:-.85},
  {id:'volume',left:.22,right:2.08,bottom:-1.31,top:-.85},
  {id:'cap',left:-2.08,right:.02,bottom:-2.12,top:-1.47},
  {id:'change',left:.22,right:2.08,bottom:-2.12,top:-1.47},
  {id:'website',left:TOKEN_WEBSITE_X-.22,right:TOKEN_WEBSITE_X+.22,bottom:-2.56,top:-2.15},
  ...TOKEN_SOCIALS.map(s=>({id:s.key,left:s.x-.22,right:s.x+.22,bottom:-2.56,top:-2.15})),
];
export function tokenRegionAt(point:{x:number;y:number}|null,p?:Project):string|null {
  const regions=p?[...TOKEN_INFO_REGIONS.slice(0,5),...tokenFooterControls(p).map(control=>({id:control.id,left:control.x-.22,right:control.x+.22,bottom:-2.56,top:-2.15}))]:TOKEN_INFO_REGIONS;
  return point?regions.find(r=>point.x>=r.left&&point.x<=r.right&&point.y>=r.bottom&&point.y<=r.top)?.id??null:null;
}
export function tokenActionAt(p:Project,point:{x:number;y:number}|null,titleRight=1.98):TokenAction|null {
  if(!point)return null;
  if(p.dataState==='error'&&point.x>=-1.8&&point.x<=1.8&&point.y>=.75&&point.y<=1.8)return 'retry';
  const region=tokenRegionAt(point,p),ready=p.dataState==='ready'||p.dataState==='stale';
  if(region==='title')return ready&&p.tokenUrl&&point.x>=-1.18&&point.x<=titleRight&&point.y>=-.56&&point.y<=-.19?'title':null;
  if(region==='website')return p.website?'website':null;
  return TOKEN_SOCIALS.find(s=>s.key===region&&p[s.key])?.key??null;
}
