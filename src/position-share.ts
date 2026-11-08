import { appFetch as fetch, sdiceSkin, thesisSkin } from "./app-url.ts";
import { THESIS_SHARE_ORIGIN, THESIS_X_HANDLE } from './thesis-share.ts';
export type PositionShareDetails = {
  state: number;
  long: boolean;
  market: string;
  margin: string;
  decimals: number;
  collateral: string;
  entryValue: string;
  leverage: number;
  pnl: string | null;
  poolTokens: string | null;
  ownershipTokens: string | null;
  platformToken: string;
  ownershipToken: string;
  platformDecimals: number;
};

/** Format token atoms without losing precision to Number at large balances. */
function amount(atoms: bigint, decimals: number, fixed = false, grouped = true) {
  const scale = 10n ** BigInt(decimals);
  const cents = (atoms * 100n + scale / 2n) / scale;
  const whole = (cents / 100n).toLocaleString("en-US", { useGrouping: grouped });
  const fraction = (cents % 100n).toString().padStart(2, "0");
  const tail = fixed ? fraction : fraction.replace(/0+$/, "");
  return whole + (tail ? "." + tail : "");
}

export function positionShareText(p: PositionShareDetails, sdice = sdiceSkin, thesis = thesisSkin) {
  const entry = BigInt(p.entryValue);
  const pnl = p.pnl === null ? null : BigInt(p.pnl);
  if (sdice || thesis) {
    const value = pnl === null ? 'pending' : `${pnl < 0n ? '-' : '+'}$${amount(pnl < 0n ? -pnl : pnl, 6, true)}`;
    const rewards = pnl !== null && pnl < 0n && p.poolTokens !== null && p.ownershipTokens !== null
      ? `\n${p.state === 0 ? 'Est. pool / ownership' : 'Pool / ownership'}: ${amount(BigInt(p.poolTokens), p.platformDecimals)} $${p.platformToken} → ${amount(BigInt(p.ownershipTokens), p.platformDecimals)} $${p.ownershipToken}` : '';
    return `${p.market.toUpperCase()} ${p.long ? 'Long' : 'Short'} · ${p.state === 0 ? 'OPEN' : 'CLOSED'} · ${p.leverage}×\nPosition size: $${amount(entry * BigInt(p.leverage), 6, true)}\nCollateral: ${amount(BigInt(p.margin), p.decimals)} $${p.collateral} ($${amount(entry, 6, true)})\n${p.state === 0 ? 'Unrealized P&L' : 'PnL'}: ${value}${rewards}\n@${thesis ? THESIS_X_HANDLE : 'SoltoshiDice'}`;
  }
  let profit = pnl === null ? "PnL pending" : `${pnl < 0n ? "-" : "+"}$${amount(pnl < 0n ? -pnl : pnl, 6, true)} USDC`;
  if (pnl !== null && pnl < 0n) {
    const tokens = (value: string | null) => value === null ? "—" : amount(BigInt(value), p.platformDecimals, false, false);
    profit += ` +${tokens(p.poolTokens)} $${p.platformToken} > ${tokens(p.ownershipTokens)} $${p.ownershipToken}`;
  }
  return `$${amount(entry * BigInt(p.leverage), 6)} ${p.market.toUpperCase()} ${p.long ? "Long" : "Short"} - ${p.state === 0 ? "OPEN" : "CLOSED"}\n${profit}\n${amount(BigInt(p.margin), p.decimals)} $${p.collateral}($${amount(entry, 6, true)}) at ${p.leverage}x\n${sdiceSkin ? '@SoltoshiDice soltoshidice.wtf/perps' : '@acidpumpdotfun acidpump.fun'}`;
}

export function positionShareUrl(text: string, shareUrl?: string) {
  const params = new URLSearchParams({
    text,
  });
  if (shareUrl) params.set("url", shareUrl);
  return `https://x.com/intent/tweet?${params}`;
}

export type HostedPositionShare = { url: string; imageUrl: string };

/** Only our public share pages (or the local QA server) may become draft links. */
export function hostedPositionShare(
  value: unknown,
  origin: string,
  sdice = sdiceSkin,
  thesis = thesisSkin,
): HostedPositionShare {
  if (!value || typeof value !== "object")
    throw new Error("Invalid share response");
  const fields = value as Record<string, unknown>;
  const validate = (field: unknown) => {
    if (typeof field !== "string") throw new Error("Invalid share response");
    const url = new URL(field, origin);
    const local = new URL(origin);
    const localHost =
      ["http:", "https:"].includes(local.protocol) &&
      ["localhost", "127.0.0.1", "[::1]"].includes(local.hostname);
    const trusted =
      url.protocol === "https:" &&
      ["acidpump-er-devnet.fly.dev", "acidpump-mainnet-test.fly.dev", "acidpump.fun", "www.acidpump.fun", ...(thesis ? ['thesis.casino','www.thesis.casino'] : [])].includes(
        url.hostname,
      ) &&
      !url.port;
    if (
      url.username ||
      url.password ||
      !(trusted || (localHost && url.origin === local.origin))
    )
      throw new Error("Invalid share URL");
    if (url.href !== `${url.origin}${url.pathname}`)
      throw new Error("Invalid share URL");
    return url;
  };
  const url = validate(fields.url);
  const imageUrl = validate(fields.imageUrl);
  if (
    !(thesis ? /^(?:\/(?:m\/USDC|thesis(?:\/m\/USDC)?))?\/share\/[a-f0-9]{64}$/ : /^(?:\/m\/[A-Z0-9]{2,12})?\/share\/[a-f0-9]{64}$/).test(url.pathname) ||
    imageUrl.origin !== url.origin ||
    imageUrl.pathname !== `${url.pathname}.png`
  )
    throw new Error("Invalid share URL");
  // Validate the service's original pair before translating it; arbitrary URLs
  // must never become trusted merely because the app is using a branded skin.
  if (thesis) {
    const canonical = `${THESIS_SHARE_ORIGIN}/share/${url.pathname.split('/').at(-1)}`;
    return {url: canonical, imageUrl: canonical + '.png'};
  }
  if (sdice) return { url: `https://soltoshidice.wtf/perps${url.pathname}`, imageUrl: `https://soltoshidice.wtf/perps${imageUrl.pathname}` };
  return { url: url.href, imageUrl: imageUrl.href };
}

/** Bound browser capture/upload work; late completion never changes the draft. */
export async function shareDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parent?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  let rejectAbort: (() => void) | undefined;
  const cancelled = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(controller.signal.reason);
    if (controller.signal.aborted) rejectAbort();
    else
      controller.signal.addEventListener("abort", rejectAbort, { once: true });
  });
  const timer = setTimeout(
    () =>
      controller.abort(
        new Error("Preparing the share took too long. Please try again."),
      ),
    timeoutMs,
  );
  try {
    return await Promise.race([
      cancelled,
      Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return work(controller.signal);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
    if (rejectAbort)
      controller.signal.removeEventListener("abort", rejectAbort);
    controller.abort();
  }
}

export async function uploadPositionShare(
  text: string,
  image: Blob,
  origin: string,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<HostedPositionShare> {
  return shareDeadline(
    async (activeSignal) => {
      const bytes = new Uint8Array(await image.arrayBuffer());
      activeSignal.throwIfAborted();
      let binary = "";
      for (let i = 0; i < bytes.length; i += 8192)
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const response = await request("/api/position-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: [...text].slice(0, 500).join(""),
          image: btoa(binary),
        }),
        signal: activeSignal,
      });
      if (!response.ok)
        throw new Error(
          "Couldn’t create the share link. Close this preview to retry, or open a text-only X draft.",
        );
      return hostedPositionShare(await response.json(), origin);
    },
    20_000,
    signal,
  );
}

export function positionCaptureScale(width: number, height: number) {
  return Math.min(552 / Math.max(1, width), 221 / Math.max(1, height));
}

