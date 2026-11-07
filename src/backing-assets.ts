import { NATIVE_MINT } from '@solana/spl-token';
import type { Deployment } from './client.ts';

/** Preserve the live reserve layout: primary plus SOL and USDC, deduplicated.
 * In a USDC pool the second auxiliary slot must remain empty. */
export function auxiliaryBackingMints(deployment: Deployment): readonly [string, string] {
  return [NATIVE_MINT.toBase58(),deployment.quoteMint];
}
