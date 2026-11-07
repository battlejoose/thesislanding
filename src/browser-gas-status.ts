export type BrowserGasStatus = {
  owner:string;address:string;registered:boolean;balanceLamports:number;
  availableLamports:number;reservedLamports:number;spentLamports:number;
  pending:boolean;pendingSignature?:string;positionReserveLamports:number;
};

/** Use unreserved SOL, not the total balance already backing other positions. */
export function browserGasReady(gas:BrowserGasStatus|undefined,owner:string) {
  return !!gas && gas.owner===owner && gas.registered===true && gas.pending===false &&
    Number.isSafeInteger(gas.positionReserveLamports) && gas.positionReserveLamports>0 &&
    Number.isSafeInteger(gas.availableLamports) && gas.availableLamports>=gas.positionReserveLamports;
}

/** The server remains authoritative if the reserve changed since its last poll.
 * Do not turn platform sponsorship, price or submitted-transaction failures
 * into a request to fund the user's browser reserve. */
export function browserGasRequiredError(error:unknown) {
  if ((error as {signature?:unknown}|null)?.signature) return false;
  const message=error instanceof Error?error.message:String(error);
  return /^(?:Approve (?:and fund )?your browser gas reserve first|Add SOL to your browser gas reserve\.|Add SOL to your prepaid gas reserve before opening another position)/.test(message);
}
