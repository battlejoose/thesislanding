import { appFetch as fetch } from "./app-url.ts";
/** Embed the actual response type: Pump image URLs may end in a source .webp
 * query while returning JPEG. html-to-image guesses from the URL instead. */
export async function embedPositionImages(
  root: HTMLElement,
  signal: AbortSignal,
  request: typeof fetch = fetch,
) {
  // Keep this cache local to one snapshot, so failed downloads can be retried.
  const downloads = new Map<string, Promise<string>>();
  await Promise.all([...root.querySelectorAll<HTMLImageElement>("img")].map(async (image) => {
    signal.throwIfAborted();
    const source = image.currentSrc || image.src;
    if (!source || source.startsWith("data:")) return;
    let download = downloads.get(source);
    if (!download) {
      download = (async () => {
        const url = new URL(source);
        const mint = url.origin === "https://images.pump.fun" && /^\/coin-image\/([1-9A-HJ-NP-Za-km-z]{32,44})$/.exec(url.pathname)?.[1];
        // Pump thumbnails display in <img>, but browsers may block reading
        // them cross-origin. Use our cached Pump-only copy for export.
        const response = await request(mint ? `/api/position-share-logo?mint=${mint}` : source,
          {signal, cache: "force-cache", referrerPolicy: "no-referrer"});
        if (!response.ok) throw new Error("Couldn’t load a token logo. Close this preview and try again.");
        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) throw new Error("The token logo could not be read. Close this preview and try again.");
        const bytes = new Uint8Array(await blob.arrayBuffer());
        signal.throwIfAborted();
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192)
          binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        return `data:${blob.type};base64,${btoa(binary)}`;
      })();
      downloads.set(source, download);
    }
    const embedded = await download;
    signal.throwIfAborted();
    image.removeAttribute("srcset");
    image.src = embedded;
  }));
}
