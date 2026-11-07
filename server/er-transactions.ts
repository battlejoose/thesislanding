// Browser request shape only. The signing service is hosted separately.
export type ErAction =
  | {kind:'releaseBrowserGas';owner:string}
  | {kind:'withdrawBrowserGas';owner:string}
  | { kind: "initializeTrading"; owner: string }
  | { kind: "depositCollateral"; owner: string; mint: string; amount: string }
  | { kind: "withdrawCollateral"; owner: string; mint: string; amount: string }
  | { kind: "open"; owner: string; mint: string; market: string; amount: string; leverage: number; long: boolean; limit?: string; value?: string }
  | { kind: "close"; owner: string; position: string }
  | { kind: "changeCoreStake"; owner: string; amount: string; unstake: boolean; mint?:string }
  | { kind: "waiveCollateralProfit"; owner: string; position: string };
