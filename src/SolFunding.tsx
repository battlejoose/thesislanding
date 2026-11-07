import { useState } from "react";
import { Coin, Modal } from "./components.tsx";
import { OPEN_BASE_FEE, isBudgetError, isGasReserveError, solFundingExplanation } from "./funding.ts";
import { WalletDeposit, type DepositProps } from "./WalletDeposit.tsx";

export function SolFunding({
  owner,
  sol,
  ready,
  selfPay,
  close,
  deposit,
  proceed,
  sponsored,
  reason,
  reserveDeposit,
  platformTrading = false,
}: {
  owner: string;
  sol: number;
  ready: boolean;
  selfPay: boolean;
  close: () => void;
  deposit: DepositProps;
  proceed: () => void;
  sponsored: () => void;
  reason?: string;
  reserveDeposit?: DepositProps;
  platformTrading?: boolean;
}) {
  const [destination, setDestination] = useState<"local" | "reserve"> (
    reserveDeposit && (platformTrading || isGasReserveError(reason ?? "")) ? "reserve" : "local",
  );
  const reserve = destination === "reserve" && !!reserveDeposit;
  const busy = deposit.busy || !!reserveDeposit?.busy;
  return (
    <Modal title={platformTrading ? "Platform fee funding" : "Add SOL to continue"} close={close}>
      <div className="sol-funding">
        {reserveDeposit && (
          <div className="sol-funding-tabs" role="group" aria-label="SOL funding destination">
            <button
              aria-pressed={reserve}
              disabled={busy}
              onClick={() => setDestination("reserve")}
            >
              Platform reserve
            </button>
            <button
              aria-pressed={!reserve}
              disabled={busy}
              onClick={() => setDestination("local")}
            >
              {platformTrading ? "Wallet actions" : "Pay my own fees"}
            </button>
          </div>
        )}
        {!reserve && <div className="sol-funding-balance">
          <Coin symbol="SOL" />
          <div>
            <small>Your local wallet · {deposit.cluster === "mainnet-beta" ? "mainnet" : "devnet"}</small>
            <strong>
              {ready
                ? `${sol.toLocaleString("en-US", { maximumFractionDigits: 6 })} SOL`
                : "Loading balance…"}
            </strong>
          </div>
        </div>}
        <p>{platformTrading && !reserve
          ? "Local SOL can pay for wallet transfers and staking actions. Trading account setup and collateral deposits use platform sponsorship."
          : solFundingExplanation(reason, reserve ? "reserve" : "local", deposit.cluster)}</p>
        {platformTrading && isBudgetError(reason ?? "") && <p>The rolling sponsored allowance is used. Reserve contributions do not raise this allowance. Trading setup and deposits become available when it renews or verified fee income adds capacity.</p>}
        {!reserve && <p>This funds your wallet, not the platform’s gas reserve.</p>}
        <WalletDeposit
          key={reserve ? `reserve:${reserveDeposit.owner}` : `local:${owner}`}
          {...(reserve ? reserveDeposit : deposit)}
          nativeOnly
          destination={reserve ? "reserve" : "local"}
        />
        {reserve && <p>The fee wallet checks for funding every 30 seconds. Retry when reserve funding and the sponsored allowance are available.</p>}
        {!reserve && <button
          className="sol-funding-continue"
          disabled={busy || !ready || sol * 1e9 < OPEN_BASE_FEE}
          onClick={proceed}
        >
          {platformTrading ? "Use SOL for wallet actions" : "Continue with my SOL"}
        </button>}
        {(reserve || selfPay) && (
          <button
            className="sol-funding-sponsored"
            disabled={busy}
            onClick={sponsored}
          >
            Use sponsored fees
          </button>
        )}
      </div>
    </Modal>
  );
}
