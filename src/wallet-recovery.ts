import { Keypair, PublicKey } from '@solana/web3.js';
import type { Deployment } from './client.ts';
import { localWalletStorageKey } from './browser-deployment.ts';

// Backups stay on this device. Encryption is optional and always runs locally.
const FORMAT = 'acidpump-wallet-backup';
const ITERATIONS = 600_000;
const LIMIT = 4096;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const decode = (value: unknown, size: number) => {
  if (typeof value !== 'string' || value.length > 256 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('Invalid backup encoding');
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0));
  if (bytes.length !== size || encode(bytes) !== value) throw Error('Invalid backup length');
  return bytes;
};
type Header = { format: string; version: number; cluster: string; program: string; address: string;
  cipher: string; kdf: string; iterations: number; salt: string; iv: string };
type PlainBackup = {format:string;version:2;cluster:string;program:string;address:string;cipher:'none';secretKey:string};
type Backup = (Header & {ciphertext:string}) | PlainBackup;
function parseBackup(text:string):Backup {
  if(text.length>LIMIT)throw Error('Backup file is too large');
  let h;
  try{h=JSON.parse(text);}catch{throw Error('Choose your wallet backup file');}
  if(!h||h.format!==FORMAT||!(h.version===2&&h.cipher==='none'||
    h.version===1&&h.cipher==='AES-256-GCM'&&h.kdf==='PBKDF2-SHA256'&&h.iterations===ITERATIONS))
    throw Error('Unsupported wallet backup format');
  return h;
}
export const backupRequiresPassword=(text:string)=>parseBackup(text).cipher!=='none';
const aad = (h: Header) => new TextEncoder().encode(JSON.stringify([h.format,h.version,h.cluster,h.program,h.address,h.cipher,h.kdf,h.iterations,h.salt,h.iv]));
async function encryptionKey(password: string, salt: Uint8Array<ArrayBuffer>) {
  if (!password.length) throw Error('Enter a backup password');
  if (!globalThis.crypto?.subtle) throw Error('Wallet backups require a secure HTTPS connection');
  const material = await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
  return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt,iterations:ITERATIONS},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function encryptWallet(wallet: Keypair, deployment: Deployment, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const header: Header = {format:FORMAT,version:1,cluster:deployment.cluster,program:deployment.programId,
    address:wallet.publicKey.toBase58(),cipher:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:ITERATIONS,salt:encode(salt),iv:encode(iv)};
  const key = await encryptionKey(password,salt);
  const secret = new Uint8Array(wallet.secretKey);
  try {
    const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:aad(header),tagLength:128},key,secret);
    return JSON.stringify({...header,ciphertext:encode(new Uint8Array(ciphertext))},null,2)+'\n';
  } finally { secret.fill(0); }
}
export async function exportWalletBackup(wallet:Keypair,deployment:Deployment,password?:string) {
  if(password!==undefined)return encryptWallet(wallet,deployment,password);
  const backup:PlainBackup={format:FORMAT,version:2,cluster:deployment.cluster,program:deployment.programId,
    address:wallet.publicKey.toBase58(),cipher:'none',secretKey:encode(wallet.secretKey)};
  return JSON.stringify(backup,null,2)+'\n';
}
export async function decryptWallet(text: string, deployment: Deployment, password=''): Promise<Keypair> {
  const h=parseBackup(text);
  if (h.cluster!==deployment.cluster || h.program!==deployment.programId) throw Error('This backup belongs to a different platform or network');
  let address: PublicKey;
  try { address = new PublicKey(h.address); } catch { throw Error('Invalid backup wallet address'); }
  let secret: Uint8Array;
  if('secretKey' in h&&h.cipher==='none')secret=decode(h.secretKey,64);
  else {
    const encrypted=h as Header & {ciphertext:string};
    const salt=decode(encrypted.salt,16),iv=decode(encrypted.iv,12),ciphertext=decode(encrypted.ciphertext,80);
    const key=await encryptionKey(password,salt);
    try { secret=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv,additionalData:aad(encrypted),tagLength:128},key,ciphertext)); }
    catch { throw Error('Incorrect passphrase or damaged backup'); }
  }
  try {
    // web3 keeps the provided array; retain an independent signer before wiping.
    const wallet=Keypair.fromSecretKey(new Uint8Array(secret));
    if (!wallet.publicKey.equals(address)) throw Error('Backup wallet address does not match');
    return wallet;
  } finally { secret.fill(0); }
}
type Store = Pick<Storage,'getItem'|'setItem'>;
function storedWallet(raw:string) {
  const bytes=JSON.parse(raw);
  if (!Array.isArray(bytes)||bytes.length!==64||bytes.some(v=>!Number.isInteger(v)||v<0||v>255)) throw Error('Stored wallet is damaged. Restore your wallet backup; do not clear browser data.');
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}
export function loadLocalWallet(store:Store,deployment:Deployment) {
  const name=localWalletStorageKey(deployment),saved=store.getItem(name);
  if (saved!==null) return storedWallet(saved);
  const wallet=Keypair.generate(),raw=JSON.stringify([...wallet.secretKey]);
  store.setItem(name,raw);
  if (store.getItem(name)!==raw) throw Error('Browser wallet storage is unavailable');
  return wallet;
}
export function assertActiveWallet(store:Store,deployment:Deployment,address:string) {
  const raw=store.getItem(localWalletStorageKey(deployment));
  if (raw===null||storedWallet(raw).publicKey.toBase58()!==address) throw Error('Your wallet changed in another tab. Reload before continuing.');
}
const proofKey=(d:Deployment,address:string)=>`${localWalletStorageKey(d)}:backup-verified:${address}`;
export const hasVerifiedBackup=(store:Store,d:Deployment,address:string)=>store.getItem(proofKey(d,address))==='1';
const downloadKey=(d:Deployment,address:string)=>`${localWalletStorageKey(d)}:backup-downloaded:${address}`;
export const hasWalletBackup=(store:Store,d:Deployment,address:string)=>hasVerifiedBackup(store,d,address)||store.getItem(downloadKey(d,address))==='1';
/** Called only after the download is initiated; old verified backups still count. */
export function markBackupDownloaded(store:Store,d:Deployment,address:string) {
  assertActiveWallet(store,d,address);
  const key=downloadKey(d,address);store.setItem(key,'1');
  if(store.getItem(key)!=='1')throw Error('Could not save backup status. Keep the downloaded file and try again.');
}
export function markBackupVerified(store:Store,d:Deployment,address:string,recovered:Keypair) {
  assertActiveWallet(store,d,address);
  if (recovered.publicKey.toBase58()!==address) throw Error('Choose the backup for your current wallet');
  store.setItem(proofKey(d,address),'1');
}
/** Preserve the current wallet before switching. Any storage failure leaves the
 * old active wallet intact. A verified backup file remains the recovery source. */
export function restoreLocalWallet(store:Store,d:Deployment,currentAddress:string,recovered:Keypair) {
  assertActiveWallet(store,d,currentAddress);
  const name=localWalletStorageKey(d),old=store.getItem(name)!;
  const archive=`${name}:previous:${currentAddress}`;
  store.setItem(archive,old);
  if (store.getItem(archive)!==old) throw Error('Could not preserve the current wallet; nothing changed');
  store.setItem(proofKey(d,recovered.publicKey.toBase58()),'1');
  store.setItem(name,JSON.stringify([...recovered.secretKey]));
}
