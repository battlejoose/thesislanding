import React from "react";
import {
  progressLabels,
  type TransactionStage,
} from "./transaction-progress.ts";

export function TransactionProgress({
  stage,
  label,
  compact = false,
}: {
  stage?: TransactionStage;
  label: string;
  compact?: boolean;
}) {
  if (!stage) return null;
  return (
    <span
      className="transaction-progress"
      role="status"
      aria-live="polite"
      aria-label={`${label}: ${progressLabels[stage]}`}
    >
      <span className="spinner" aria-hidden="true" />
      <span>
        <b>{label}</b>
        <span>
          {compact
            ? {
                preparing: "Preparing",
                "preparing-collateral": "Preparing token balance",
                "waiting-prices": "Waiting for prices · 3s max",
                signing: "Signing locally",
                sending: "Sending",
                confirming: "Confirming",
                updating: "Updating",
                "er-confirming": "Rollup confirmation",
                "syncing-collateral": "Syncing collateral",
                "checking-collateral": "Checking collateral low",
                "recovering-collateral": "Recovering token history",
                committing: "Committing close",
                "awaiting-base": "Solana commit",
                "settlement-queue": "Settlement queue",
                "preparing-settlement": "Preparing swaps",
                "settling-base": "Settling tokens",
                crediting: "Returning funds",
                "settlement-retry": "Settlement retry",
              }[stage]
            : progressLabels[stage]}
        </span>
      </span>
    </span>
  );
}
