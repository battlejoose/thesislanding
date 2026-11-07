import { PublicKey } from '@solana/web3.js';
import { primaryAsset, type AssetInfo, type Deployment, type Row, type Snapshot } from './client.ts';
import { programAddresses } from './program-addresses.ts';
import { collateralGeneration } from './collateral-generations.ts';
import { withdrawalAcknowledged } from './trading-withdrawal.ts';

type ReturnBalance = { asset: AssetInfo; amount: bigint };
export type CollateralCapacityPlan = { kind: 'ready' | 'wait' } | { kind: 'return'; balance: ReturnBalance } | { kind: 'full'; slots: number };
const empty = PublicKey.default.toBase58();
const units = (value: unknown) => {
  if (value === undefined) throw Error('Token balance is still syncing');
  return collateralGeneration(value);
};

/** Only an entirely unreserved, acknowledged balance can release a record.
 * The primary-token record is pinned even when no backing is currently locked. */
export function collateralCapacityPlan(state: Snapshot, deployment: Deployment, owner: string, mint: string): CollateralCapacityPlan {
  if (deployment.cluster !== 'mainnet-beta') return { kind: 'ready' };
  if (state.programId !== deployment.programId) return { kind: 'wait' };
  const custody = state.custodies?.find(row => row.owner === owner);
  if (!custody) return { kind: 'ready' }; // A new account starts with empty records.
  if (!Array.isArray(custody.assets) || custody.generation === undefined) return { kind: 'wait' };
  const addresses = programAddresses(deployment.programId);
  const target = addresses.assetPda(new PublicKey(mint)).toBase58();
  const core = primaryAsset(deployment);
  if (!core) throw Error('Platform token configuration is unavailable');
  const pinned = addresses.assetPda(new PublicKey(core.mint)).toBase58();
  const trader = state.erTraders?.find(row => row.owner === owner);
  if (trader && collateralGeneration(custody.generation) < collateralGeneration(trader.custodyGeneration)) return { kind: 'wait' };
  if (custody.assets.some((row: Row) => row.asset === target || row.asset === empty || (row.asset !== pinned && units(row.available) === 0n)))
    return { kind: 'ready' };
  if (!trader || !Array.isArray(trader.assets) || !Array.isArray(trader.slots) ||
    collateralGeneration(custody.generation) !== collateralGeneration(trader.custodyGeneration)) return { kind: 'wait' };
  if (!trader.slots.some((slot: Row) => slot.state === 0))
    return trader.slots.some((slot: Row) => slot.state === 2) ? { kind: 'wait' } : { kind: 'full', slots: trader.slots.length };
  for (const row of custody.assets as Row[]) {
    if (row.asset === pinned || row.asset === target) continue;
    if (trader.slots.some((slot: Row) => slot.state !== 0 && slot.asset === row.asset)) continue;
    const held = trader.assets.find((r: Row) => r.asset === row.asset);
    if (!held || collateralGeneration(held.generation) !== collateralGeneration(row.generation)) continue;
    // Exact equal counters reject either bank lagging the other; a positive
    // custody balance can include reserved collateral that cannot be returned.
    if (units(row.depositedCredits) !== units(held.creditedDeposits) || units(row.returnedCredits) !== units(held.creditedReturns)) continue;
    const amount = units(row.available);
    if (amount <= 0n || units(held.available) !== amount) continue;
    const asset = deployment.assets.find(a => addresses.assetPda(new PublicKey(a.mint)).toBase58() === row.asset);
    if (asset) return { kind: 'return', balance: { asset, amount } };
  }
  return { kind: 'wait' };
}

/** Frees at most one record. The sole transfer goes to the owner's hosted
 * wallet through normal withdrawal settlement; it never closes a position.
 * Caller holds the normal wallet action lock throughout funding and opening. */
export async function ensureCollateralDepositRoom(deployment: Deployment, owner: string, mint: string, actions: {
  initial: Snapshot;
  read: () => Promise<Snapshot>;
  withdraw: (balance: ReturnBalance) => Promise<{ slot: number; nonce: bigint }>;
  onProgress?: () => void;
  assertActive?: () => void;
  now?: () => number;
  pause?: () => Promise<void>;
  timeoutMs?: number;
}) {
  if (deployment.cluster !== 'mainnet-beta') return;
  const now = actions.now ?? Date.now, deadline = now() + (actions.timeoutMs ?? 180_000);
  let state = actions.initial, baseFloor = state.contextSlot ?? 0, erFloor = state.erContextSlot ?? 0;
  let intent: { slot: number; nonce: bigint } | undefined;
  for (;;) {
    actions.assertActive?.();
    if (now() >= deadline) throw Error('Your token balance is still settling. No bet was placed. Please retry after settlement.');
    const fresh = (state.contextSlot ?? 0) >= baseFloor && (state.erContextSlot ?? 0) >= erFloor &&
      (state.snapshotAgeMs ?? Infinity) <= 15_000 && (state.erSnapshotAgeMs ?? Infinity) <= 5_000;
    baseFloor = Math.max(baseFloor, state.contextSlot ?? 0); erFloor = Math.max(erFloor, state.erContextSlot ?? 0);
    if (fresh) {
      const plan = collateralCapacityPlan(state, deployment, owner, mint);
      if (intent) {
        // A free record alone cannot acknowledge this signed intent. Check
        // its actual receipt and ER release before allowing the next deposit.
        if (withdrawalAcknowledged(state, owner, intent.slot, intent.nonce)) {
          if (plan.kind === 'ready') return;
          throw Error('Your wallet balance changed while preparing this token. No bet was placed. Please retry.');
        }
      } else if (plan.kind === 'ready') return;
      else if (plan.kind === 'full') throw Error(`All ${plan.slots} position slots are in use. Close a position before placing another bet.`);
      else if (plan.kind === 'return') {
        actions.onProgress?.(); actions.assertActive?.();
        // Deliberately no catch/retry. An ambiguous submission is not replaced
        // with another withdrawal, either for this token or a different one.
        intent = await actions.withdraw(plan.balance);
        if (!Number.isSafeInteger(intent.slot) || intent.slot < 0 || intent.nonce <= 0n)
          throw Error('Token return acknowledgement is unavailable. Please wait for settlement before retrying.');
      }
    }
    actions.onProgress?.();
    await (actions.pause?.() ?? new Promise<void>(resolve => setTimeout(resolve, 500)));
    state = await actions.read();
  }
}
