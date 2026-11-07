// Browser request shape only. The signing service is hosted separately.
export type SponsoredAction =
  | {
      kind: "open";
      owner: string;
      mint: string;
      market: string;
      amount: string;
      leverage: number;
      long: boolean;
      limit: string;
      value: string;
    }
  | { kind: "close"; owner: string; position: string }
  | {
      kind: "withdraw";
      owner: string;
      mint: string;
      amount: string;
      recipient: string;
    }
  | { kind: "stakeOwnership" | "claimOwnership"; owner: string; pool: string }
  | {kind:'contributePool';owner:string;pool:string;amount:string;nonce:string;minIssued:string}
  | {
      kind: "redeem";
      owner: string;
      position: string;
      mint: string;
      amount: string;
      maxDebit: string;
      expires: number;
      minOut?: string;
    };
