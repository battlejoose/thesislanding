import {AddressLookupTableAccount,ComputeBudgetProgram,PublicKey,TransactionMessage,VersionedTransaction} from '@solana/web3.js';
import {ed25519} from '@noble/curves/ed25519';

const LIGHTHOUSE=new PublicKey('L2TExMFKdjpN9kozasaurPirfHy9P8sbXoAN1qA3S95');
export const MAX_WALLET_PRIORITY_LAMPORTS=1_000_000n;
const changed=(detail:string)=>Error(`Wallet approval changed ${detail}; nothing was submitted.`);

/** Compare resolved instructions, including their effective account privileges.
 * A signing fee payer may choose their own priority fee. When someone else
 * pays, additions stay capped. Read-only Lighthouse assertions are allowed.
 * It may never change a transfer, fee payer, required signer or program call.
 * The caller must retain a copy of expected before handing a tx to the wallet. */
export function validateWalletApproval(expected:VersionedTransaction,approved:VersionedTransaction,owner:PublicKey,
  tables:AddressLookupTableAccount[]=[],allowBlockhashChange=false) {
  const before=TransactionMessage.decompile(expected.message,{addressLookupTableAccounts:tables});
  const after=TransactionMessage.decompile(approved.message,{addressLookupTableAccounts:tables});
  if(!before.payerKey.equals(after.payerKey))throw changed('the fee payer');
  if(!allowBlockhashChange&&before.recentBlockhash!==after.recentBlockhash)throw changed('the blockhash');
  const keysBefore=expected.message.getAccountKeys({addressLookupTableAccounts:tables});
  const keysAfter=approved.message.getAccountKeys({addressLookupTableAccounts:tables});
  const extra=new Set([ComputeBudgetProgram.programId.toBase58(),LIGHTHOUSE.toBase58()]);
  let units:number|undefined,price=0n;
  const tags=new Set<number>();
  const core=after.instructions.filter(ix=>{
    if(ix.programId.equals(LIGHTHOUSE)) {
      const tag=ix.data[0],count=tag===4?2:tag===15?0:1;
      if(ix.data.length<3||tag<2||tag>15||ix.keys.length!==count)throw changed('a wallet assertion');
      for(const key of ix.keys)extra.add(key.pubkey.toBase58());
      return false;
    }
    if(!ix.programId.equals(ComputeBudgetProgram.programId))return true;
    const tag=ix.data[0];if(ix.keys.length||tags.has(tag))throw changed('the compute budget');tags.add(tag);
    if(tag===2&&ix.data.length===5) {units=ix.data.readUInt32LE(1);if(!units||units>1_400_000)throw changed('the compute limit');}
    else if(tag===3&&ix.data.length===9)price=ix.data.readBigUInt64LE(1);
    else if(tag===1&&ix.data.length===5) {const heap=ix.data.readUInt32LE(1);if(heap<32768||heap>262144||heap%1024)throw changed('the heap limit');}
    else if(tag===4&&ix.data.length===5) {const size=ix.data.readUInt32LE(1);if(!size||size>67108864)throw changed('the loaded data limit');}
    else throw changed('the compute budget');
    return false;
  });
  const original=before.instructions.filter(ix=>!ix.programId.equals(ComputeBudgetProgram.programId));
  if(!original.length||original.length!==core.length)throw changed('the instruction count');
  for(let i=0;i<original.length;i++) {
    const a=original[i],b=core[i];
    if(!a.programId.equals(b.programId)||!a.data.equals(b.data)||a.keys.length!==b.keys.length||
      a.keys.some((k,j)=>!k.pubkey.equals(b.keys[j].pubkey)||k.isSigner!==b.keys[j].isSigner||k.isWritable!==b.keys[j].isWritable))
      throw changed('the transaction instructions');
  }
  const oldKeys=Array.from({length:keysBefore.length},(_,i)=>keysBefore.get(i)!);
  const newKeys=Array.from({length:keysAfter.length},(_,i)=>keysAfter.get(i)!);
  for(let i=0;i<newKeys.length;i++) {
    const old=oldKeys.findIndex(k=>k.equals(newKeys[i]));
    if(old<0) {
      if(!extra.has(newKeys[i].toBase58())||approved.message.isAccountSigner(i)||approved.message.isAccountWritable(i))throw changed('account privileges');
    } else if(expected.message.isAccountSigner(old)!==approved.message.isAccountSigner(i)||
      expected.message.isAccountWritable(old)!==approved.message.isAccountWritable(i))throw changed('account privileges');
  }
  if(oldKeys.some(k=>!newKeys.some(n=>n.equals(k))))throw changed('the account list');
  // The unchanged payer must be the wallet whose signature is verified below.
  // Its approved network fee does not consume platform sponsorship funds.
  if(!before.payerKey.equals(owner)&&(BigInt(units??1_400_000)*price+999999n)/1000000n>MAX_WALLET_PRIORITY_LAMPORTS)
    throw Error('Platform-paid priority fee exceeds 0.001 SOL. Nothing was submitted.');
  const signer=approved.message.staticAccountKeys.slice(0,approved.message.header.numRequiredSignatures).findIndex(k=>k.equals(owner));
  if(signer<0||!ed25519.verify(approved.signatures[signer],approved.message.serialize(),owner.toBytes()))throw changed('the wallet signature');
  if(approved.serialize().length>1232)throw Error('Wallet approval exceeds the transaction size limit; nothing was submitted.');
  return approved;
}
