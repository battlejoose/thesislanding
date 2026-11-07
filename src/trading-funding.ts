export type TradingFundingState = { initialized: boolean; available: bigint; wallet: bigint; pendingCredit?: bigint; ready?:boolean };

/** A preparation rejected by pacing has created no signed transaction. Retry
 * only that rejection; an ambiguous submission must never be replayed here. */
export async function withPreparationPacing<T>(prepare:()=>Promise<T>, pause=()=>new Promise<void>(resolve=>setTimeout(resolve,1500))):Promise<T> {
  try { return await prepare(); }
  catch(error) {
    if(!(error instanceof Error)||error.message!=="Please wait before preparing another transaction") throw error;
    await pause();
    return prepare();
  }
}

/** Fund only the requested shortfall once. A confirmed base deposit is not
 * spendable credit until the ER's authenticated custody sync reports it. */
export async function fundTradingShortfall(requested: bigint, actions: {
  read: (signal: AbortSignal) => Promise<TradingFundingState>;
  initialize: () => Promise<void>;
  deposit: (amount: bigint) => Promise<void>;
  pause?: () => Promise<void>;
  now?: () => number;
  timeoutMs?: number;
  onWait?: () => void;
}) {
  const now=actions.now??Date.now;
  // A stalled snapshot request must not hold the trade button indefinitely.
  // This only cancels reads; it never cancels or repeats a signed deposit.
  const read = async (timeoutMs: number) => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        actions.read(controller.signal),
        new Promise<never>((_, reject) => { timer = setTimeout(() => {
          reject(Error("Trading balance check timed out. Check your wallet's trading balance before retrying; a submitted deposit may still confirm."));
          controller.abort();
        }, Math.max(1, timeoutMs)); }),
      ]);
    } finally { clearTimeout(timer); controller.abort(); }
  };
  const initial=await read(15_000);
  if(initial.available>=requested&&initial.ready!==false) return;
  const missing=requested-initial.available-(initial.pendingCredit??0n);
  const shortfall=missing>0n?missing:0n;
  if(shortfall>initial.wallet) throw Error("Not enough wallet and trading collateral for this bet");
  if(!initial.initialized) await actions.initialize();
  if(shortfall>0n) await actions.deposit(shortfall);
  actions.onWait?.();
  const deadline=now()+(actions.timeoutMs??45_000);
  do {
    const state=await read(Math.min(15_000,deadline-now()));
    if(state.available>=requested&&state.ready!==false) return;
    await (actions.pause?.()??new Promise(resolve=>setTimeout(resolve,500)));
  } while(now()<deadline);
  throw Error("Trading credit or observation history is still syncing. Your collateral remains in trading balance; retry when trading resumes.");
}
