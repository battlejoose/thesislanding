import type { AssetInfo, Row } from "./client.ts";

export const SETTLEMENT_STEP_MS = 1_400;
export const SETTLEMENT_FINAL_HOLD_MS = 3_000;
export const SETTLEMENT_STORY_MS = SETTLEMENT_STEP_MS * 5 + SETTLEMENT_FINAL_HOLD_MS;

export type StoryAmount = {
  atoms: bigint | null;
  symbol: string;
  decimals: number;
  label?: string;
  signed?: boolean;
  usd?: boolean;
};
export type StoryStage = {
  id: string;
  title: string;
  caption: string;
  tone: "acid" | "ice" | "loss";
  amount?: StoryAmount;
  from?: StoryAmount;
  to?: StoryAmount;
  split?: StoryAmount[];
};

const atoms = (value: unknown): bigint | null => {
  const text = value?.toString();
  return text && /^\d+$/.test(text) ? BigInt(text) : null;
};
const usd = (value: bigint | null, signed = false): StoryAmount => ({
  atoms: value, symbol: "USDC", decimals: 6, usd: true, signed,
});

/** The persistent flow shows both branches at once, so queued profit must not
 * also appear as settled profit. These are USD claims, not wallet transfers. */
export function settlementClaimAmounts(position: Record<string, unknown>) {
  const profit = atoms(position.profit), remaining = atoms(position.remaining);
  return {
    profit,
    remaining,
    paid: profit !== null && remaining !== null && remaining <= profit ? profit - remaining : null,
  };
}

/** Exact confirmed automatic-USDC output, never the USD claim reduction (which
 * can include dust). Legacy payout routes without a verified asset stay unknown. */
export function settlementWalletPayout(position: Record<string, unknown>): bigint | null {
  const { paid } = settlementClaimAmounts(position);
  if (paid === 0n) return 0n;
  const received = atoms(position.walletPaidUsdc);
  return paid !== null && received !== null && received <= paid ? received : null;
}
export function settlementWalletTokenPayout(position:Record<string,unknown>):bigint|null {
  const {paid}=settlementClaimAmounts(position);
  return paid===0n?0n:paid===null?null:atoms(position.walletPaidBackingTokens);
}

/** A late confirmed loss receipt starts a complete animation, rather than
 * inserting amounts after the liquid has already finished moving. */
export function settlementAllocationKey(position: Record<string, any>): string {
  const receipt = position.settlementReceipt;
  return receipt ? [position.key, receipt.signature, receipt.acidReceived, receipt.poolTokens,
    receipt.stakerTokens, receipt.burnedTokens, position.coverageTokens ?? "0"].join(":") : "";
}

export function settlementReceiptPending(position: Record<string, any>): boolean {
  return (atoms(position.loss) ?? 0n) > 0n && !position.settlementReceipt && !position.settlementReceiptUnavailable;
}

/** Build the replay solely from the confirmed position and settlement events.
 * No current quote, contemporary fee percentage, or inferred swap rate enters it. */
export function settlementStory({ position: x, collateral, poolToken, pnl, ownership, ownershipSymbol = "aPUMP" }: {
  position: Row;
  collateral: AssetInfo;
  poolToken?: AssetInfo;
  pnl: bigint;
  ownership: string | bigint | null;
  ownershipSymbol?: string;
}): StoryStage[] {
  if (x.state === 0) return [];
  const token = (value: unknown, label?: string): StoryAmount => ({
    atoms: atoms(value), symbol: collateral.symbol, decimals: collateral.decimals, label,
  });
  const pool = (value: unknown, label?: string): StoryAmount => ({
    atoms: atoms(value), symbol: poolToken?.symbol ?? "pool token", decimals: poolToken?.decimals ?? 6, label,
  });
  const margin = atoms(x.margin), loss = atoms(x.loss), returned = atoms(x.returned);
  const { profit, remaining, paid } = settlementClaimAmounts(x);
  const receipt = x.settlementReceipt;
  const isLoss = loss !== null && loss > 0n;
  const coverage = atoms(x.coverageTokens) ?? 0n;
  const lossPool = atoms(receipt?.poolTokens ?? x.swappedOut);
  const receiptMissing = x.settlementReceiptUnavailable
    ? "Historical swap details unavailable"
    : "Confirmed close · swap receipt syncing";
  const common: StoryStage[] = [
    {
      id: "bet", title: "You placed", tone: "acid",
      amount: token(margin),
      to: { ...usd(atoms(x.entryValue)), label: "entry value" },
      caption: `${x.leverage}× leverage · original entry value`,
    },
    {
      id: "result", title: isLoss ? (x.state === 2 ? "Your position liquidated" : "You closed at a loss") : profit !== null && profit > 0n ? "You closed in profit" : "Your position closed",
      tone: isLoss ? "loss" : "ice",
      amount: usd(pnl, true),
      caption: isLoss ? "Realized loss · remaining tokens come back to you" : "Realized result · profit and returned tokens are separate",
    },
    {
      id: "returned", title: "Returned to your balance", tone: "ice", amount: token(returned),
      caption: returned === 0n ? "The full bet was lost · no collateral left to return" : "Your remaining tokens are available for another bet or withdrawal after settlement",
    },
  ];
  if (isLoss) return [...common,
    {
      id: "conversion", title: collateral.mint === poolToken?.mint ? "Your loss stays in the pool token" : "Your loss bought", tone: "acid",
      from: token(loss), to: pool(receipt?.acidReceived),
      caption: receipt ? (atoms(receipt.acidReceived) === 0n ? "Too small to swap · dust retained by the pool" : collateral.mint === poolToken?.mint ? "Actual tokens retained for allocation" : "Actual tokens received from settlement") : receiptMissing,
    },
    {
      id: "allocation", title: "Where those tokens went", tone: "acid",
      split: [
        pool(lossPool === null ? null : lossPool + coverage, "Payout pool"),
        pool(receipt?.stakerTokens, "Stakers"),
        pool(receipt?.burnedTokens, "Burned"),
      ],
      caption: receipt ? `Actual $${poolToken?.symbol ?? "pool token"} allocation` : receiptMissing,
    },
    {
      id: "ownership", title: "Your share of the platform", tone: "ice",
      amount: { atoms: atoms(ownership), symbol: ownershipSymbol, decimals: poolToken?.decimals ?? 6, signed: true },
      caption: ownership === null ? "Ownership receipt syncing" : "Ownership earned · stake it for revenue share",
    },
    ...(coverage > 0n ? [{ id: "backing", title: "From stake", tone: "acid" as const,
      amount: pool(coverage), to: usd(atoms(x.coverageUsd)),
      caption: "Staked core tokens covering depreciation of the lost tokens; added directly to the payout pool" }] : []),
  ];
  return [...common,
    {
      id: "payout", title: profit === 0n ? "No profit claim" : paid === 0n ? "Your profit is queued" : "Profit settled", tone: "ice",
      amount: usd(paid === 0n ? remaining : paid, paid !== 0n),
      // A reduced queue balance is USD settlement accounting, not proof of a
      // particular wallet transfer. Wallet effects use actual balance changes.
      caption: profit === 0n ? "Your original tokens returned to your balance" : paid === 0n ? `Your FIFO profit pays in $${poolToken?.symbol??'pool token'} at spot value, with no USDC swap` : "Confirmed USD claim settlement · check your wallet receipts",
    },
    {
      id: "queue", title: remaining === 0n ? "Payout complete" : "Still in the payout queue", tone: "ice",
      amount: usd(remaining),
      caption: remaining === 0n ? "No remaining profit claim" : "The remaining claim stays in FIFO · no action needed",
    },
    {
      id: "ownership", title: "Position settled", tone: "ice",
      amount: { atoms: 0n, symbol: ownershipSymbol, decimals: poolToken?.decimals ?? 6, signed: true },
      caption: "Ownership rewards are earned on losing positions",
    },
  ];
}

export function storyAmountText(amount: StoryAmount): string {
  if (amount.atoms === null) return "—";
  const negative = amount.atoms < 0n;
  const absolute = negative ? -amount.atoms : amount.atoms;
  const scale = 10n ** BigInt(amount.decimals);
  const hundredths = (absolute * 100n + scale / 2n) / scale;
  const whole = hundredths / 100n;
  const fraction = (hundredths % 100n).toString().padStart(2, "0");
  const significantFraction = amount.usd ? fraction : fraction.replace(/0+$/, "");
  const value = whole.toLocaleString("en-US") + (significantFraction ? `.${significantFraction}` : "");
  return `${negative ? "−" : amount.signed ? "+" : ""}${amount.usd ? "$" : ""}${value}`;
}
