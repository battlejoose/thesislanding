/** A signature is supplied only after its transaction has confirmed. */
export type RewardConfirmation = {
  id: string;
  kind: "stake" | "claim";
  before: bigint;
};

/** The chain counter may reach the UI before or after the signature does. */
export function rewardConfirmationDelta(
  confirmation: RewardConfirmation | null | undefined,
  staked: bigint,
  claimed: bigint,
): bigint | null {
  if (!confirmation?.id || confirmation.before < 0n) return null;
  const current = confirmation.kind === "stake" ? staked : claimed;
  return current > confirmation.before ? current - confirmation.before : null;
}
