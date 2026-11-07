import { appFetch as fetch } from "./app-url.ts";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type {WalletTokenSnapshot} from './wallet-discovery.ts';
import {startWalletBalancePolling,WalletBalanceRefresh} from './wallet-balance-polling.ts';

/** Shared by the wallet and bet selector. Background scans stay once a minute.
 * Confirmed deposits request an immediate refresh and one follow-up after the
 * server's five-second funding cache. Never compare server timestamps to the
 * device clock to decide whether to skip a refresh. No trading side effects. */
export function useWalletDiscovery(owner:string,enabled:boolean) {
  const [snapshot,setSnapshot]=useState<WalletTokenSnapshot>();
  const [error,setError]=useState('');
  const cache=useRef<WalletTokenSnapshot>();
  const activeOwner=useRef(owner);activeOwner.current=owner;
  const followup=useRef<ReturnType<typeof setTimeout>>();
  const revision=useRef(0);
  const withdrawnSnapshot=useRef<WalletTokenSnapshot>();
  const read=useCallback(async()=>{
    const startedRevision=revision.current;
    // Funding inventory includes every held mint and uses a five-second cache;
    // the token-list model deduplicates registered assets against these rows.
    const response=await fetch(`/api/wallet/funding?owner=${encodeURIComponent(owner)}`,{signal:AbortSignal.timeout(15_000),cache:'no-store'});
    if(!response.ok)throw Error('Wallet inventory unavailable');
    const data:WalletTokenSnapshot=await response.json();
    if(data.owner!==owner||!Array.isArray(data.tokens)||!Number.isFinite(data.checkedAt))throw Error('Invalid wallet inventory');
    if(activeOwner.current!==owner||revision.current!==startedRevision)return;
    // A cached pre-withdrawal scan must not restore tokens already sent.
    if(withdrawnSnapshot.current?.owner===owner&&data.checkedAt<=withdrawnSnapshot.current.checkedAt)return;
    if(!cache.current||cache.current.owner!==owner||cache.current.checkedAt<=data.checkedAt){cache.current=data;setSnapshot(data);}
    setError('');
  },[owner]);
  const queue=useMemo(()=>new WalletBalanceRefresh(read),[read]);
  const refresh=useCallback(async(afterCurrent=false)=>{
    try{await queue.run(afterCurrent);}catch{if(activeOwner.current===owner)setError('Other token balances temporarily unavailable');}
  },[owner,queue]);
  const refreshAfterDeposit=useCallback(()=>{
    void refresh(true);
    if(followup.current)clearTimeout(followup.current);
    followup.current=setTimeout(()=>{followup.current=undefined;void refresh(true);},6000);
  },[refresh]);
  useEffect(()=>{
    setError('');
    return()=>{activeOwner.current='';if(followup.current)clearTimeout(followup.current);};
  },[owner]);
  useEffect(()=>{
    activeOwner.current=owner;
    if(!enabled||!owner)return;
    return startWalletBalancePolling({refresh,intervalMs:60_000,visibility:document});
  },[enabled,owner,refresh]);
  const recordWithdrawal=useCallback((mint:string,amount:bigint)=>{
    const current=cache.current;
    if(current?.owner!==owner)return;
    revision.current++;
    withdrawnSnapshot.current=current;
    const next={...current,tokens:current.tokens.map(token=>token.mint!==mint?token:
      {...token,amount:String(BigInt(token.amount)>amount?BigInt(token.amount)-amount:0n)})};
    cache.current=next;setSnapshot(next);
  },[owner]);
  return {snapshot:snapshot?.owner===owner?snapshot:undefined,error,recordWithdrawal,refreshAfterDeposit};
}
