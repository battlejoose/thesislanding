export const TEST_SOL_LOW = 3_000_000;
export const TEST_SOL_TARGET = 20_000_000;
// The current open transaction has one signature and no priority fee.
// Submission also checks the actual RPC fee for the compiled message.
export const OPEN_BASE_FEE = 5_000;
export const SELF_PAY_STORAGE_KEY = "acidpump-er:own-sol-day";
export const selfPayKey = (owner: string, now: number) =>
  `${owner}:${new Date(now).toISOString().slice(0, 10)}`;
export const isBudgetError = (message: string) =>
  /(?:daily )?sponsored transaction budget reached/i.test(message);
export const isGasReserveError = (message: string) =>
  /gas reserve needs replenishing/i.test(message);
export const isSolFundingError = (message: string) =>
  !isBudgetError(message) &&
  (isGasReserveError(message) || /not enough (?:devnet )?SOL/i.test(message));

export function solFundingExplanation(
  reason = "",
  destination: "local" | "reserve" = "local",
  cluster = "devnet",
) {
  const token = cluster === "mainnet-beta" ? "SOL" : "devnet SOL";
  if (isBudgetError(reason))
    return "The rolling 24-hour sponsored allowance has been used. It is 0.5 SOL plus verified SOL fee income from losses. Wait for earlier spending to leave the window or new verified fee income. Adding SOL to a wallet or reserve does not raise the allowance.";
  if (destination === "reserve")
    return `Add ${token} to the shared platform reserve to fund transaction fees for everyone. This is a contribution, not a deposit to your spendable wallet balance. Sponsored spending limits still apply.`;
  if (isGasReserveError(reason))
    return `The platform’s fee-paying wallet is low on SOL. You can continue by adding ${token} to your local wallet and using it for your own transaction fees and account deposits.`;
  return `Add ${token} to your local wallet to pay your own transaction fees and account deposits. You can switch back to sponsored fees when sponsorship is available.`;
}
export function solDepositLamports(amount: string) {
  if (!/^\d+(?:\.\d{1,9})?$/.test(amount))
    throw Error("Enter a SOL amount with up to 9 decimals");
  const [whole, fraction = ""] = amount.split(".");
  const lamports =
    BigInt(whole) * 1_000_000_000n + BigInt(fraction.padEnd(9, "0"));
  if (lamports <= 0n || lamports > BigInt(Number.MAX_SAFE_INTEGER))
    throw Error("Enter a valid SOL amount");
  return Number(lamports);
}

export function solRequiredMessage(required: number, balance: number, cluster = "devnet") {
  const sol = (n: number) => (n / 1e9).toFixed(9).replace(/\.?0+$/, "");
  if (cluster === "mainnet-beta") return `Not enough SOL: this transaction needs ${sol(required)} SOL for account deposits and fees; you have ${sol(balance)}. Add SOL to your wallet.`;
  return `Not enough devnet SOL: this transaction needs ${sol(required)} SOL for account deposits and fees; you have ${sol(balance)}. Get free devnet SOL in your wallet.`;
}

export function transactionError(e: unknown, cluster = "devnet"): string {
  const message = e instanceof Error ? e.message : String(e);
  if (isBudgetError(message))
    return message.replace(/\s*Add SOL to continue\.?/i, "").split(" Wait for")[0] + " Wait for the rolling allowance to renew or verified fee income to add capacity. Adding SOL does not raise this allowance.";
  const logs = (e as { logs?: unknown } | null)?.logs;
  const detail = message + "\n" + (Array.isArray(logs) ? logs.join("\n") : "");
  // 0x1 alone can also mean insufficient SPL tokens. Only identify SOL when
  // the System Program or RPC actually reports missing lamports/fee funds.
  const missing = detail.match(
    /(?:Transfer: )?insufficient lamports (\d+), need (\d+)/i,
  );
  if (missing) {
    if (cluster === "mainnet-beta") return "Not enough SOL for the account deposit. Add SOL to your wallet, then try again.";
    return "Not enough devnet SOL for the position account deposit. Get free devnet SOL in your wallet, then try again.";
  }
  if (
    /insufficient funds for (?:fee|rent)|insufficient lamports|no record of a prior credit/i.test(
      detail,
    )
  ) {
    if (cluster === "mainnet-beta") return "Not enough SOL for account deposits and fees. Add SOL to your wallet, then try again.";
    return "Not enough devnet SOL for account deposits and fees. Get free devnet SOL in your wallet, then try again.";
  }
  const anchor = detail.match(/Error Message: ([^\n]+)/)?.[1]?.trim();
  if (anchor) return anchor;
  if (/Simulation failed|Transaction simulation failed/i.test(message)) {
    return "The transaction could not be simulated. Nothing was submitted. Please try again; full diagnostics are in the browser console.";
  }
  return message.slice(0, 300);
}

// Errors are not JSON-serializable by default, and browser log collectors often
// reduce console object arguments to "Object". Keep a bounded plain-text record.
export function transactionDiagnostics(e: unknown) {
  const data = e as {
    logs?: unknown;
    signature?: unknown;
    simulationError?: unknown;
    notSubmitted?: unknown;
    confirmedFailed?: unknown;
    failedSignature?: unknown;
    rpcMessage?: unknown;
    retryablePrice?: unknown;
    priceWaitExpired?: unknown;
  } | null;
  const scrub = (v: unknown) =>
    String(v)
      .replace(/(?:https?|wss?):\/\/\S+/g, "[RPC]")
      .slice(0, 2000);
  const simulationError = () => {
    if (data?.simulationError === undefined) return undefined;
    try {
      const encoded = scrub(JSON.stringify(data.simulationError));
      // Preserve ordinary InstructionError objects; oversized/malformed payloads
      // remain bounded text rather than leaking arbitrary RPC response fields.
      try { return JSON.parse(encoded); } catch { return encoded; }
    } catch { return "Unserializable simulation error"; }
  };
  return {
    message: scrub(e instanceof Error ? e.message : e),
    rpcMessage: typeof data?.rpcMessage === "string" ? scrub(data.rpcMessage) : undefined,
    signature: typeof data?.signature === "string" ? scrub(data.signature).slice(0, 128) : undefined,
    simulationError: simulationError(),
    notSubmitted: data?.notSubmitted === true || undefined,
    confirmedFailed: data?.confirmedFailed === true || undefined,
    failedSignature: typeof data?.failedSignature === "string" ? scrub(data.failedSignature).slice(0,128) : undefined,
    retryablePrice: (data?.notSubmitted === true || data?.confirmedFailed === true) && data?.retryablePrice === true || undefined,
    priceWaitExpired: data?.notSubmitted === true && data?.priceWaitExpired === true || undefined,
    logs: Array.isArray(data?.logs) ? data.logs.slice(-40).map(scrub) : [],
  };
}

/** Restore only bounded public diagnostic fields from a sponsored API error. */
export function transactionResponseError(response: unknown) {
  const body = response && typeof response === "object"
    ? response as { error?: unknown; diagnostics?: unknown } : {};
  const detail = body.diagnostics && typeof body.diagnostics === "object"
    ? body.diagnostics as { message?: unknown; rpcMessage?: unknown; logs?: unknown; signature?: unknown; failedSignature?: unknown; confirmedFailed?: unknown; simulationError?: unknown; notSubmitted?: unknown; retryablePrice?: unknown; priceWaitExpired?: unknown } : {};
  const diagnostics = transactionDiagnostics(Object.assign(
    Error(typeof body.error === "string" ? body.error : "Trading request failed"),
    { logs: detail.logs, signature: detail.signature, simulationError: detail.simulationError,
      notSubmitted: detail.notSubmitted, confirmedFailed:detail.confirmedFailed, failedSignature:detail.failedSignature,
      rpcMessage:detail.rpcMessage ?? detail.message, retryablePrice: detail.retryablePrice, priceWaitExpired: detail.priceWaitExpired },
  ));
  return Object.assign(Error(diagnostics.message), {
    logs: diagnostics.logs, signature: diagnostics.signature, simulationError: diagnostics.simulationError,
    rpcMessage:diagnostics.rpcMessage, confirmedFailed:diagnostics.confirmedFailed, failedSignature:diagnostics.failedSignature,
    notSubmitted: diagnostics.notSubmitted, retryablePrice: diagnostics.retryablePrice, priceWaitExpired: diagnostics.priceWaitExpired,
  });
}

export function failedTransaction(
  err: unknown,
  logs: string[] | null = null,
  signature?: string,
) {
  return Object.assign(
    new Error("Transaction failed: " + JSON.stringify(err)),
    {
      logs: logs ?? [],
      signature,
    },
  );
}
