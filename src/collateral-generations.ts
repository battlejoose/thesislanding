import type { Row } from "./client.ts";

/** Old devnet accounts have no generation field. Never coerce malformed
 * counters into generation zero or compare counters from different lifetimes. */
export function collateralGeneration(value: unknown): bigint {
  if (value === undefined) return 0n;
  if (typeof value !== "bigint" && (typeof value !== "string" || !/^\d+$/.test(value)))
    throw Error("Invalid collateral generation");
  const n = BigInt(value);
  if (n < 0n || n > (1n << 64n) - 1n) throw Error("Invalid collateral generation");
  return n;
}

export function pendingCollateralCredits(base: Row | undefined, er: Row | undefined) {
  if (!base || collateralGeneration(base.generation) < collateralGeneration(er?.generation)) return 0n;
  const same = !!er && collateralGeneration(base.generation) === collateralGeneration(er.generation);
  const excess = (left: unknown, right: unknown) => {
    const delta = BigInt(String(left ?? 0)) - BigInt(String(right ?? 0));
    return delta > 0n ? delta : 0n;
  };
  return excess(base.depositedCredits, same ? er.creditedDeposits : 0)
    + excess(base.returnedCredits, same ? er.creditedReturns : 0);
}
