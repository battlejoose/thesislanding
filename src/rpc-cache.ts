import type {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
} from "@solana/web3.js";

type Blockhash = Awaited<ReturnType<Connection["getLatestBlockhash"]>>;
type Entry<T> = { value?: T; pending?: Promise<T>; expires: number };

/** Only transaction metadata is cached. Prices, balances and execution state stay fresh. */
export function createRpcMetadataCache(now: () => number = Date.now) {
  const hashes = new WeakMap<object, Map<string, Entry<Blockhash>>>();
  const tables = new WeakMap<
    object,
    Map<string, Entry<AddressLookupTableAccount>>
  >();

  function read<T>(
    entries: Map<string, Entry<T>>,
    key: string,
    fetchValue: () => Promise<T>,
    ttl: (value: T) => number,
    valid: (value: T) => boolean = () => true,
    forceRefresh = false,
  ): Promise<T> {
    const previous = entries.get(key);
    if (previous?.pending) return previous.pending;
    if (
      !forceRefresh &&
      previous?.value &&
      previous.expires > now() &&
      valid(previous.value)
    )
      return Promise.resolve(previous.value);

    const started = now();
    const entry: Entry<T> = { expires: 0 };
    entries.set(key, entry);
    entry.pending = Promise.resolve()
      .then(fetchValue)
      .then((value) => {
        if (!valid(value))
          throw Error("Transaction lookup table is deactivated");
        entry.value = value;
        // Slow reads do not extend a stale metadata window.
        entry.expires = started + ttl(value);
        entry.pending = undefined;
        return value;
      })
      .catch((error: unknown) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
    return entry.pending;
  }

  function cachedBlockhash(
    connection: Pick<Connection, "getLatestBlockhash">,
    forceRefresh = false,
  ) {
    let entries = hashes.get(connection);
    if (!entries) hashes.set(connection, (entries = new Map()));
    return read(
      entries,
      "confirmed",
      () => connection.getLatestBlockhash("confirmed"),
      () => 4_000,
      undefined,
      forceRefresh,
    );
  }

  function cachedLookupTable(
    connection: Pick<Connection, "getAddressLookupTable">,
    key: PublicKey,
  ) {
    let entries = tables.get(connection);
    if (!entries) tables.set(connection, (entries = new Map()));
    return read(
      entries,
      key.toBase58(),
      async () => {
        const table = (
          await connection.getAddressLookupTable(key, {
            commitment: "confirmed",
          })
        ).value;
        if (!table) throw Error("Transaction lookup table unavailable");
        return table;
      },
      // A frozen active table cannot be extended, deactivated or closed. Mutable
      // tables are refreshed well inside Solana's deactivation cooldown.
      (table) => (table.state.authority ? 30_000 : Infinity),
      (table) => table.isActive(),
    );
  }

  return { cachedBlockhash, cachedLookupTable };
}

export const { cachedBlockhash, cachedLookupTable } = createRpcMetadataCache();
