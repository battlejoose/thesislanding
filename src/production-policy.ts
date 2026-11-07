import policy from './production-policy.json';

/** Shared build input: Rust, launch tooling and the client read the same policy.
 * A production manifest must select it explicitly; old test defaults cannot pass. */
export const PRODUCTION_POLICY = Object.freeze(policy);
export type ProductionPolicy = typeof PRODUCTION_POLICY;
export function validateProductionPolicy(value: unknown): asserts value is ProductionPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Explicit production-v1 risk policy required');
  const input = value as Record<string, unknown>;
  if (Object.keys(input).length !== Object.keys(policy).length ||
      Object.entries(policy).some(([key, expected]) => input[key] !== expected))
    throw Error('Production risk policy differs from production-v1; test limits and private admission are not permitted');
}
