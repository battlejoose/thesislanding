import { appFetch as fetch } from "./app-url.ts";
import {useEffect,useRef,useState} from 'react';
import {PublicKey,VersionedTransaction,type Keypair,type Connection} from '@solana/web3.js';
import {useWallet} from '@solana/wallet-adapter-react';
import {useWalletModal} from '@solana/wallet-adapter-react-ui';
import {ed25519} from '@noble/curves/ed25519';
import {QRCodeSVG} from 'qrcode.react';
import type {Deployment} from './client.ts';
import type {WalletToken} from './wallet-discovery.ts';
import {registrationConsent,registrationHoldingConsent,validateRegistrationPayment,TOKEN_REGISTRATION_LAMPORTS} from './token-registration.ts';
import {signBlinkWalletTransaction} from './blink-wallet.ts';
import {validateWalletApproval} from './wallet-approval.ts';
import {assertActiveWallet,loadLocalWallet,hasWalletBackup} from './wallet-recovery.ts';
import {WalletRecovery} from './WalletRecovery.tsx';
import {Modal} from './components.tsx';
import {RegistrationProgress} from './RegistrationProgress.tsx';
import {registrationSteps, type RegistrationStage} from './registration-progress.ts';
import './token-registration.css';

type Method='instant'|'browser';
export function TokenRegistration({token,wallet,deployment,connection,onClose,onReady}:{token:WalletToken;wallet?:Keypair;deployment:Deployment;connection:Connection;onClose:()=>void;onReady:(d:Deployment)=>void}) {
  const browser=useWallet(),{setVisible}=useWalletModal();
  const connected=browser.publicKey?.toBase58()??'',activeBrowser=useRef(connected);activeBrowser.current=connected;
  const market=deployment.venue?.config??'root';
  const [instant]=useState(()=>wallet??loadLocalWallet(localStorage,deployment)),instantAddress=instant.publicKey.toBase58();
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(''),[signature,setSignature]=useState('');
  const [stage,setStage]=useState<RegistrationStage>('check');
  const [checking,setChecking]=useState(true),[qr,setQr]=useState(false),[qrTarget,setQrTarget]=useState(0),[backup,setBackup]=useState(false);
  const [balance,setBalance]=useState<number>(),[copied,setCopied]=useState(false);
  const readyCallback=useRef(onReady);readyCallback.current=onReady;
  const mounted=useRef(true),running=useRef(false),autoRegister=useRef(()=>{});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{
    let cancelled=false;const abort=new AbortController();setChecking(true);
    void fetch('/deployment.json',{signal:AbortSignal.any([abort.signal,AbortSignal.timeout(5000)]),cache:'no-store'}).then(async r=>{
      if(!r.ok)return;const next:Deployment=await r.json();
      if(!cancelled&&next.programId===deployment.programId&&next.admin===deployment.admin&&(next.venue?.config??'root')===market&&next.assets?.some(a=>a.mint===token.mint&&a.collateral))readyCallback.current(next);
    }).catch(()=>{}).finally(()=>{if(!cancelled)setChecking(false);});
    void connection.getBalance(instant.publicKey,'confirmed').then(value=>{if(!cancelled)setBalance(value);}).catch(()=>{});
    return()=>{cancelled=true;abort.abort();};
  },[deployment.programId,deployment.admin,market,token.mint,connection,instant]);
  useEffect(()=>{
    if(!qr)return;let stopped=false,reading=false;
    const read=async()=>{if(reading||document.hidden)return;reading=true;
      try{assertActiveWallet(localStorage,deployment,instantAddress);const value=await connection.getBalance(instant.publicKey,'confirmed');
        if(!stopped){setBalance(value);if(value>=qrTarget){stopped=true;setQr(false);autoRegister.current();}}}
      catch(e){if(!stopped){stopped=true;setQr(false);setError(e instanceof Error?e.message:'Unable to check the QR payment');}}
      finally{reading=false;}
    };
    const timer=setInterval(()=>void read(),5000);return()=>{stopped=true;clearInterval(timer);};
  },[qr,qrTarget,connection,instant,deployment,instantAddress]);
  async function json(url:string,data?:unknown){const r=await fetch(url,{method:data===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:data===undefined?undefined:JSON.stringify(data),signal:AbortSignal.timeout(50000)});const value=await r.json();if(!r.ok)throw Error(value.error??'Registration unavailable');return value;}
  function assertWallet(method:Method){
    if(!mounted.current)throw Error('Registration window closed');
    assertActiveWallet(localStorage,deployment,instantAddress);
    if((method==='browser'||!wallet)&&(!connected||activeBrowser.current!==connected||browser.wallet?.adapter.publicKey?.toBase58()!==connected))throw Error('Browser wallet changed; registration was not submitted');
  }
  async function prepare(method:Method,checkOnly=false){
    assertWallet(method);const feeFromPayment=method==='instant',owner=feeFromPayment?instantAddress:connected,holder=wallet?.publicKey.toBase58()??connected,expires=Date.now()+120000;
    const signBrowser=async(message:Uint8Array)=>{if(!browser.signMessage)throw Error('Choose a browser wallet that supports message signing');return browser.signMessage(message);};
    const message=Buffer.from(registrationConsent(deployment.programId,owner,token.mint,expires,feeFromPayment,market));
    const proof=feeFromPayment?ed25519.sign(message,instant.secretKey.slice(0,32)):await signBrowser(message);assertWallet(method);
    let holdingSignature:string|undefined;
    if(holder!==owner){const consent=Buffer.from(registrationHoldingConsent(deployment.programId,owner,holder,token.mint,expires,market));holdingSignature=Buffer.from(wallet?ed25519.sign(consent,wallet.secretKey.slice(0,32)):await signBrowser(consent)).toString('base64');assertWallet(method);}
    return json('/api/registration/prepare',{owner,mint:token.mint,expires,signature:Buffer.from(proof).toString('base64'),feeFromPayment,checkOnly,market,...(holdingSignature?{holdingOwner:holder,holdingSignature}:{})});
  }
  async function finish(job:any){
    let readySince:number|undefined;
    while(mounted.current){
      if(job.signature)setSignature(job.signature);
      if(job.status==='failed')throw Error(job.error??'Registration failed; try again');
      if(registrationSteps.some(step=>step.stage===job.progress))setStage(job.progress);
      if(job.status==='ready'){
        setStage('live');
        const next:Deployment=await json('/deployment.json');
        if(next.programId!==deployment.programId||next.admin!==deployment.admin||(next.venue?.config??'root')!==market)throw Error('Deployment identity changed');
        if(next.assets.some(a=>a.mint===token.mint&&a.collateral)){readyCallback.current(next);return;}
        readySince??=Date.now();
        if(Date.now()-readySince>120000)throw Error('Registration is paid, but this market is still synchronizing. Close this window and refresh shortly; do not pay again.');
        setStatus('Registered · enabling live trading…');
      }else setStatus(job.progress?'':'Finishing token setup… You will not be charged again.');
      await new Promise(r=>setTimeout(r,3000));if(mounted.current)job=await json('/api/registration/status?id='+encodeURIComponent(job.id));
    }
  }
  async function register(method:Method){
    if((method==='browser'||!wallet)&&!connected){setVisible(true);return;}
    if(running.current)return;running.current=true;setBusy(true);setQr(false);setError('');
    try{
      const owner=method==='instant'?instantAddress:connected;setStage('check');setStatus('Checking token and preparing registration…');
      let job=await prepare(method);if(!mounted.current)return;
      if(job.status==='prepared'){
        const tx=VersionedTransaction.deserialize(Buffer.from(job.transaction,'base64'));
        const tables=await Promise.all(tx.message.addressTableLookups.map(async t=>{const table=(await connection.getAddressLookupTable(t.accountKey)).value;if(!table)throw Error('Registration lookup unavailable');return table;}));
        validateRegistrationPayment(tx,deployment,new PublicKey(owner),tables,token.mint,method==='instant');assertWallet(method);
        const expected=VersionedTransaction.deserialize(tx.serialize());
        let signed:VersionedTransaction;
        if(method==='instant'){tx.sign([instant]);signed=tx;}
        else {setStatus('Approve 0.05 SOL plus the network fee in your browser wallet…');signed=await signBlinkWalletTransaction(browser,owner,tx,deployment.cluster==='mainnet-beta'?'mainnet-beta':'devnet');}
        assertWallet(method);validateWalletApproval(expected,signed,new PublicKey(owner),tables);
        setStage('payment');setStatus('Submitting your registration payment…');
        job=await json('/api/registration/submit',{id:job.id,transaction:Buffer.from(signed.serialize()).toString('base64')});
      }
      await finish(job);
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Registration unavailable');}
    finally{running.current=false;if(mounted.current){setBusy(false);void connection.getBalance(instant.publicKey,'confirmed').then(value=>{if(mounted.current)setBalance(value);}).catch(()=>{});}}
  }
  autoRegister.current=()=>void register('instant');
  async function showQr(){
    if(!hasWalletBackup(localStorage,deployment,instantAddress)){setBackup(true);return;}
    if(!wallet&&!connected){setVisible(true);return;}
    if(running.current)return;running.current=true;setBusy(true);setStage('check');setError('');setStatus('Checking this token before showing payment details…');
    try{
      const job=await prepare('instant',true);assertWallet('instant');
      if(job.status!=='eligible'){if(job.status==='prepared')throw Error('A payment is already prepared. Use Pay from Instant or wait a minute before showing a QR.');await finish(job);return;}
      const current=await connection.getBalance(instant.publicKey,'confirmed');assertWallet('instant');
      if(!Number.isSafeInteger(current)||current<0||!Number.isSafeInteger(current+TOKEN_REGISTRATION_LAMPORTS))throw Error('Wallet balance unavailable; please retry');
      setBalance(current);setQrTarget(current+TOKEN_REGISTRATION_LAMPORTS);setQr(true);setStatus('Waiting for 0.05 SOL. Keep this window open for automatic registration.');
    }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'QR payment unavailable');}
    finally{running.current=false;if(mounted.current)setBusy(false);}
  }
  const paymentUri=`solana:${instantAddress}?amount=0.05&label=SoltoshiDICE`;
  return <Modal title={`Register $${token.symbol}`} close={()=>{if(!busy)onClose();}}>
    <div className="registration-card registration-compact">
      {busy?<RegistrationProgress stage={stage} message={status}/>:<>
      <header className="registration-summary"><div className="registration-fee">0.05 <span>SOL</span></div><p>One registration fee.<br/><strong>USDC market</strong></p></header>
      <small>Setup costs come from this fee. The remainder funds platform operations. Bet backing still applies.</small>
      <div className="registration-methods">
        <button className="primary" disabled={busy||checking||qr} onClick={()=>void register('instant')}>Pay from Instant <small>{balance===undefined?'Checking SOL…':(balance/1e9).toFixed(4)+' SOL available'} · fee included</small></button>
        <button disabled={busy||checking||qr} onClick={()=>void register('browser')}>{connected?'Pay with browser wallet':'Connect browser wallet'}<small>0.05 SOL + network fee</small></button>
      </div>
      {backup?<WalletRecovery wallet={instant} deployment={deployment} busy={busy} backupReady={false} canRestore={()=>false} onBackupSaved={()=>{setBackup(false);void showQr();}}/>:
        !qr&&<button className="registration-qr-trigger" disabled={busy||checking} onClick={()=>void showQr()}>Pay by QR · send exactly 0.05 SOL <span>↗</span></button>}
      {qr&&<section className="registration-qr"><QRCodeSVG value={paymentUri} size={132} marginSize={2} level="M" title="Send exactly 0.05 SOL to your Instant wallet"/><div><strong>Send 0.05 SOL</strong><small>To your Instant wallet · {deployment.cluster==='mainnet-beta'?'Solana mainnet':'Devnet'}</small><code>{instantAddress}</code><div><button onClick={()=>void navigator.clipboard.writeText(instantAddress).then(()=>setCopied(true)).catch(()=>setError('Copy unavailable; use the address shown above'))}>{copied?'Copied':'Copy address'}</button><button onClick={()=>{setQr(false);setStatus('QR auto-registration stopped. Any SOL sent remains in your Instant wallet.');}}>Cancel QR</button></div></div></section>}
      {qr&&<small>Registration starts when the deposit arrives. Closing this window stops automatic registration; your SOL remains in your wallet.</small>}
      {status&&<p className="registration-progress" role="status">{status}</p>}
      </>}
      {signature&&<a href={`https://solscan.io/tx/${signature}`} target="_blank" rel="noreferrer">View registration ↗</a>}
      {error&&<p className="error" role="alert">{error}</p>}
      <code className="registration-mint">Token · {token.mint}</code>
    </div>
  </Modal>;
}
