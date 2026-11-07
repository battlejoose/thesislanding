import { appFetch as fetch } from "./app-url.ts";
import { VersionedTransaction } from "@solana/web3.js";
import { pk, type Deployment } from "./client.ts";
import type { ErAction } from "../server/er-transactions.ts";
import { transactionResponseError } from "./funding.ts";
import { withPreparationPacing } from "./trading-funding.ts";

export type BlinkStage = (message: string) => void;
export async function blinkJson(url: string, data?: unknown) {
  const response = await fetch(url, data === undefined ? {cache:"no-store"} : {
    method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw transactionResponseError(result);
  return result;
}

/** Browser wallets sign only. The server verifies the exact owner-signed
 * message, co-signs sponsorship and routes it to the correct execution bank.
 * No fresh transaction is automatically created after signing/submission. */
export async function sendBlinkTransaction(request: ErAction, options: {
  deployment: Deployment;
  sign: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  assertOwner: () => void;
  stage: BlinkStage;
  json?: typeof blinkJson;
  pause?: (ms: number) => Promise<void>;
  now?: () => number;
}) {
  const json=options.json??blinkJson, now=options.now??Date.now;
  const pause=options.pause??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  options.assertOwner(); options.stage("Preparing your transaction…");
  const prepared = await withPreparationPacing(()=>json("/api/blink/prepare",request),()=>pause(1500));
  const layer = ["initializeTrading","depositCollateral"].includes(request.kind)?"base":"er";
  if(prepared.executionLayer!==layer || !Number.isFinite(prepared.expiresAt)) throw Error("Invalid transaction response");
  const transaction = VersionedTransaction.deserialize(Buffer.from(prepared.transaction,"base64"));
  const message=Buffer.from(transaction.message.serialize());
  const payer=layer==="base"?options.deployment.publisher:options.deployment.er?.payer??options.deployment.publisher;
  const signers=transaction.message.staticAccountKeys.slice(0,transaction.message.header.numRequiredSignatures);
  if(!transaction.message.staticAccountKeys[0].equals(pk(payer)) || !signers.some(key=>key.equals(pk(request.owner)))) throw Error("Unexpected fee payer or signing wallet");
  options.assertOwner(); options.stage("Approve in your browser wallet…");
  const signed = await options.sign(transaction);
  options.assertOwner();
  if(!message.equals(Buffer.from(signed.message.serialize()))) throw Error("Wallet changed the transaction; nothing was submitted");
  if(now()>=prepared.expiresAt) throw Error("Wallet approval expired. Nothing was submitted; please try again.");
  options.stage("Sending your approved transaction…");
  const payload={id:prepared.id,transaction:Buffer.from(signed.serialize()).toString("base64")};
  let submitted;
  try { submitted=await json("/api/sponsor/submit",payload); }
  catch(error) {
    // Fetch network failure may follow a successful send. Recover only the
    // same idempotent ticket; never prepare/sign a replacement operation.
    if(!(error instanceof TypeError)) throw error;
    await pause(500);
    try { submitted=await json("/api/sponsor/submit",payload); }
    catch { throw Error("Submission outcome is unknown. Refresh positions and balances before trying again; no replacement trade was sent."); }
  }
  if(submitted.executionLayer!==layer || typeof submitted.signature!=="string") throw Error("Unexpected submission response; check positions before retrying");
  options.stage(layer==="er"?"Confirming on the rollup…":"Confirming on Solana…");
  const deadline=now()+90_000;
  do {
    let status;
    try { status=await json(`/api/sponsor/status?signature=${encodeURIComponent(submitted.signature)}`); }
    catch { await pause(1000); continue; }
    if(status.status==="confirmed") return submitted.signature as string;
    if(status.status==="failed") throw Error("Transaction failed on chain. Refresh your positions before retrying.");
    await pause(1000);
  } while(now()<deadline);
  throw Error(`Confirmation is still pending. Check your positions before retrying. Transaction: ${submitted.signature}`);
}
