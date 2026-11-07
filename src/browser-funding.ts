import {VersionedTransaction,type Connection} from '@solana/web3.js';
import {utils} from '@anchor-lang/core';
type Storage=Pick<globalThis.Storage,'getItem'|'setItem'|'removeItem'>;
type Pending={signature:string;wire:string;height:number};
/** Save approval before sending, so refreshing or losing the RPC response
 * cannot silently turn a retry into a second transfer. Contains no keys. */
export class BrowserFunding {
  private key:string;
  constructor(private storage:Storage,program:string,owner:string){this.key=`acidpump:browser-gas-funding:${program}:${owner}`;}
  pending():Pending|undefined {const text=this.storage.getItem(this.key);return text?JSON.parse(text):undefined;}
  stage(tx:VersionedTransaction,height:number) {
    if(this.pending())throw Error('Your previous gas funding is still confirming');
    const pending={signature:utils.bytes.bs58.encode(tx.signatures[0]),wire:Buffer.from(tx.serialize()).toString('base64'),height};
    this.storage.setItem(this.key,JSON.stringify(pending));return pending;
  }
  async reconcile(connection:Connection) {
    const p=this.pending();if(!p)return;
    const status=(await connection.getSignatureStatuses([p.signature],{searchTransactionHistory:true})).value[0];
    if(status?.confirmationStatus==='confirmed'||status?.confirmationStatus==='finalized'){
      this.storage.removeItem(this.key);return {signature:p.signature,failed:!!status.err};
    }
    if(!status&&await connection.getBlockHeight('finalized')>p.height) {
      const receipt=await connection.getTransaction(p.signature,{commitment:'finalized',maxSupportedTransactionVersion:0});
      const later=(await connection.getSignatureStatuses([p.signature],{searchTransactionHistory:true})).value[0];
      if(receipt?.meta||!later){this.storage.removeItem(this.key);return {signature:p.signature,failed:receipt?.meta?!!receipt.meta.err:true};}
    }
  }
}
