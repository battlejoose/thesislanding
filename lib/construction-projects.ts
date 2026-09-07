import type { Project } from './projects';

// A contract address is the only input required. Null slots stay under wraps.
export const CONSTRUCTION_TOKENS: readonly (string | null)[] = [
  '4nCmpwne7hCoWTSpAd54uENmCgHJrHTyn4DMPCEMpump',
  null,
  null,
];

// Keep tile 1's globe destination through token metadata refreshes.
export const CONSTRUCTION_OVERRIDES: readonly Partial<Project>[] = [
  { website:'https://soltoshidice.wtf/?room=the-block&ref=EjHmRNG3Ee6iEpGa9yTWA2Y6wqUsnQVZefJJTntpN7mo' },
];

export function constructionProject(address:string|null,index:number):Project {
  return {
    id:address??`soon-${index}`,kind:address?'token':'soon',tokenAddress:address??undefined,
    dataState:address?'loading':undefined,name:'N/A',ticker:'N/A',category:'N/A',description:'N/A',
    cap:'N/A',change:'N/A',price:'N/A',volume:'N/A',liquidity:'N/A',image:address?`/api/tokens/${address}/image`:'/art/brooklyn.webp',video:null,
    icon:'',color:'#9a9586',x:null,telegram:null,website:null,
    tokenUrl:address?`https://pump.fun/coin/${address}`:undefined,
    ...(address?CONSTRUCTION_OVERRIDES[index]:{}),
  };
}

export const INITIAL_CONSTRUCTION_PROJECTS = CONSTRUCTION_TOKENS.map(constructionProject);
