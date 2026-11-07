import { PublicKey } from "@solana/web3.js";

export const DEVNET_PROGRAM_ID = "8TwyqkVNZTHzBF6JC3k91KvWac6862K81TAzfiuiSfxc";
export const MAINNET_TEST_PROGRAM_ID = "8Uh8KYcEPdEMSiavjRgEFew3Q5keoozZdA6AoX6az6qc";

/** Each client owns its derivation namespace. Creating a second deployment
 * never changes the addresses used by the first one.
 *
 * A created venue ("market") is namespaced by its own config account
 * `[b"config", primaryMint]`. Its config-scoped PDAs insert that config key
 * after the prefix; the root venue inserts nothing, so its addresses are the
 * original ones. Feeds, assets, collateral quotes/histories, the gas reserve
 * and the ER fee payer are shared by every venue. */
export function programAddresses(programId: string | PublicKey, venueConfig?: string | PublicKey) {
  const program = new PublicKey(programId);
  const pda = (...seeds: (string | Uint8Array)[]) =>
    PublicKey.findProgramAddressSync(seeds.map(s => Buffer.from(s)), program)[0];
  const u16 = (value: number) => { const bytes = Buffer.alloc(2); bytes.writeUInt16LE(value); return bytes; };
  const rootConfig = pda("config");
  const config = venueConfig ? new PublicKey(venueConfig) : rootConfig;
  const root = config.equals(rootConfig);
  const ns: Uint8Array[] = root ? [] : [config.toBytes()];
  const scoped = (prefix: string, ...rest: Uint8Array[]) => pda(prefix, ...ns, ...rest);
  const rootPool = pda("pool", u16(0));
  const venuePool = scoped("pool", u16(0));
  const poolNs = (pool: PublicKey): Uint8Array[] => pool.equals(rootPool) ? [] : [pool.toBytes()];
  return Object.freeze({
    pda,
    /** Undefined for the root venue. */
    venueConfig: root ? undefined : config,
    rootConfigPda: () => rootConfig,
    rootPoolPda: () => rootPool,
    configPda: () => config,
    feedPda: (id: number) => pda("feed", u16(id)),
    poolPda: (id: number) => scoped("pool", u16(id)),
    authorityPda: (pool: PublicKey) => pda("authority", pool.toBytes()),
    quoteVaultPda: (pool: PublicKey) => pda("quote", pool.toBytes()),
    solVaultPda: (pool: PublicKey) => pda("sol-quote", pool.toBytes()),
    buybackVaultPda: (pool: PublicKey) => pda("buyback", pool.toBytes()),
    nativeRevenuePda: (pool: PublicKey) => pda("native-revenue", pool.toBytes()),
    perpsRevenuePda: (pool: PublicKey) => pda("perps-revenue", pool.toBytes()),
    perpsOutputPda: (pool: PublicKey,mint:PublicKey) => pda("perps-output",pool.toBytes(),mint.toBytes()),
    gasReservePda: () => pda("gas-reserve"),
    gasVaultPda: (pool: PublicKey) => pda("gas-vault", pool.toBytes()),
    exposurePda: (owner: PublicKey) => pda("exposure", owner.toBytes()),
    assetPda: (mint: PublicKey) => pda("asset", mint.toBytes()),
    marketPda: (feed: PublicKey) => scoped("market", feed.toBytes()),
    inventoryPda: (pool: PublicKey, asset: PublicKey) => pda("inventory", pool.toBytes(), asset.toBytes()),
    vaultPda: (pool: PublicKey, asset: PublicKey) => pda("vault", pool.toBytes(), asset.toBytes()),
    positionPda: (owner: PublicKey, nonce: bigint, pool: PublicKey = venuePool) => {
      const bytes = Buffer.alloc(8); bytes.writeBigUInt64LE(nonce); return pda("position", ...poolNs(pool), owner.toBytes(), bytes);
    },
    ownershipPoolPda: (pool: PublicKey) => pda("ownership-pool", pool.toBytes()),
    ownershipTraderPda: (pool: PublicKey, owner: PublicKey) => pda("ownership-trader", pool.toBytes(), owner.toBytes()),
    ownershipReceiptPda: (position: PublicKey) => pda("ownership-receipt", position.toBytes()),
    contributionLedgerPda:(pool:PublicKey,owner:PublicKey)=>pda('pool-contribution',pool.toBytes(),owner.toBytes()),
    poolExposurePda:()=>pda('pool-exposure',venuePool.toBytes()),
    erTraderPda: (owner: PublicKey) => scoped("er-trader", owner.toBytes()),
    erCustodyPda: (owner: PublicKey) => scoped("er-custody", owner.toBytes()),
    erRiskPda: () => scoped("er-risk"),
    erQuotePda: (asset: PublicKey) => pda("er-quote", asset.toBytes()),
    collateralHistoryPda: (asset: PublicKey) => pda("er-collateral-history", asset.toBytes()),
    collateralGuardPda: (owner: PublicKey) => scoped("er-collateral-guard", owner.toBytes()),
    erFeePayerPda: () => pda("er-fee-payer"),
    /** The config of the venue backed by `mint`. */
    venueConfigPda: (mint: PublicKey) => pda("config", mint.toBytes()),
    venuePda: (venueConfigKey: PublicKey = config) => pda("venue", venueConfigKey.toBytes()),
  });
}
export type ProgramAddresses = ReturnType<typeof programAddresses>;
export const DEVNET_ADDRESSES = programAddresses(DEVNET_PROGRAM_ID);
