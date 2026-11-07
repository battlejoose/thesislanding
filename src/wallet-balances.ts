import { pk, type AssetInfo, type Row } from "./client.ts";
import type { ProgramAddresses } from "./program-addresses.ts";
import { collateralGeneration } from "./collateral-generations.ts";

const nonnegative = (value: unknown): bigint => {
  if (typeof value !== "string" && typeof value !== "bigint")
    throw Error("Missing balance counter");
  const amount = BigInt(value);
  if (amount < 0n) throw Error("Invalid balance counter");
  return amount;
};
const excess = (left: bigint, right: bigint) => left > right ? left - right : 0n;

/** The custody account must come from the exact same base-bank read as the
 * wallet token accounts. Streaming ER credit may be newer than that bank, so
 * it cannot all be added to the older wallet balance yet. */
export function acknowledgedWalletTradingBalances(
  trader: Row | undefined,
  walletBankCustody: Row | undefined,
  assets: AssetInfo[],
  addresses: Pick<ProgramAddresses, "assetPda">,
): Record<string, bigint> {
  const balances = Object.fromEntries(assets.map((asset) => [asset.mint, 0n]));
  if (!trader || !walletBankCustody || typeof trader.owner !== "string" ||
      !trader.owner || trader.owner !== walletBankCustody.owner) return balances;
  try {
    const nextNonce = nonnegative(trader.nextNonce);
    if (nextNonce === 0n || !Array.isArray(walletBankCustody.receipts)) return balances;
    // If the base wallet already contains a withdrawal whose ER intent isn't
    // even reflected by this snapshot, no ER credit is safe to add. Custody's
    // total also contains locked margin, so a per-asset total cap alone cannot
    // prevent counting that returned money a second time.
    if (walletBankCustody.receipts.some((receipt: Row) =>
      receipt.settled === true && receipt.kind === 2 &&
      nonnegative(receipt.nonce) >= nextNonce)) return balances;
  } catch {
    return balances;
  }
  for (const asset of assets) {
    try {
      const key = addresses.assetPda(pk(asset.mint)).toBase58();
      const er = trader.assets?.find((row: Row) => row.asset === key);
      const base = walletBankCustody.assets?.find((row: Row) => row.asset === key);
      if (!er || !base) continue;
      if (collateralGeneration(er.generation) !== collateralGeneration(base.generation)) continue;
      const unseenDeposits = excess(nonnegative(er.creditedDeposits), nonnegative(base.depositedCredits));
      const unseenReturns = excess(nonnegative(er.creditedReturns), nonnegative(base.returnedCredits));
      const available = excess(nonnegative(er.available), unseenDeposits + unseenReturns);
      const custody = nonnegative(base.available);
      balances[asset.mint] = available < custody ? available : custody;
    } catch {
      // Incomplete/malformed data cannot create a spendable balance.
    }
  }
  return balances;
}

/** Only pass acknowledged, available trading credit here. Open-position margin,
 * pending deposits/returns and withdrawal intents are not spendable balances. */
export function availableWalletBalances(
  wallet: Readonly<Record<string, bigint>>,
  trading: Readonly<Record<string, bigint>> = {},
): Record<string, bigint> {
  return Object.fromEntries(
    [...new Set([...Object.keys(wallet), ...Object.keys(trading)])].map((mint) => [
      mint,
      (wallet[mint] ?? 0n) + (trading[mint] ?? 0n),
    ]),
  );
}
