import { appFetch as fetch } from "./app-url.ts";
import {useEffect,useState} from 'react';
import type {AssetInfo} from './client.ts';
import type {WalletTokenSnapshot} from './wallet-discovery.ts';
import {startWalletBalancePolling} from './wallet-balance-polling.ts';
import {TOKEN_DISPLAY_REFRESH_MS,type TokenDisplays} from './token-display.ts';

export function useTokenDisplays(assets:AssetInfo[],discovered:WalletTokenSnapshot|undefined,enabled:boolean) {
  const [displays,setDisplays]=useState<TokenDisplays>({});
  const mints=[...new Set([...assets.map(a=>a.sourceMint&&a.sourceMint!=='11111111111111111111111111111111'?a.sourceMint:a.mint),...(discovered?.tokens.map(t=>t.mint)??[])])].sort().join(',');
  useEffect(()=>{
    if(!mints)return;
    let pending=false,stopped=false;
    const abort=new AbortController();
    const refresh=async()=>{
      if(pending)return;pending=true;
      try {
        const keys=mints.split(','),next:TokenDisplays={};
        // Bounded HTTP pages; the server shares/deduplicates provider requests.
        for(let i=0;i<keys.length;i+=120){
          const r=await fetch('/api/wallet/token-display?mints='+keys.slice(i,i+120).join(','),{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(10_000)])});
          if(!r.ok)throw Error('Token display unavailable');
          Object.assign(next,await r.json());
        }
        if(!stopped)setDisplays(previous=>({...previous,...next}));
      }catch{/* Old quotes keep their timestamps; unavailable prices never become zero. */}
      finally{pending=false;}
    };
    // Fetch metadata once when the asset set changes, so positions get their
    // logos even before the wallet is opened. Only visible wallet lists poll.
    const stop=enabled?startWalletBalancePolling({refresh,intervalMs:TOKEN_DISPLAY_REFRESH_MS,visibility:document}):(()=>{void refresh();return()=>{};})();
    return()=>{stopped=true;abort.abort();stop();};
  },[enabled,mints]);
  return displays;
}
