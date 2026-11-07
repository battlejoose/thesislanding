import { AnchorProvider, Program } from "@anchor-lang/core";
import { auxiliaryBackingMints } from './backing-assets.ts';
import {isPerpsMarket,perpsRewardAsset,PERPS_MINT,PERPS_OPERATIONS,PERPS_OPERATIONS_SECONDARY} from './perps-market.ts';
import BN from "bn.js";
import { MAGIC_PROGRAM_ID } from '@magicblock-labs/ephemeral-rollups-sdk';
import {
  type AccountMeta,
  PublicKey,
  Connection,
  SystemProgram,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  type AccountInfo,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  createSyncNativeInstruction,
} from "@solana/spl-token";
import { DEVNET_ADDRESSES, DEVNET_PROGRAM_ID, programAddresses } from "./program-addresses.ts";
import { DEVNET_PROFILE, DEVNET_GENESIS, MAINNET_USDC_POOL, assertBaseNetwork, profileForDeployment, type DeploymentProfile } from "./deployment-profile.ts";
import { cachedLookupTable } from "./rpc-cache.ts";
import { MainnetRoutes } from "./mainnet-routes.ts";
import {
  PUMP,
  externalVaults,
  readQuotes,
  routeEstimate,
  swapAccounts,
} from "./pump.ts";
// Compatibility exports are permanently devnet-scoped; clients use their own addresses.
export const PROGRAM = new PublicKey(DEVNET_PROGRAM_ID);
export const DEVNET = DEVNET_GENESIS;
export const b = (n: bigint | number | string) => new BN(n.toString());
export const pk = (n: string | PublicKey) => new PublicKey(n);
export const { pda, authorityPda, quoteVaultPda, gasReservePda, gasVaultPda, exposurePda,
  configPda, feedPda, poolPda, ownershipPoolPda, ownershipTraderPda, ownershipReceiptPda,
  assetPda, marketPda, inventoryPda, vaultPda, positionPda } = DEVNET_ADDRESSES;
export const symbolBytes = (s: string) => [
  ...Buffer.from(s.padEnd(12, "\0").slice(0, 12)),
];
export interface AssetInfo {
  symbol: string;
  name: string;
  color: string;
  mint: string;
  tokenProgram: string;
  decimals: number;
  feedId: number;
  sourceMint: string;
  sourcePool: string;
  dexPool: string;
  /** Registered DEX quote currency; older SOL deployments omit this field. */
  quoteMint?: string;
  collateral: boolean;
  lookupTable?: string;
  /** The market's backing token. Defaults to feed 102 (the root's SDICE). */
  primary?: boolean;
}
/** A created venue ("market"): a full perps market backed by its own token. */
export interface VenueInfo {
  /** A separate USDC/pPERPS pool uses the immutable perps market namespace. */
  rewardMint?: string;
  /** Venue config `[b"config", mint]`; namespaces every per-venue account. */
  config: string;
  venue: string;
  pool: string;
  mint: string;
  symbol: string;
  name?: string;
  creator?: string;
  createdAt?: number;
  /** Source pump.fun mint/pool on mainnet when the venue token is a devnet mirror. */
  sourceMint?: string;
  sourcePool?: string;
  logo?: string;
  lookupTable?: string;
}
export interface Deployment {
  /** Contract-issued, non-transferable ownership balance ticker. */
  secondaryTokenSymbol?: string;
  programId: string;
  cluster: string;
  /** Fresh multi-venue program build (localnet or devnet). */
  modular?: boolean;
  /** Local validator plus local ER; behaves like devnet otherwise. */
  localnet?: boolean;
  genesis?: string;
  /** Public base-layer RPC for browsers of modular deployments. */
  baseRpcUrl?: string;
  /** Set when this deployment view operates one created venue. */
  venue?: VenueInfo;
  /** Root deployments list every created venue. */
  venues?: VenueInfo[];
  /** Public surface of this branch: one USDC payout venue. */
  usdcOnly?: boolean;
  admin: string;
  publisher: string;
  /** Base transaction fee wallet; devnet historically uses the publisher. */
  sponsor?: string;
  faucet: string;
  quoteMint: string;
  feeRecipient?: string;
  buybackRecipient?: string;
  lookupTable?: string;
  gasAsset?: AssetInfo;
  sponsorship?: boolean;
  assets: AssetInfo[];
  er?: {
    rpcUrl: string;
    wsUrl?: string;
    validator: string;
    payer?: string;
  };
}
export const isSol = (a?: AssetInfo) => a?.mint === NATIVE_MINT.toBase58();
/** The token that backs this deployment's market: SDICE (feed 102) for the
 * root venue, or the created venue's own token. */
export const isPrimary = (a?: Pick<AssetInfo, "feedId" | "primary">) => !!a && (a.primary ?? a.feedId === 102);
export const primaryAsset = (d: Pick<Deployment, "assets" | "venue">): AssetInfo | undefined =>
  d.venue ? d.assets.find(a => a.mint === d.venue!.mint) : d.assets.find(a => isPrimary(a));
/** The deployment view a server or browser uses to operate one venue. */
export function venueDeployment(root: Deployment, venue: VenueInfo): Deployment {
  if (!root.modular) throw Error("Only modular deployments host created markets");
  const { venues: _venues, ...base } = root;
  if (!root.assets.some(a => a.mint === venue.mint)) throw Error("Market token is not registered");
  // Each venue's own token is its primary reserve. USDC adds SOL backing;
  // its duplicate USDC auxiliary reserve remains empty.
  // The market's own token is listed first, as SDICE is in the root market.
  const assets = root.assets.map(a => ({ ...a, primary: a.mint === venue.mint }));
  return { ...base, venue, assets: [...assets.filter(a => a.primary), ...assets.filter(a => !a.primary)] };
}
export const walletAssets = (d: Deployment) => [...new Map([...d.assets, usdcAsset(d)].map(a=>[a.mint,a])).values()];
// The existing six-decimal devnet quote mint, also registered as bet collateral.
export const usdcAsset = (d: Deployment): AssetInfo => ({
  symbol: "USDC",
  name: d.cluster === "mainnet-beta" ? "USD Coin" : "Test USDC",
  color: "#2775ca",
  mint: d.quoteMint,
  tokenProgram: TOKEN_PROGRAM_ID.toBase58(),
  decimals: 6,
  feedId: 104,
  sourceMint: d.cluster === "mainnet-beta" ? d.quoteMint : SystemProgram.programId.toBase58(),
  sourcePool: d.cluster === "mainnet-beta" ? MAINNET_USDC_POOL : SystemProgram.programId.toBase58(),
  dexPool: d.cluster === "mainnet-beta" ? MAINNET_USDC_POOL : SystemProgram.programId.toBase58(),
  collateral: d.assets.some(a=>a.mint===d.quoteMint && a.collateral),
  // Refresh candidates and wallet views must retain venue identity and ALTs.
  ...d.assets.find(a=>a.mint===d.quoteMint),
});
export async function transactionTables(
  connection: Connection,
  d: Deployment,
  ixs: { keys: { pubkey: PublicKey }[] }[],
) {
  const keys = new Set(
    ixs.flatMap((ix) => ix.keys.map((k) => k.pubkey.toBase58())),
  );
  const selected = [
    d.lookupTable,
    d.venue?.lookupTable,
    ...d.assets
      .filter(
        (a) => keys.has(a.mint) || keys.has(programAddresses(d.programId).assetPda(pk(a.mint)).toBase58()),
      )
      .map((a) => a.lookupTable),
  ].filter(Boolean) as string[];
  return Promise.all(
    [...new Set(selected)].map((key) => cachedLookupTable(connection, pk(key))),
  );
}
export type Row = { key: string; [key: string]: any };
export type PoolHistoryPoint = { at: number; value: number | null };
export interface Snapshot {
  programId?: string;
  pools: Row[];
  feeds: Row[];
  assets: Row[];
  markets: Row[];
  inventories: Row[];
  positions: Row[];
  quotes: Row[];
  serverTime: number;
  contextSlot?: number;
  inventoryReadAt?:number;
  snapshotAgeMs?: number | null;
  /** Age of the confirmed account scan/subscription watermark, independent of quote publications. */
  accountSnapshotAgeMs?: number | null;
  positionRentLamports?: number;
  exposureRentLamports?: number;
  gasReserves?: Row[];
  economicsPolicies?: Row[];
  ownershipPools?: Row[];
  perpsRevenues?: Row[];
  ownershipTraders?: Row[];
  ownershipReceipts?: Row[];
  contributionLedgers?: Row[];
  poolExposure?: Row;
  exposures?: Row[];
  /** Sampled executable payout-treasury USD quotes; null marks unavailable periods. */
  poolHistory?: PoolHistoryPoint[];
  /** Deduplicated original-entry totals, including recovered historical devnet bets. */
  betVolumeTotals?: import("./metrics-volume.ts").BetVolumeTotals[];
  positionHistoryTotals?: import('./metrics-model.ts').PositionHistoryTotals[];
  erTraders?: Row[];
  custodies?: Row[];
  erRisk?: Row;
  erFeePayer?: Row;
  erQuotes?: Row[];
  erContextSlot?: number;
  erSnapshotAgeMs?: number | null;
  erHistory?: {canOpen:boolean;estimatedLag:number;scanAt:number;submittedSamples:number;pausedSampleTicks:number;maxObservedLag:number;inventoryReady:boolean;inventoryAgeMs:number|null};
}
const ACCOUNT_GROUPS = {
  pool: "pools",
  userExposure: "exposures",
  feed: "feeds",
  asset: "assets",
  market: "markets",
  inventory: "inventories",
  position: "positions",
  gasReserve: "gasReserves",
  economicsV1: "economicsPolicies",
  ownershipPool: "ownershipPools",
  perpsRevenue: "perpsRevenues",
  ownershipTrader: "ownershipTraders",
  ownershipReceipt: "ownershipReceipts",
  contributionLedger:'contributionLedgers',
  erCustody: "custodies",
} as const satisfies Record<string, keyof Snapshot>;
export type SnapshotAccountGroup =
  (typeof ACCOUNT_GROUPS)[keyof typeof ACCOUNT_GROUPS];
export type SnapshotAccountDelta =
  | { key: string; group: SnapshotAccountGroup; row: Row }
  | { key: string; group?: undefined; row: null };
export interface SnapshotAccountsPatch {
  /** Every decoded account was read at this confirmed slot or a newer one. */
  slot: number;
  /** Newest included batch; subsequent reads must not overwrite it with older data. */
  maxSlot?: number;
  accounts: SnapshotAccountDelta[];
}

/** Apply only the confirmed accounts supplied, never replace unrelated state or quotes. */
export function mergeSnapshotAccounts(
  snapshot: Snapshot,
  patch: SnapshotAccountsPatch,
): Snapshot {
  if (patch.slot < (snapshot.contextSlot ?? 0)) return snapshot;
  const next = {
    ...snapshot,
    contextSlot: Math.max(patch.slot, patch.maxSlot ?? patch.slot),
  };
  const updates = new Map(
    patch.accounts.map((account) => [account.key, account]),
  );
  for (const group of Object.values(ACCOUNT_GROUPS)) {
    const previous = snapshot[group] ?? [];
    const keys = new Set(previous.map((row) => row.key));
    const rows: Row[] = [];
    let changed = false;
    for (const row of previous) {
      const update = updates.get(row.key);
      if (!update) rows.push(row);
      else {
        changed = true;
        if (update.row && update.group === group) rows.push(update.row);
      }
    }
    for (const update of updates.values())
      if (update.row && update.group === group && !keys.has(update.key)) {
        changed = true;
        rows.push(update.row);
      }
    if (changed) next[group] = rows;
  }
  return next;
}
export const emptySnapshot = (): Snapshot => ({
  pools: [],
  feeds: [],
  assets: [],
  markets: [],
  inventories: [],
  positions: [],
  quotes: [],
  serverTime: Date.now(),
  gasReserves: [],
  economicsPolicies: [],
  ownershipPools: [],
  perpsRevenues: [],
  ownershipTraders: [],
  ownershipReceipts: [],
  contributionLedgers: [],
  exposures: [],
  custodies: [],
  erTraders: [],
  erQuotes: [],
});
export function jsonValue(v: any): any {
  if (v instanceof PublicKey) return v.toBase58();
  if (BN.isBN(v)) return v.toString();
  if (Array.isArray(v)) return v.map(jsonValue);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, jsonValue(x)]),
    );
  return v;
}
export class MixClient {
  sharedProgramScan?: (minimum?:number)=>Promise<{context:{slot:number};value:readonly {pubkey:PublicKey;account:AccountInfo<Buffer>}[];readAt:number}>;
  program: Program;
  private loadedDeployment?: Deployment;
  readonly addresses;
  readonly mainnetRoutes?: MainnetRoutes;
  get deployment() { return this.loadedDeployment; }
  set deployment(value: Deployment | undefined) {
    if (value && profileForDeployment(value) !== this.profile) throw Error("Client and deployment profiles differ");
    this.loadedDeployment = value;
  }
  constructor(public connection: Connection, readonly profile: DeploymentProfile = DEVNET_PROFILE, routes?: MainnetRoutes) {
    this.addresses = profile.addresses;
    if (profile.mainnet) this.mainnetRoutes = routes ?? new MainnetRoutes(connection);
    this.program = new Program(
      profile.idl,
      new AnchorProvider(
        connection,
        {
          publicKey: PublicKey.default,
          signTransaction: async () => {
            throw Error("Wallet required");
          },
          signAllTransactions: async () => {
            throw Error("Wallet required");
          },
        },
        { commitment: "confirmed" },
      ),
    );
  }
  async assertNetwork() { await assertBaseNetwork(this.connection, this.profile); }
  async assertDevnet() {
    if (this.profile.mainnet) throw Error("Devnet operation cannot use a mainnet client");
    if ((await this.connection.getGenesisHash()) !== DEVNET)
      throw Error("This deployment is devnet-only");
  }
  private decodeSnapshotAccount(
    key: PublicKey,
    account: AccountInfo<Buffer> | null,
  ): SnapshotAccountDelta | undefined {
    const address = key.toBase58();
    if (!account || account.lamports === 0) return { key: address, row: null };
    if (!account.owner.equals(this.profile.programId)) return undefined;
    const name = this.program.idl.accounts?.find((type) =>
      Buffer.from(type.discriminator).equals(account.data.subarray(0, 8)),
    )?.name;
    const group = ACCOUNT_GROUPS[name as keyof typeof ACCOUNT_GROUPS];
    if (!name || !group) return undefined;
    const value = jsonValue(
      this.program.coder.accounts.decode(name, account.data),
    );
    if (name === "gasReserve") value.lamports = account.lamports;
    if (group === 'pools' && this.profile.venueConfig) value.venue = true;
    if (group === 'pools' && this.deployment && isPerpsMarket(this.deployment)) value.perpsRewards = true;
    if (value.symbol)
      value.symbol = String.fromCharCode(...value.symbol).replace(/\0/g, "");
    // One program hosts every market. A client sees shared registries plus
    // only its own venue's pool, markets, positions, custody and rewards.
    if (this.profile.modular && !this.ownsVenueRow(group, address, value)) return undefined;
    return { key: address, group, row: { key: address, ...value } };
  }
  private ownsVenueRow(group: SnapshotAccountGroup, key: string, row: Row) {
    const pool = this.addresses.poolPda(0).toBase58();
    if (group === "pools") return key === pool;
    if (["markets", "inventories", "positions", "ownershipPools", "perpsRevenues", "ownershipTraders", "ownershipReceipts", "contributionLedgers", "custodies"].includes(group))
      return row.pool === pool;
    return true;
  }
  /** Decode an already-confirmed program-account websocket notification using
   * the same account rules as HTTP snapshots, without issuing another read.
   * The subscription caller must request confirmed commitment. */
  snapshotNotification(
    key: PublicKey,
    account: AccountInfo<Buffer> | null,
    slot: number,
  ): SnapshotAccountsPatch {
    if (!Number.isSafeInteger(slot) || slot < 0)
      throw Error("Invalid confirmed notification slot");
    const decoded = this.decodeSnapshotAccount(key, account);
    return {
      slot,
      maxSlot: slot,
      accounts: decoded ? [decoded] : [],
    };
  }
  async snapshotAccounts(
    keys: PublicKey[],
    minContextSlot?: number,
  ): Promise<SnapshotAccountsPatch> {
    const unique = [
      ...new Map(keys.map((key) => [key.toBase58(), key])).values(),
    ];
    if (!unique.length)
      return {
        slot: minContextSlot ?? 0,
        maxSlot: minContextSlot ?? 0,
        accounts: [],
      };
    const batches: PublicKey[][] = [];
    for (let start = 0; start < unique.length; start += 100)
      batches.push(unique.slice(start, start + 100));
    const results = await Promise.all(
      batches.map(async (batch) => {
        const result = await this.connection.getMultipleAccountsInfoAndContext(
          batch,
          { commitment: "confirmed", minContextSlot },
        );
        if (result.value.length !== batch.length)
          throw Error("Incomplete confirmed account snapshot");
        if (result.context.slot < (minContextSlot ?? 0))
          throw Error("Confirmed account snapshot predates requested slot");
        return {
          slot: result.context.slot,
          accounts: batch
            .map((key, index) =>
              this.decodeSnapshotAccount(key, result.value[index]),
            )
            .filter(
              (account): account is SnapshotAccountDelta =>
                account !== undefined,
            ),
        };
      }),
    );
    return {
      // Require every batch to meet the current floor, then retain the newest
      // included slot as the floor for subsequent refreshes.
      slot: Math.min(...results.map((result) => result.slot)),
      maxSlot: Math.max(...results.map((result) => result.slot)),
      accounts: results.flatMap((result) => result.accounts),
    };
  }
  async snapshot(
    minContextSlot?: number,
    options: { quotes?: boolean; observe?:(accounts:readonly {pubkey:PublicKey;account:AccountInfo<Buffer>}[],slot:number,readAt:number)=>void } = {},
  ): Promise<Snapshot> {
    const s = emptySnapshot();
    const readStartedAt=Date.now();
    s.programId = this.profile.programId.toBase58();
    const [accounts, quotes] = await Promise.all([
      this.sharedProgramScan?.(minContextSlot) ?? this.connection.getProgramAccounts(this.profile.programId, {
        commitment: "confirmed",
        minContextSlot,
        withContext: true,
      }),
      this.deployment && options.quotes !== false && !this.profile.mainnet
        ? readQuotes(this.connection, this.deployment, minContextSlot)
        : Promise.resolve([]),
    ]);
    s.inventoryReadAt='readAt' in accounts?Number(accounts.readAt):readStartedAt;
    options.observe?.(accounts.value,accounts.context.slot,s.inventoryReadAt);
    for (const { pubkey, account } of accounts.value) {
      const decoded = this.decodeSnapshotAccount(pubkey, account);
      if (decoded?.row) s[decoded.group]!.push(decoded.row);
    }
    s.contextSlot = accounts.context.slot;
    s.quotes = quotes;
    return s;
  }
  ata(owner: PublicKey, a: AssetInfo) {
    return getAssociatedTokenAddressSync(
      pk(a.mint),
      owner,
      true,
      pk(a.tokenProgram),
    );
  }
  ataIx(payer: PublicKey, owner: PublicKey, a: AssetInfo) {
    return createAssociatedTokenAccountIdempotentInstruction(
      payer,
      this.ata(owner, a),
      owner,
      pk(a.mint),
      pk(a.tokenProgram),
    );
  }
  tokenAccounts(a: AssetInfo, pool: PublicKey) {
    const asset = this.addresses.assetPda(pk(a.mint));
    return {
      pool,
      authority: this.addresses.authorityPda(pool),
      asset,
      mint: pk(a.mint),
      tokenProgram: pk(a.tokenProgram),
      inventory: this.addresses.inventoryPda(pool, asset),
      vault: this.addresses.vaultPda(pool, asset),
    };
  }
  valuation(a: AssetInfo) {
    return this.mainnetRoutes ? this.mainnetRoutes.valuation(a) : externalVaults(a, this.deployment!.quoteMint);
  }
  private intermediateVault(pool: PublicKey) {
    return this.profile.mainnet ? this.addresses.solVaultPda(pool) : this.addresses.quoteVaultPda(pool);
  }
  async open(
    owner: PublicKey,
    a: AssetInfo,
    m: Row,
    amount: bigint,
    leverage: number,
    long: boolean,
    limit: bigint,
    value: bigint,
    payer = owner,
    recycled?: Row,
  ) {
    const wrapping = [];
    if (isSol(a)) {
      const [held, native] = await Promise.all([
        this.connection.getAccountInfo(this.ata(owner,a), "confirmed"),
        this.connection.getBalance(owner,"confirmed"),
      ]);
      const wrapped = held?.data.readBigUInt64LE(64) ?? 0n;
      const needed = amount > wrapped ? amount-wrapped : 0n;
      if (needed>BigInt(native)) throw Error("Not enough SOL in your wallet");
      wrapping.push(this.ataIx(payer,owner,a));
      if (needed) wrapping.push(SystemProgram.transfer({fromPubkey:owner,toPubkey:this.ata(owner,a),lamports:needed}),createSyncNativeInstruction(this.ata(owner,a)));
    }
    const nonce =
        BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000)),
      position = this.addresses.positionPda(owner, nonce);
    return {
      position,
      ixs: [
        ...wrapping,
        await this.program.methods
          .initializeExposure()
          .accountsStrict({
            payer,
            owner,
            exposure: this.addresses.exposurePda(owner),
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
        ...(recycled ? [await this.recycle(owner, recycled, nonce)] : []),
        await this.program.methods
          .open(
            b(nonce),
            b(amount),
            leverage,
            long,
            b(limit),
            b((value * 99n) / 100n),
            b((value * 101n) / 100n + 1n),
          )
          .accountsStrict({
            owner,
            exposure: this.addresses.exposurePda(owner),
            config: this.addresses.configPda(),
            ...this.tokenAccounts(a, pk(m.pool)),
            market: pk(m.key),
            feed: pk(m.feed),
            collateralFeed: this.addresses.feedPda(a.feedId),
            valuation: externalVaults(a, this.deployment!.quoteMint),
            source: this.ata(owner, a),
            position,
            systemProgram: SystemProgram.programId,
          })
          .instruction(),
        ...(recycled
          ? [
              await this.initializeOwnership(owner, {
                key: position.toBase58(),
                owner: owner.toBase58(),
                pool: m.pool,
              }),
            ]
          : []),
      ],
    };
  }
  async recycle(executor: PublicKey, previous: Row, newNonce: bigint) {
    const owner = pk(previous.owner), nextPosition = this.addresses.positionPda(owner, newNonce);
    return this.program.methods
      .recyclePosition(b(newNonce))
      .accountsStrict({
        executor,
        owner,
        pool: pk(previous.pool),
        position: pk(previous.key),
        ownershipReceipt: this.addresses.ownershipReceiptPda(pk(previous.key)),
        nextPosition,
        nextReceipt: this.addresses.ownershipReceiptPda(nextPosition),
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction();
  }
  async route(pool: PublicKey, from: AssetInfo, to: AssetInfo, amount: bigint) {
    const d = this.deployment;
    if (!d) throw Error("Deployment not loaded");
    const quotes = await readQuotes(this.connection, d);
    const out = routeEstimate(
      amount,
      quotes.find((f) => f.id === from.feedId)!,
      quotes.find((f) => f.id === to.feedId)!,
    );
    return {
      out,
      minOut: (out * 99n) / 100n || 1n,
      ...this.routeAccounts(pool, from, to),
    };
  }
  routeAccounts(pool: PublicKey, from: AssetInfo, to: AssetInfo) {
    if (this.profile.mainnet) throw Error("Mainnet in-kind conversion is disabled; use the backing-token profit payout route");
    const d = this.deployment;
    if (!d) throw Error("Deployment not loaded");
    const sell = from.mint === d.quoteMint ? [] : swapAccounts(
      d,
      from,
      this.addresses.authorityPda(pool),
      this.addresses.vaultPda(pool, this.addresses.assetPda(pk(from.mint))),
      this.addresses.quoteVaultPda(pool),
      false,
    );
    const buy = swapAccounts(
      d,
      to,
      this.addresses.authorityPda(pool),
      this.addresses.vaultPda(pool, this.addresses.assetPda(pk(to.mint))),
      this.addresses.quoteVaultPda(pool),
      true,
    );
    return {
      sellCount: sell.length,
      accounts: [...sell, ...buy],
    };
  }
  lossRouting(pool: PublicKey) {
    const d = this.deployment!,
      perp = primaryAsset(d)!,
      gas = d.gasAsset;
    if (!gas) throw Error("Gas route unavailable");
    const core = pool.equals(this.addresses.poolPda(0));
    return {
      gasReserve: this.addresses.gasReservePda(),
      perp: this.addresses.assetPda(pk(perp.mint)),
      perpMint: pk(perp.mint),
      perpProgram: pk(perp.tokenProgram),
      perpVault: this.addresses.vaultPda(pool, this.addresses.assetPda(pk(perp.mint))),
      mainPool: core ? null : this.addresses.poolPda(0),
      mainOwnershipPool: core ? null : this.addresses.ownershipPoolPda(this.addresses.poolPda(0)),
      mainInventory: core
        ? null
        : this.addresses.inventoryPda(this.addresses.poolPda(0), this.addresses.assetPda(pk(perp.mint))),
      mainVault: core ? null : this.addresses.vaultPda(this.addresses.poolPda(0), this.addresses.assetPda(pk(perp.mint))),
      gasAsset: this.addresses.assetPda(pk(gas.mint)),
      gasMint: pk(gas.mint),
      gasVault: this.addresses.gasVaultPda(pool),
      gasProgram: pk(gas.tokenProgram),
      systemProgram: SystemProgram.programId,
      // Created venues route 1% (9% above $2M) to their SDICE pool-contribution vault.
      venue: d.venue ? this.addresses.venuePda() : null,
      buybackVault: d.venue ? this.addresses.buybackVaultPda(pool) : null,
      ...(this.profile.mainnet ? {nativeRevenue: d.venue && [103,104].includes(perp.feedId)
        ? this.addresses.nativeRevenuePda(pool) : null} : {}),
    };
  }
  feeAccounts(pool: PublicKey, a: AssetInfo) {
    const d = this.deployment!,
      perp = primaryAsset(d)!,
      gas = d.gasAsset!;
    if (this.mainnetRoutes) {
      const auth = this.addresses.authorityPda(pool), intermediate = this.addresses.solVaultPda(pool);
      const same = a.mint === perp.mint;
      const sell = isSol(a) ? [] : this.mainnetRoutes.swap(a, auth,
        this.addresses.vaultPda(pool, this.addresses.assetPda(pk(a.mint))),
        same && !d.venue ? this.addresses.gasVaultPda(pool) : intermediate, false, true);
      const buy = same || isSol(perp) ? [] : this.mainnetRoutes.swap(perp, auth,
        this.addresses.vaultPda(pool, this.addresses.assetPda(pk(perp.mint))), intermediate, true, true);
      return { sellCount: sell.length, perpCount: buy.length, accounts: [...sell, ...buy] };
    }
    const auth = this.addresses.authorityPda(pool),
      q = this.addresses.quoteVaultPda(pool);
    const sell = a.mint === d.quoteMint ? [] : swapAccounts(
      d,
      a,
      auth,
      this.addresses.vaultPda(pool, this.addresses.assetPda(pk(a.mint))),
      q,
      false,
    );
    const buy = a.mint === perp.mint ? [] : swapAccounts(
      d,
      perp,
      auth,
      this.addresses.vaultPda(pool, this.addresses.assetPda(pk(perp.mint))),
      q,
      true,
    );
    // A venue's own token sells its 2% fee share into the quote, then buys SOL gas.
    const venueSelfFee = !!d.venue && a.mint === perp.mint;
    const sellVenueFee = venueSelfFee ? swapAccounts(d, a, auth, this.addresses.vaultPda(pool, this.addresses.assetPda(pk(a.mint))), q, false) : [];
    const gasBuy = isSol(a) ? [] : swapAccounts(d, gas, auth, this.addresses.gasVaultPda(pool), q, true);
    if (venueSelfFee) return { sellCount: sellVenueFee.length, perpCount: 0, accounts: [...sellVenueFee, ...gasBuy] };
    return {
      sellCount: sell.length,
      perpCount: buy.length,
      accounts: [...sell, ...buy, ...gasBuy],
    };
  }
  backingRoutes(pool:PublicKey,trader?:Row) {
    const d=this.deployment!,primary=primaryAsset(d)!;
    const routes:any={sol:{accounts:0,sellCount:0,minOut:b(0)},usd:{accounts:0,sellCount:0,minOut:b(0)}};
    const accounts:AccountMeta[]=[];
    for(const [index,name] of [[0,'sol'],[1,'usd']] as const) {
      const mint=auxiliaryBackingMints(d)[index];
      if(BigInt(trader?.auxiliaryStakes?.[index]?.tokens??0)===0n)continue;
      if(mint===primary.mint)throw Error('Duplicate backing reserve');
      const asset=d.assets.find(a=>a.mint===mint);
      if(!asset||!this.mainnetRoutes)throw Error('Mixed backing settlement route unavailable');
      const auth=this.addresses.authorityPda(pool),key=this.addresses.assetPda(pk(mint)),vault=this.addresses.vaultPda(pool,key),q=this.intermediateVault(pool);
      const sell=isSol(asset)?[]:this.mainnetRoutes.swap(asset,auth,vault,q,false,true);
      const buy=isSol(primary)?[]:this.mainnetRoutes.swap(primary,auth,this.addresses.vaultPda(pool,this.addresses.assetPda(pk(primary.mint))),q,true,true);
      const v=this.mainnetRoutes.valuation(asset);
      const valuation = mint !== NATIVE_MINT.toBase58() && mint !== d.quoteMint
        ? [v.dexPool,v.dexBase,v.dexQuote,v.feeConfig,v.dexMint,v.globalConfig,v.usdPool,v.usdMint,v.usdBase,v.usdQuote,v.sourceGlobal,v.sourceFees]
          .map(pubkey=>({pubkey,isSigner:false,isWritable:false})) : [];
      const route=[{pubkey:key,isSigner:false,isWritable:false},{pubkey:this.addresses.inventoryPda(pool,key),isSigner:false,isWritable:true},
        {pubkey:vault,isSigner:false,isWritable:true},...valuation,...sell,...buy];
      if(route.length>255)throw Error('Backing route exceeds instruction capacity');
      routes[name]={accounts:route.length,sellCount:sell.length,minOut:b(1)};
      accounts.push(...route);
    }
    return {routes,accounts};
  }
  async close(caller: PublicKey, a: AssetInfo, x: Row, m: Row, payer = caller, solQuote?: {price: string; publishTime: string}, backingTrader?:Row) {
    const d = this.deployment;
    if (!d) throw Error("Deployment not loaded");
    const pool = pk(x.pool);
    // Settlement belongs to the pool, not the market's feed number. Every
    // market of a venue shares that venue's pool zero and primary token.
    if (!pool.equals(this.addresses.poolPda(0)) || (m.pool && m.pool !== x.pool))
      throw Error("Unsupported settlement pool");
    const target = primaryAsset(d);
    if (!target) throw Error("Pool settlement asset unavailable");
    await this.mainnetRoutes?.ensure([a, target, usdcAsset(d),...d.assets.filter(asset=>auxiliaryBackingMints(d).includes(asset.mint))], true);
    const same = target.mint === a.mint;
    // Market-execute the realized loss, not a pre-close estimate. The program
    // calculates loss from its execution-time feed, spends only that loss and
    // records actual swap receipts for the pool, gas and ownership rewards.
    // Accept any positive output (one smallest token unit) on all three buys;
    // keep the route accounts even when the displayed position is profitable.
    const feeRoute = this.feeAccounts(pool, a);
    const mixed=this.program.idl.instructions.some(i=>i.name==='closeBackedMixed')&&!!backingTrader;
    // These collaterals never consume backing. Still select the mixed ABI so
    // funded auxiliary reserves are acknowledged, without unnecessary swaps.
    const exempt=a.mint===target.mint||isSol(a)||a.mint===d.quoteMint||auxiliaryBackingMints(d).includes(a.mint);
    const backingRoute=mixed?this.backingRoutes(pool,exempt?undefined:backingTrader):undefined;
    if (this.profile.coreBacking && (!solQuote || !/^\d+$/.test(solQuote.price) || !/^\d+$/.test(solQuote.publishTime)))
      throw Error("Fresh SOL/USD is required for backed settlement");
    const args = [0, b(1), 0, feeRoute.sellCount, feeRoute.perpCount, b(1), b(this.profile.mainnet ? 0 : 1)];
    const method = this.profile.coreBacking
      ? mixed?this.program.methods.closeBackedMixed(...args,{price:b(solQuote!.price),publishTime:b(solQuote!.publishTime)},backingRoute!.routes)
        :this.program.methods.closeBacked(...args, {price:b(solQuote!.price),publishTime:b(solQuote!.publishTime)})
      : this.program.methods.close(...args);
    return [
      await this.initializeOwnership(payer, x),
      ...(this.mainnetRoutes?.prepareSell(a,payer,this.addresses.authorityPda(pool))??[]),
      ...(this.profile.mainnet ? [] : [this.ataIx(payer, pk(x.owner), a)]),
      await method
        .accountsStrict({
          ...(this.profile.coreBacking ? {quotePublisher:pk(d.publisher)} : {}),
          ...this.tokenAccounts(a, pool),
          poolAccounts: { caller, pool, authority: this.addresses.authorityPda(pool), valuation: this.valuation(a) },
          market: pk(m.key),
          ...(this.profile.mainnet ? {economics: this.addresses.pda("economics-v1")} : {feed: pk(m.feed)}),
          ...(!this.profile.mainnet ? {collateralFeed: this.addresses.feedPda(a.feedId)} : {}),
          position: pk(x.key),
          ownership: this.ownershipAccounts(x),
          ...(!this.profile.mainnet ? {destination: this.ata(pk(x.owner), a)} : {}),
          settlement: this.addresses.assetPda(pk(target.mint)),
          settlementInventory: same
            ? null
            : this.addresses.inventoryPda(pool, this.addresses.assetPda(pk(target.mint))),
          settlementVault: same
            ? null
            : this.addresses.vaultPda(pool, this.addresses.assetPda(pk(target.mint))),
          quoteVault: this.intermediateVault(pool),
          pumpProgram: PUMP,
          fees: this.lossRouting(pool),
          bridge: {
            config: this.addresses.configPda(),
            custody: this.addresses.erCustodyPda(pk(x.owner)),
            trader: this.addresses.erTraderPda(pk(x.owner)),
            // closeBacked uses authenticated opening/closing quotes and stake;
            // the retired historical-floor guard is not read. Keep its ABI
            // slot, but reuse the config key on larger mixed/USDC routes so that
            // atomic settlement stays within the 64-account bank limit.
            guard: this.profile.mainnet && (mixed || a.quoteMint === d.quoteMint) ? this.addresses.configPda()
              : this.addresses.collateralGuardPda(pk(x.owner)),
          },
        } as any)
        .remainingAccounts([...(backingRoute?.accounts??[]),...(isPerpsMarket(d)?[
          {pubkey:this.addresses.perpsRevenuePda(pool),isSigner:false,isWritable:true}]:[]),...feeRoute.accounts])
        .instruction(),
    ];
  }
  async observe(caller: PublicKey, x: Row, m: Row) {
    return this.program.methods
      .observe()
      .accountsStrict({
        caller,
        market: pk(m.key),
        feed: pk(m.feed),
        position: pk(x.key),
      })
      .instruction();
  }
  ownershipAccounts(x: Row) {
    return {
      exposure: this.addresses.exposurePda(pk(x.owner)),
      settlementValuation: this.valuation(primaryAsset(this.deployment!)!),
      ownershipPool: this.addresses.ownershipPoolPda(pk(x.pool)),
      ownershipTrader: this.addresses.ownershipTraderPda(pk(x.pool), pk(x.owner)),
      ownershipReceipt: this.addresses.ownershipReceiptPda(pk(x.key)),
    };
  }
  async initializeOwnership(payer: PublicKey, x: Row) {
    return this.program.methods
      .initializeOwnership()
      .accountsStrict({
        payer,
        position: pk(x.key),
        ownershipTrader: this.addresses.ownershipTraderPda(pk(x.pool), pk(x.owner)),
        ownershipReceipt: this.addresses.ownershipReceiptPda(pk(x.key)),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }
  async contributePool(owner:PublicKey,payer:PublicKey,pool:Row,a:AssetInfo,amount:bigint,nonce:bigint,minIssued:bigint,expires:number,
    funding?:{authority:PublicKey;source:PublicKey}) {
    if(this.addresses.venueConfig||pool.key!==this.addresses.rootPoolPda().toBase58())throw Error('Contributions are for the main SDICE payout pool');
    return this.program.methods.contributePool(b(amount),b(nonce),b(minIssued),b(expires)).accountsStrict({
      payer,owner,fundingAuthority:funding?.authority??owner,config:this.addresses.rootConfigPda(),
      ...this.tokenAccounts(a,pk(pool.key)),source:funding?.source??this.ata(owner,a),
      ownershipPool:this.addresses.ownershipPoolPda(pk(pool.key)),ownershipTrader:this.addresses.ownershipTraderPda(pk(pool.key),owner),
      ledger:this.addresses.contributionLedgerPda(pk(pool.key),owner),valuation:this.valuation(a),
      execution:{magicProgram:MAGIC_PROGRAM_ID},systemProgram:SystemProgram.programId,
    }).instruction();
  }
  async stakeOwnership(
    owner: PublicKey,
    pool: Row,
    amount: bigint,
    unstake = false,
  ) {
    if(isPerpsMarket(this.deployment!))return this.program.methods.stakePerpsOwnership(b(amount),unstake).accountsStrict({
      owner,pool:pk(pool.key),ownershipPool:this.addresses.ownershipPoolPda(pk(pool.key)),
      ownershipTrader:this.addresses.ownershipTraderPda(pk(pool.key),owner),
    }).instruction();
    return this.program.methods
      .stakeOwnership(b(amount), unstake)
      .accountsStrict({
        owner,
        pool: pk(pool.key),
        ownershipPool: this.addresses.ownershipPoolPda(pk(pool.key)),
        ownershipTrader: this.addresses.ownershipTraderPda(pk(pool.key), owner),
        inventory: this.addresses.inventoryPda(pk(pool.key), pk(pool.settlement)),
      })
      .instruction();
  }
  async claimOwnership(owner: PublicKey, pool: Row, a: AssetInfo) {
    if(isPerpsMarket(this.deployment!)) {
      const reward=perpsRewardAsset(this.deployment!);
      if(a.mint!==reward.mint)throw Error('This market pays staking rewards in PERPS');
      return this.program.methods.claimPerpsRewards().accountsStrict({owner,pool:pk(pool.key),
        ownershipPool:this.addresses.ownershipPoolPda(pk(pool.key)),ownershipTrader:this.addresses.ownershipTraderPda(pk(pool.key),owner),
        authority:this.addresses.authorityPda(pk(pool.key)),mint:pk(reward.mint),tokenProgram:pk(reward.tokenProgram),
        vault:this.addresses.perpsOutputPda(pk(pool.key),pk(reward.mint)),destination:this.ata(owner,reward),execution:{magicProgram:MAGIC_PROGRAM_ID},
      }).instruction();
    }
    const { inventory, ...tokens } = this.tokenAccounts(a, pk(pool.key));
    return this.program.methods
      .claimOwnershipRewards()
      .accountsStrict({
        owner,
        ...tokens,
        ownershipPool: this.addresses.ownershipPoolPda(pk(pool.key)),
        ownershipTrader: this.addresses.ownershipTraderPda(pk(pool.key), owner),
        destination: this.ata(owner, a),
      })
      .instruction();
  }
  async routePerpsRevenue(publisher:PublicKey,operations:boolean,minOut:bigint,amount=0n) {
    return this.perpsRevenueInstruction(publisher,operations?'operations':'rewards',minOut,amount);
  }
  async burnPerpsRevenue(publisher:PublicKey,minOut:bigint,amount=0n) {
    return this.perpsRevenueInstruction(publisher,'burn',minOut,amount);
  }
  private async perpsRevenueInstruction(publisher:PublicKey,kind:'rewards'|'operations'|'burn',minOut:bigint,amount:bigint) {
    const operations=kind==='operations';
    const d=this.deployment!;
    if(!isPerpsMarket(d)||!this.mainnetRoutes||minOut<=0n)throw Error('USDC/PERPS revenue route unavailable');
    const usd=usdcAsset(d),target=operations?d.assets.find(a=>a.mint===NATIVE_MINT.toBase58())!:perpsRewardAsset(d);
    await this.mainnetRoutes.ensure([usd,target]);
    const a=this.addresses,pool=a.poolPda(0),authority=a.authorityPda(pool),source=a.vaultPda(pool,a.assetPda(pk(usd.mint)));
    const output=a.perpsOutputPda(pool,pk(target.mint)),quote=a.solVaultPda(pool);
    const sell=this.mainnetRoutes.swap(usd,authority,source,operations?output:quote,false);
    const buy=operations?[]:this.mainnetRoutes.swap(target,authority,output,quote,true);
    const method=kind==='burn'?this.program.methods.burnPerpsRevenue(b(amount),b(minOut),sell.length)
      :this.program.methods.routePerpsRevenue(operations,b(amount),b(minOut),sell.length);
    return method.accountsStrict({
      publisher,config:a.configPda(),pool,authority,usdc:a.assetPda(pk(usd.mint)),target:a.assetPda(pk(target.mint)),
      mint:pk(target.mint),tokenProgram:pk(target.tokenProgram),source,quoteVault:quote,output,
      revenue:a.perpsRevenuePda(pool),ownershipPool:a.ownershipPoolPda(pool),operations:pk(PERPS_OPERATIONS),operationsSecondary:pk(PERPS_OPERATIONS_SECONDARY),
      pumpProgram:PUMP,systemProgram:SystemProgram.programId,execution:{magicProgram:MAGIC_PROGRAM_ID},
    }).remainingAccounts([...sell,...buy]).instruction();
  }
  async sweepPerpsSurplus(caller:PublicKey,pool:Row) {
    if(!isPerpsMarket(this.deployment!))throw Error('Expected USDC/PERPS market');
    const a=this.addresses,p=pk(pool.key);
    return this.program.methods.sweepPerpsSurplus().accountsStrict({caller,pool:p,
      ownershipPool:a.ownershipPoolPda(p),inventory:a.inventoryPda(p,pk(pool.settlement)),revenue:a.perpsRevenuePda(p),
      execution:{magicProgram:MAGIC_PROGRAM_ID}}).instruction();
  }
  async redeem(
    owner: PublicKey,
    x: Row,
    collateral: AssetInfo,
    a: AssetInfo,
    amount: bigint,
    maxDebit: bigint,
    expires: number,
    conversion?: { sellCount: number; minOut: bigint; accounts: any[] },
  ) {
    if (this.profile.mainnet) throw Error("Mainnet profit claims use automatic USDC redemption");
    const pool = pk(x.pool),
      convert = !!conversion;
    return this.program.methods
      .redeem(
        b(amount),
        b(maxDebit),
        b(expires),
        convert,
        conversion?.sellCount ?? 0,
        b(conversion?.minOut ?? 0n),
      )
      .accountsStrict({
        owner,
        ...this.tokenAccounts(a, pool),
        position: pk(x.key),
        collateral: this.addresses.assetPda(pk(collateral.mint)),
        feed: this.addresses.feedPda(a.feedId),
        valuation: externalVaults(a, this.deployment!.quoteMint),
        destination: this.ata(owner, a),
        quoteVault: this.addresses.quoteVaultPda(pool),
        pumpProgram: PUMP,
        conversionVault: convert
          ? this.addresses.vaultPda(pool, this.addresses.assetPda(pk(collateral.mint)))
          : null,
        convertedDestination: convert ? this.ata(owner, collateral) : null,
        collateralMint: convert ? pk(collateral.mint) : null,
        collateralProgram: convert ? pk(collateral.tokenProgram) : null,
      } as any)
      .remainingAccounts(conversion?.accounts ?? [])
      .instruction();
  }
  async redeemProfitTokens(caller:PublicKey,x:Row,a:AssetInfo) {
    await this.mainnetRoutes?.ensure([a,usdcAsset(this.deployment!)]);
    const pool=pk(x.pool);
    return [this.ataIx(caller,pk(x.owner),a),await this.program.methods.redeemProfitTokens().accountsStrict({
      caller,execution:{magicProgram:MAGIC_PROGRAM_ID},...this.tokenAccounts(a,pool),position:pk(x.key),valuation:this.valuation(a),destination:this.ata(pk(x.owner),a),
    }).instruction()];
  }
  async redeemUsdc(caller: PublicKey, x: Row, a: AssetInfo) {
    const d = this.deployment!,
      pool = pk(x.pool),
      usd = usdcAsset(d);
    await this.mainnetRoutes?.ensure([a, usd]);
    return [
      this.ataIx(caller, pk(x.owner), usd),
      await this.program.methods
        .redeemUsdc()
        .accountsStrict({
          caller,
          config: this.addresses.configPda(),
          ...this.tokenAccounts(a, pool),
          position: pk(x.key),
          valuation: this.valuation(a),
          quoteMint: pk(d.quoteMint),
          quoteProgram: TOKEN_PROGRAM_ID,
          quoteVault: this.addresses.quoteVaultPda(pool),
          destination: this.ata(pk(x.owner), usd),
          pumpProgram: PUMP,
          ...(this.profile.mainnet ? { solVault: this.addresses.solVaultPda(pool) } : {}),
        })
        .remainingAccounts(
          this.mainnetRoutes ? [
            ...this.mainnetRoutes.swap(a, this.addresses.authorityPda(pool),
              this.addresses.vaultPda(pool, this.addresses.assetPda(pk(a.mint))), this.addresses.solVaultPda(pool), false),
            ...this.mainnetRoutes.swap(usd, this.addresses.authorityPda(pool),
              this.addresses.quoteVaultPda(pool), this.addresses.solVaultPda(pool), true),
          ] : swapAccounts(
            d,
            a,
            this.addresses.authorityPda(pool),
            this.addresses.vaultPda(pool, this.addresses.assetPda(pk(a.mint))),
            this.addresses.quoteVaultPda(pool),
            false,
          ),
        )
        .instruction(),
    ];
  }
}
