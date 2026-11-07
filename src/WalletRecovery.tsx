import {useEffect,useRef,useState} from 'react';
import {Keypair} from '@solana/web3.js';
import type {Deployment} from './client.ts';
import {assertActiveWallet,backupRequiresPassword,decryptWallet,exportWalletBackup,markBackupDownloaded,restoreLocalWallet} from './wallet-recovery.ts';
import './wallet-recovery.css';

export type WalletRecoveryProps={wallet:Keypair;deployment:Deployment;busy:boolean;backupReady:boolean;onBackupSaved:()=>void;canRestore:()=>boolean};
export function WalletRecovery({wallet,deployment,busy,backupReady,onBackupSaved,canRestore}:WalletRecoveryProps) {
  const [mode,setMode]=useState<'backup'|'restore'>('backup');
  const [protectedBackup,setProtectedBackup]=useState(false);
  const [password,setPassword]=useState(''),[repeat,setRepeat]=useState(''),[file,setFile]=useState<File|null>(null);
  const [backupText,setBackupText]=useState(''),[needsPassword,setNeedsPassword]=useState(false),[reading,setReading]=useState(false);
  const [working,setWorking]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const [recovered,setRecovered]=useState<Keypair|null>(null),running=useRef(false);
  const disabled=working||busy||reading;
  function reset(next:'backup'|'restore') {setMode(next);setProtectedBackup(false);setPassword('');setRepeat('');setFile(null);setBackupText('');setRecovered(null);setMessage('');setError('');}
  useEffect(()=>{
    let cancelled=false;
    setBackupText('');setNeedsPassword(false);setPassword('');setRecovered(null);setError('');
    if(!file){setReading(false);return;}
    if(file.size>4096){setReading(false);setError('Backup file is too large');return;}
    setReading(true);
    void file.text().then(text=>{
      const protectedFile=backupRequiresPassword(text);
      if(!cancelled){setBackupText(text);setNeedsPassword(protectedFile);}
    }).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:'Could not read backup');})
      .finally(()=>{if(!cancelled)setReading(false);});
    return()=>{cancelled=true;};
  },[file]);
  async function run(task:()=>Promise<void>) {
    if(disabled||running.current)return;running.current=true;setWorking(true);setError('');setMessage('');
    try{await task();}catch(e){setError(e instanceof Error?e.message:'Wallet backup failed');}finally{running.current=false;setWorking(false);}
  }
  async function download() {
    await run(async()=>{
      if(protectedBackup&&password!==repeat)throw Error('The passwords do not match');
      assertActiveWallet(localStorage,deployment,wallet.publicKey.toBase58());
      const text=await exportWalletBackup(wallet,deployment,protectedBackup?password:undefined);
      assertActiveWallet(localStorage,deployment,wallet.publicKey.toBase58());
      const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
      const link=document.createElement('a');link.href=url;link.download=`sdice-wallet-${wallet.publicKey.toBase58()}.json`;
      try{document.body.appendChild(link);link.click();}finally{link.remove();setTimeout(()=>URL.revokeObjectURL(url),30_000);}
      markBackupDownloaded(localStorage,deployment,wallet.publicKey.toBase58());
      setPassword('');setRepeat('');setMessage('Backup download started. Keep the file somewhere safe.');onBackupSaved();
    });
  }
  async function readBackup() {
    await run(async()=>{
      if(!backupText)throw Error('Choose your wallet backup file');
      const restored=await decryptWallet(backupText,deployment,needsPassword?password:'');
      setPassword('');setRecovered(restored);
    });
  }
  function restore() {
    if(!recovered||disabled)return;
    try {
      if(!canRestore())throw Error('Wait for your current transactions before switching wallets');
      restoreLocalWallet(localStorage,deployment,wallet.publicKey.toBase58(),recovered);
      window.location.reload();
    }catch(e){setError(e instanceof Error?e.message:'Wallet restore failed');}
  }
  return <div className="wallet-recovery">
    {mode==='backup'&&!backupReady&&<h2 className="wallet-backup-heading">DOWNLOAD YOUR WALLET BACKUP TO ENABLE DEPOSITS</h2>}
    <div className="wallet-recovery-tabs" role="group" aria-label="Wallet recovery">
      <button disabled={disabled} aria-pressed={mode==='backup'} onClick={()=>reset('backup')}>Back up</button>
      <button disabled={disabled} aria-pressed={mode==='restore'} onClick={()=>reset('restore')}>Restore</button>
    </div>
    <p>{mode==='backup'?'Download your wallet backup to recover it on another device or after clearing browser data.':'Choose your wallet backup. A password is only needed for a password-protected file.'}</p>
    {mode==='backup' ? <>
      {backupReady&&<p className="wallet-recovery-success">✓ Backup downloaded. Deposits are available.</p>}
      <label className="wallet-password-toggle"><input type="checkbox" checked={protectedBackup} disabled={disabled}
        onChange={e=>{setProtectedBackup(e.target.checked);setPassword('');setRepeat('');setError('');}}/>Protect with a password <small>Optional</small></label>
      {protectedBackup&&<>
        <label>Backup password<input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} disabled={disabled}/></label>
        <label>Repeat password<input type="password" autoComplete="new-password" value={repeat} onChange={e=>setRepeat(e.target.value)} disabled={disabled}/></label>
      </>}
      <small>{protectedBackup?'Encrypted on this device. Keep the file and password; we cannot reset your password.':'Anyone with this unprotected file can access your wallet. Keep it private.'}</small>
      <button className="primary" disabled={disabled||protectedBackup&&(!password||!repeat)} onClick={()=>void download()}>{working?'Preparing backup…':protectedBackup?'Download encrypted backup':'Download backup'}</button>
    </> : <>
      <label>Wallet backup file<input type="file" accept=".json,application/json" disabled={working||busy} onChange={e=>setFile(e.target.files?.[0]??null)}/></label>
      {!recovered&&<>
        {needsPassword&&<label>Backup password<input type="password" autoComplete="current-password" value={password} disabled={disabled} onChange={e=>setPassword(e.target.value)}/></label>}
        <button className="primary" disabled={disabled||!backupText||needsPassword&&!password} onClick={()=>void readBackup()}>{working||reading?'Reading backup…':'Read backup'}</button>
      </>}
    </>}
    <small>Your key and password stay on this device.</small>
    {recovered&&<div className="wallet-recovery-confirm">
      <strong>Switch to recovered wallet</strong><code>{recovered.publicKey.toBase58()}</code>
      <small>This changes the wallet on this device. No funds move. The current wallet is preserved in this browser; keep its backup too.</small>
      <button className="primary" disabled={disabled} onClick={restore}>Restore this wallet</button>
    </div>}
    {message&&<p role="status" className="wallet-recovery-success">{message}</p>}
    {error&&<p role="alert" className="wallet-recovery-error">{error}</p>}
  </div>;
}
