import type { Project } from './projects';

// A contract address is the only input required. Null slots stay under wraps.
export const CONSTRUCTION_TOKENS: readonly (string | null)[] = [
  '7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze',
  null,
  null,
];

export function constructionProject(address:string|null,index:number):Project {
  return {
    id:address??`soon-${index}`,kind:address?'token':'soon',tokenAddress:address??undefined,
    dataState:address?'loading':undefined,name:'N/A',ticker:'N/A',category:'N/A',description:'N/A',
    cap:'N/A',change:'N/A',price:'N/A',volume:'N/A',liquidity:'N/A',image:'/art/brooklyn.webp',video:null,
    icon:'',color:'#9a9586',x:null,telegram:null,website:null,
    tokenUrl:address?`https://pump.fun/coin/${address}`:undefined,
  };
}

export const INITIAL_CONSTRUCTION_PROJECTS = CONSTRUCTION_TOKENS.map(constructionProject);
