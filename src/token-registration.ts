import {ComputeBudgetProgram,PublicKey,SystemProgram,TransactionMessage,VersionedTransaction,type AddressLookupTableAccount} from '@solana/web3.js';
import type {Deployment} from './client.ts';
import {sha256} from '@noble/hashes/sha256';

export const TOKEN_REGISTRATION_LAMPORTS=50_000_000;
export const REGISTRATION_UNITS=500_000;
export const registrationDiscriminators=['create_feed','register_asset','create_inventory','er_initialize_quote','er_initialize_collateral_history','er_delegate_quote','er_delegate_collateral_history']
  .map(name=>Buffer.from(sha256(Buffer.from('global:'+name))).subarray(0,8));
export function registrationConsent(program:string,owner:string,mint:string,expires:number,feeFromPayment=false,market?:string) {
  const legacy=`acidpump:register-token:${feeFromPayment?'v2-fee-included':'v1'}\n${program}\n${owner}\n${mint}\n${TOKEN_REGISTRATION_LAMPORTS}\n${expires}`;
  return market===undefined?legacy:`${legacy}\nmarket:${market}`;
}
export function registrationHoldingConsent(program:string,payer:string,holder:string,mint:string,expires:number,market?:string) {
  const legacy=`acidpump:register-token-holder:v1\n${program}\n${payer}\n${holder}\n${mint}\n${expires}`;
  return market===undefined?legacy:`${legacy}\nmarket:${market}`;
}
/** The browser never signs an arbitrary server-supplied debit. Only the fixed
 * SOL payment may reference the owner; provisioning requires the admin signer. */
export function validateRegistrationPayment(tx:VersionedTransaction,d:Deployment,owner:PublicKey,tables:AddressLookupTableAccount[],mint:string,feeFromPayment=false) {
  const message=TransactionMessage.decompile(tx.message,{addressLookupTableAccounts:tables});
  const admin=new PublicKey(d.admin);
  if(!message.payerKey.equals(feeFromPayment?admin:owner)||tx.message.header.numRequiredSignatures!==2||
    !tx.message.staticAccountKeys[1].equals(feeFromPayment?owner:admin))throw Error('Unexpected registration signers');
  let paid=0,heap=0,compute=0,provision=0;
  for(const ix of message.instructions) {
    if(ix.programId.equals(SystemProgram.programId)) {
      if(ix.data.length!==12||ix.data.readUInt32LE(0)!==2||ix.keys.length!==2||
        !ix.keys[0].pubkey.equals(owner)||!ix.keys[1].pubkey.equals(new PublicKey(d.admin))||
        ix.data.readBigUInt64LE(4)!==BigInt(TOKEN_REGISTRATION_LAMPORTS))throw Error('Registration fee changed; nothing was signed');
      paid++;
    } else if(ix.programId.equals(ComputeBudgetProgram.programId)) {
      if(ix.data.length===5&&ix.data[0]===1&&ix.data.readUInt32LE(1)===128*1024)heap++;
      else if(ix.data.length===5&&ix.data[0]===2&&ix.data.readUInt32LE(1)===REGISTRATION_UNITS)compute++;
      else throw Error('Unexpected registration network fee');
    } else {
      if(!ix.programId.equals(new PublicKey(d.programId))||ix.keys.some(k=>k.pubkey.equals(owner)))throw Error('Unexpected registration instruction');
      if(provision>=7||!ix.data.subarray(0,8).equals(registrationDiscriminators[provision]))throw Error('Unexpected registration operation');
      if(provision===1&&(ix.data.length!==73||!new PublicKey(ix.data.subarray(8,40)).equals(new PublicKey(mint))||ix.data[72]!==1))throw Error('Registration token changed; nothing was signed');
      provision++;
    }
  }
  if(paid!==1||heap!==1||compute!==1||provision!==7)throw Error('Incomplete token registration');
}
