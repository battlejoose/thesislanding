import {PublicKey,SystemProgram,TransactionInstruction,TransactionMessage,VersionedTransaction} from '@solana/web3.js';
import {programAddresses} from './program-addresses.ts';

export type TradingWalletMode='instant'|'browser';
export const INSTANT_ACTIVATION_LAMPORTS=50_000_000;
export const WALLET_PAYMENT_MEMO=new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
export const activationMemo=(program:string,beneficiary:string)=>`acidpump:instant-activation:v1:${program}:${beneficiary}:${INSTANT_ACTIVATION_LAMPORTS}`;
export const browserGasConsent=(program:string,owner:string,reserve:string,expires:number)=>
  `acidpump:browser-gas:v1\n${program}\n${owner}\n${reserve}\n${expires}`;
export function browserGasRefundTransaction(program:string,owner:PublicKey,reserve:PublicKey,amount:number,blockhash:string) {
  if(!Number.isSafeInteger(amount)||amount<=0)throw Error('Invalid gas refund');
  return new VersionedTransaction(new TransactionMessage({payerKey:owner,recentBlockhash:blockhash,instructions:[
    SystemProgram.transfer({fromPubkey:reserve,toPubkey:owner,lamports:amount}),
    new TransactionInstruction({programId:WALLET_PAYMENT_MEMO,keys:[{pubkey:owner,isSigner:true,isWritable:false}],
      data:Buffer.from(`acidpump:gas-refund:v1:${program}:${owner.toBase58()}:${amount}`)}),
  ]}).compileToV0Message());
}

/** Browser wallet is the payer. This payment never gives the site authority
 * over that wallet's tokens. The beneficiary is the separate Instant wallet. */
export function instantActivationTransaction(program:string,payer:PublicKey,beneficiary:PublicKey,blockhash:string) {
  if(!PublicKey.isOnCurve(payer.toBytes())||!PublicKey.isOnCurve(beneficiary.toBytes()))throw Error('Invalid activation wallet');
  return new VersionedTransaction(new TransactionMessage({payerKey:payer,recentBlockhash:blockhash,instructions:[
    SystemProgram.transfer({fromPubkey:payer,toPubkey:programAddresses(program).gasReservePda(),lamports:INSTANT_ACTIVATION_LAMPORTS}),
    new TransactionInstruction({programId:WALLET_PAYMENT_MEMO,keys:[],data:Buffer.from(activationMemo(program,beneficiary.toBase58()))}),
  ]}).compileToV0Message());
}
