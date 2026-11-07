import { appFetch as fetch } from "./app-url.ts";
import {useState,useEffect,useRef} from 'react';
import {PublicKey,SystemProgram,TransactionMessage,VersionedTransaction,type Connection} from '@solana/web3.js';
import {useWallet} from '@solana/wallet-adapter-react';
import {Modal} from './components.tsx';
import type {Deployment} from './client.ts';
import {browserGasConsent,browserGasRefundTransaction} from './wallet-mode.ts';
import {signBlinkWalletTransaction} from './blink-wallet.ts';
import {validateWalletApproval} from './wallet-approval.ts';
import {assertBaseNetwork,profileForDeployment} from './deployment-profile.ts';
import {waitForSignature} from './confirmation.ts';
import {parseUnits} from './math.ts';
import {BrowserFunding} from './browser-funding.ts';
import type {BrowserGasStatus} from './browser-gas-status.ts';

const sol=(n:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:6}).format(n/1e9)+' SOL';
async function request(url:string,data?:unknown) {
  const r=await fetch(url,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json'},
    body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(20_000),cache:'no-store'});
  const result=await r.json();if(!r.ok)throw Error(result.error??'Gas reserve unavailable');return result;
}
export function BrowserGas({owner,deployment,connection,onBusy,returnCommitGas,hideTrigger=false,visible,onVisibleChange,onStatus}:{owner:string;deployment:Deployment;connection:Connection;onBusy:(busy:boolean)=>void;returnCommitGas:()=>Promise<string>;hideTrigger?:boolean;visible?:boolean;onVisibleChange?:(visible:boolean)=>void;onStatus?:(gas:BrowserGasStatus)=>void}) {
  const wallet=useWallet(),[gas,setGas]=useState<BrowserGasStatus>(),[open,setOpen]=useState(false),[busy,setBusy]=useState(false),
    [amount,setAmount]=useState('0.05'),[error,setError]=useState(''),[message,setMessage]=useState(''),[signature,setSignature]=useState('');
  const mounted=useRef(true),lock=useRef(false),current=useRef(wallet.publicKey?.toBase58());current.current=wallet.publicKey?.toBase58();
  const funding=useRef(new BrowserFunding(localStorage,deployment.programId,owner)).current;
  const [fundingPending,setFundingPending]=useState(!!funding.pending());
  const check=()=>{if(!mounted.current||current.current!==owner||wallet.wallet?.adapter.publicKey?.toBase58()!==owner)throw Error('Browser wallet changed; nothing was submitted');};
  const show=(next:boolean)=>{setOpen(next);onVisibleChange?.(next);};
  const accept=(value:BrowserGasStatus)=>{if(value.owner!==owner)throw Error('Gas reserve wallet mismatch');new PublicKey(value.address);if(mounted.current){setGas(value);onStatus?.(value);}};
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;onBusy(false);};},[]);
  useEffect(()=>{
    let stopped=false,pending=false;
    const read=async()=>{if(pending)return;pending=true;try{
      const result=await funding.reconcile(connection);
      const next=await request('/api/wallet/gas?owner='+encodeURIComponent(owner));
      if(!stopped){accept(next);setFundingPending(!!funding.pending());
        if(result){setSignature(result.signature);setMessage(result.failed?'Gas funding did not complete. You can approve another attempt.':'Your settlement reserve is funded.');}
        else if(funding.pending())setSignature(funding.pending()!.signature);
      }}
      catch(e){if(!stopped)setError(e instanceof Error?e.message:'Gas reserve unavailable');}finally{pending=false;}};
    void read();const timer=setInterval(()=>{if(document.visibilityState==='visible')void read();},10_000);
    return()=>{stopped=true;clearInterval(timer);};
  },[owner]);
  async function approve(tx:VersionedTransaction) {
    check();const expected=VersionedTransaction.deserialize(tx.serialize());
    const signed=await signBlinkWalletTransaction(wallet,owner,tx,deployment.cluster==='mainnet-beta'?'mainnet-beta':'devnet');
    check();validateWalletApproval(expected,signed,new PublicKey(owner));return signed;
  }
  async function run(refund:boolean) {
    if(lock.current||!gas)return;lock.current=true;setBusy(true);onBusy(true);setError('');setSignature('');
    try {
      check();await assertBaseNetwork(connection,profileForDeployment(deployment));
      if(refund) {
        const prepared=await request('/api/wallet/gas/refund/prepare',{owner});
        const tx=VersionedTransaction.deserialize(Buffer.from(prepared.transaction,'base64'));
        const expected=browserGasRefundTransaction(deployment.programId,new PublicKey(owner),new PublicKey(gas.address),prepared.amountLamports,tx.message.recentBlockhash);
        if(!Buffer.from(tx.message.serialize()).equals(Buffer.from(expected.message.serialize())))throw Error('Gas refund details changed; nothing was signed');
        setMessage(`Approve returning ${sol(prepared.amountLamports)} to your browser wallet. Your browser wallet pays the network fee.`);
        const signed=await approve(tx);
        const result=await request('/api/wallet/gas/refund/submit',{id:prepared.id,transaction:Buffer.from(signed.serialize()).toString('base64')});
        setSignature(result.signature);setMessage('Returning unused SOL…');
        const confirmed=await waitForSignature(connection,result.signature);
        if(confirmed.err)throw Error('Gas refund failed; the transfer was not completed');
        setMessage('Unused SOL returned. Final gas accounting may take a few seconds.');
      }else {
        const atoms=parseUnits(amount,9);
        if(atoms<=0n||atoms>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Enter a valid SOL amount');
        if(!gas.registered) {
          if(!wallet.signMessage)throw Error('Choose a browser wallet that supports message signing');
          const expires=Date.now()+120_000;setMessage('Approve automatic settlement from your prepaid reserve.');
          const consent=await wallet.signMessage(Buffer.from(browserGasConsent(deployment.programId,owner,gas.address,expires)));check();
          const result=await request('/api/wallet/gas/register',{owner,expires,signature:Buffer.from(consent).toString('base64')});
          if(result.address!==gas.address)throw Error('Gas reserve address changed');
        }
        const hash=await connection.getLatestBlockhash('confirmed');
        const tx=new VersionedTransaction(new TransactionMessage({payerKey:new PublicKey(owner),recentBlockhash:hash.blockhash,instructions:[
          SystemProgram.transfer({fromPubkey:new PublicKey(owner),toPubkey:new PublicKey(gas.address),lamports:atoms}),
        ]}).compileToV0Message());
        setMessage(`Approve adding ${amount} SOL to your settlement reserve.`);
        const signed=await approve(tx),attempt=funding.stage(signed,hash.lastValidBlockHeight),sig=attempt.signature;
        setFundingPending(true);setSignature(sig);
        const returned=await connection.sendRawTransaction(signed.serialize(),{skipPreflight:false,maxRetries:2});
        if(returned!==sig)throw Error('Funding response mismatch; checking your signed transaction before allowing another payment');
        setSignature(sig);setMessage('Confirming gas funding…');
        const confirmed=await waitForSignature(connection,sig);
        await funding.reconcile(connection);setFundingPending(!!funding.pending());
        if(confirmed.err)throw Error('Gas funding failed; please check the transaction');
        setMessage('Your settlement reserve is funded.');
      }
      accept(await request('/api/wallet/gas?owner='+encodeURIComponent(owner)));
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Gas reserve unavailable');}
    finally{lock.current=false;onBusy(false);if(mounted.current)setBusy(false);}
  }
  async function finishSession() {
    if(lock.current)return;lock.current=true;setBusy(true);onBusy(true);setError('');setSignature('');
    try {
      setMessage('Approve closing the empty trading session, then approve returning any remaining commit gas.');
      const sig=await returnCommitGas();if(sig)setSignature(sig);
      setMessage('Trading session closed. Any remaining commit gas is in your browser wallet. Trading account rent remains reserved; your next trade will ask to reopen the session.');
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Could not return commit gas');}
    finally{lock.current=false;onBusy(false);if(mounted.current)setBusy(false);}
  }
  return <>
    {!hideTrigger&&<button className="wallet-mode-status" onClick={()=>show(true)}>Settlement gas · {gas?sol(gas.balanceLamports):'—'}</button>}
    {(visible??open)&&<Modal title="Your settlement gas" close={()=>{if(!busy)show(false);}}><div className="registration-card">
      <p><strong>Browser-wallet trading requires settlement gas.</strong> Fund your reserve below, then place your bet.</p>
      <p>This separate SOL reserve pays for your automatic commits, liquidation and settlement. You approve trades in your browser wallet.</p>
      <dl className="gas-reserve-values"><div><dt>Available to return</dt><dd>{gas?sol(gas.availableLamports):'—'}</dd></div>
        <div><dt>Reserved for settlement</dt><dd>{gas?sol(gas.reservedLamports):'—'}</dd></div></dl>
      <p>{gas?sol(gas.positionReserveLamports):'0.02 SOL'} is initially reserved per position. Automatic settlement uses your prepaid SOL as needed. The rest becomes available after settlement and any FIFO claim finish.</p>
      <label>Add SOL<input aria-label="Settlement gas amount" inputMode="decimal" value={amount} disabled={busy} onChange={e=>setAmount(e.target.value)}/></label>
      <button className="primary" disabled={busy||!gas||gas.pending||fundingPending} onClick={()=>void run(false)}>{fundingPending?'Funding confirmation pending…':'Add settlement gas'}</button>
      <button disabled={busy||!gas?.availableLamports||gas.pending} onClick={()=>void run(true)}>Return unused SOL</button>
      <details><summary>Finish this trading session</summary><p>After withdrawing all trading collateral and backing, return unused commit gas from the trading account. This requires wallet approvals and closes the current session.</p>
        <button disabled={busy||!gas?.registered||gas.pending||!!gas.reservedLamports} onClick={()=>void finishSession()}>Close session &amp; return commit gas</button></details>
      {(message||gas?.pending)&&<p role="status">{gas?.pending?'A gas transaction is confirming.':message}</p>}
      {(signature||gas?.pendingSignature)&&<a href={`https://solscan.io/tx/${signature||gas?.pendingSignature}`} target="_blank" rel="noreferrer">View transaction ↗</a>}
      {error&&<p role="alert" className="error">{error}</p>}
    </div></Modal>}
  </>;
}
