import { appFetch as fetch } from "./app-url.ts";
import {useEffect,useRef,useState} from 'react';
import {PublicKey,VersionedTransaction} from '@solana/web3.js';
import {useWallet} from '@solana/wallet-adapter-react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import type {Deployment} from './client.ts';
import {Modal} from './components.tsx';
import {instantActivationTransaction} from './wallet-mode.ts';
import {signBlinkWalletTransaction} from './blink-wallet.ts';
import {validateWalletApproval} from './wallet-approval.ts';
import {assertActiveWallet} from './wallet-recovery.ts';

type Status={owner:string;active:boolean;grandfathered:boolean;state?:string;signature?:string;id?:string;error?:string};
async function request(url:string,data?:unknown) {
  const r=await fetch(url,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json'},
    body:data===undefined?undefined:JSON.stringify(data),cache:'no-store',signal:AbortSignal.timeout(20_000)});
  const result=await r.json();if(!r.ok)throw Error(result.error??'Wallet activation unavailable');return result;
}
export function InstantActivation({owner,deployment,onBusy}:{owner:string;deployment:Deployment;onBusy:(busy:boolean)=>void}) {
  const wallet=useWallet(),{setVisible}=useWalletModal(),[open,setOpen]=useState(false),[status,setStatus]=useState<Status>(),
    [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const current=useRef(wallet.publicKey?.toBase58());current.current=wallet.publicKey?.toBase58();
  const mounted=useRef(true),lock=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onBusy(false);};},[]);
  const accept=(s:Status)=>{if(s.owner!==owner)throw Error('Activation wallet mismatch');if(mounted.current)setStatus(s);};
  useEffect(()=>{
    let stopped=false,pending=false;
    const read=async()=>{if(pending)return;pending=true;try{
      const s=await request('/api/wallet/activation?owner='+encodeURIComponent(owner));if(!stopped)accept(s);
    }catch(e){if(!stopped)setError(e instanceof Error?e.message:'Activation unavailable');}finally{pending=false;}};
    void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},5000);
    return()=>{stopped=true;clearInterval(timer);};
  },[owner]);
  async function activate() {
    const payer=wallet.publicKey?.toBase58();if(!payer){setVisible(true);return;}
    if(lock.current)return;lock.current=true;setBusy(true);onBusy(true);setError('');
    const active=()=>{
      assertActiveWallet(localStorage,deployment,owner);
      if(!mounted.current||current.current!==payer||wallet.wallet?.adapter.publicKey?.toBase58()!==payer)
        throw Error('Wallet changed; activation payment was not submitted');
    };
    try {
      active();setMessage('Preparing your activation…');
      const prepared=await request('/api/wallet/activation/prepare',{owner,payer});accept(prepared);
      if(prepared.active||prepared.state==='pending'){setMessage('Checking payment confirmation…');return;}
      const tx=VersionedTransaction.deserialize(Buffer.from(prepared.transaction,'base64'));
      const expected=instantActivationTransaction(deployment.programId,new PublicKey(payer),new PublicKey(owner),tx.message.recentBlockhash);
      if(!Buffer.from(expected.message.serialize()).equals(Buffer.from(tx.message.serialize())))throw Error('Activation payment details changed; nothing was signed');
      active();setMessage('Approve 0.05 SOL plus the network fee in your browser wallet.');
      const signed=await signBlinkWalletTransaction(wallet,payer,tx,deployment.cluster==='mainnet-beta'?'mainnet-beta':'devnet');
      active();validateWalletApproval(expected,signed,new PublicKey(payer));
      accept(await request('/api/wallet/activation/submit',{id:prepared.id,transaction:Buffer.from(signed.serialize()).toString('base64')}));
      setMessage('Confirming activation… You will not be charged again while this payment is pending.');
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Activation failed');}
    finally{lock.current=false;onBusy(false);if(mounted.current)setBusy(false);}
  }
  return <>
    <button className={'wallet-mode-status'+(status?.active?' is-active':'')} onClick={()=>setOpen(true)}>
      {status?.active?'Instant wallet active':status?.state==='pending'?'Activation pending…':'Activate Instant · 0.05 SOL'}
    </button>
    {open&&<Modal title="Instant wallet" close={()=>{if(!busy)setOpen(false);}}>
      <div className="registration-card">
        {status?.active?<><strong className="activation-success">Your Instant wallet is active</strong>
          <p>{status.grandfathered?'Your existing wallet keeps access. No activation payment is required.':'Your one-time activation is complete.'}</p></>:
          <><div className="registration-fee">0.05 <span>SOL</span></div>
            <p>Activate this Instant wallet once. Trade without approving each transaction, with up to 10 open positions.</p>
            <p>The payment covers account setup and helps fund automatic settlement. Your browser wallet pays the network fee.</p>
            <p className="registration-payer">Instant wallet: {owner.slice(0,6)}…{owner.slice(-6)}</p>
            {!busy&&status?.state!=='pending'&&<p role="status">{wallet.connecting
              ?'Connecting your browser wallet…'
              :wallet.publicKey
                ?'Browser wallet connected. Next, pay to activate and approve the payment in your wallet.'
                :'First connect your browser wallet. Then approve a separate 0.05 SOL activation payment. Connecting does not make a payment.'}</p>}
            <button className="primary" aria-busy={busy||wallet.connecting} disabled={busy||wallet.connecting||status?.state==='pending'||!status} onClick={()=>void activate()}>
              {busy?'Processing activation…':status?.state==='pending'?'Confirming payment…':wallet.connecting?'Connecting…':wallet.publicKey?'2. Pay 0.05 SOL & activate':'1. Connect browser wallet'}
            </button></>}
        {!status?.active&&message&&<p role="status">{message}</p>}
        {status?.signature&&<a href={`https://solscan.io/tx/${status.signature}`} target="_blank" rel="noreferrer">View activation payment ↗</a>}
        {(error||status?.error)&&<p role="alert" className="error">{error||status?.error}</p>}
      </div>
    </Modal>}
  </>;
}
