import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Modal } from "./components.tsx";
import {
  positionShareText,
  positionShareUrl,
  positionCaptureScale,
  shareDeadline,
  uploadPositionShare,
  type HostedPositionShare,
  type PositionShareDetails,
} from "./position-share.ts";
import "./position-share.css";
import { rasterizePositionSvg } from "./position-raster.ts";
import { embedPositionImages } from "./position-share-images.ts";
import { sdiceSkin, thesisSkin, appName } from "./app-url.ts";

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.3l7.2-8.3L1.8 2h6.5l4.4 6.7L18.9 2Zm-1.1 18h1.7L7.3 3.9H5.5L17.8 20Z"
      />
    </svg>
  );
}

/** Clone synchronously so the text and image retain the clicked position's state. */
async function capturePosition(
  card: HTMLElement,
  signal: AbortSignal,
  cluster: string,
): Promise<Blob> {
  const frame = document.createElement("div");
  frame.className = "position-capture";
  frame.setAttribute("aria-hidden", "true");
  frame.inert = true;
  const canvas = document.createElement("div");
  canvas.className = "position-share-canvas";
  const heading = document.createElement("div");
  heading.className = "position-share-canvas-brand";
  const siteBrand = card.ownerDocument.querySelector<HTMLElement>(
    thesisSkin ? 'header .thesis-brand' : sdiceSkin ? "header .sdice-brand" : "header .acid-wordmark",
  );
  if (siteBrand) {
    const brand = siteBrand.cloneNode(true) as HTMLElement;
    const source = [siteBrand, ...siteBrand.querySelectorAll<HTMLElement>("*")];
    const frozen = [brand, ...brand.querySelectorAll<HTMLElement>("*")];
    // Preserve the header's current acid-letter/smoke pose in the still image.
    source.forEach((node, index) => {
      const style = getComputedStyle(node);
      frozen[index].style.transform = style.transform;
      frozen[index].style.opacity = style.opacity;
    });
    heading.append(brand);
  } else {
    heading.textContent = appName;
  }
  const content = document.createElement("div");
  content.className = "position-share-canvas-card";
  const snapshot = card.cloneNode(true) as HTMLElement;
  snapshot.classList.remove("has-overlay", "position-arriving");
  snapshot.style.width = `${card.offsetWidth}px`;
  snapshot.style.transform = "none";
  snapshot.style.margin = "0";
  snapshot
    .querySelectorAll(
      "[data-share-exclude], .position-overlay, .transaction-progress, .close-error",
    )
    .forEach((node) => node.remove());
  const caption = document.createElement("div");
  caption.className = "position-share-canvas-caption";
  caption.textContent = cluster === "mainnet-beta" ? "POSITION SNAPSHOT · MAINNET" : "POSITION SNAPSHOT · DEVNET / TEST TOKENS";
  if (sdiceSkin) {
    canvas.classList.add('sdice-position-share');
    caption.textContent += thesisSkin ? ' · Thesis PERPS' : ' · soltoshidice.wtf/perps';
  }
  content.append(snapshot);
  canvas.append(heading, content, caption);
  frame.append(canvas);
  document.body.append(frame);
  try {
    return await shareDeadline(
      async (activeSignal) => {
        // The export uses a system font. Waiting for page fonts or scanning its
        // stylesheets can stall on blocked Google Fonts or injected stylesheets.
        activeSignal.throwIfAborted();
        snapshot.style.transform = `scale(${positionCaptureScale(snapshot.offsetWidth, snapshot.offsetHeight)})`;
        const { toSvg } = await import("html-to-image");
        activeSignal.throwIfAborted();
        await shareDeadline((logoSignal) => embedPositionImages(canvas, logoSignal), 9_000, activeSignal);
        const resources = new AbortController();
        const abortResources = () => resources.abort(activeSignal.reason);
        activeSignal.addEventListener("abort", abortResources, { once: true });
        const resourceTimeout = setTimeout(
          () => resources.abort(new Error("Snapshot logo download timed out")),
          3_000,
        );
        try {
          const svg = await toSvg(canvas, {
            width: 600,
            height: 315,
            backgroundColor: "#101613",
            skipFonts: true,
            fontEmbedCSS: "",
            includeQueryParams: true,
            fetchRequestInit: { signal: resources.signal },
            // A missing decorative logo must not stop the position from sharing.
            imagePlaceholder:
              "data:image/svg+xml;charset=utf-8," +
              encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="15" fill="#293c17" stroke="#c6ff52"/></svg>'),
          });
          activeSignal.throwIfAborted();
          // Avoid animation-frame waits, which can pause if the user switches tabs.
          return await rasterizePositionSvg(svg, activeSignal);
        } finally {
          clearTimeout(resourceTimeout);
          activeSignal.removeEventListener("abort", abortResources);
          resources.abort();
        }
      },
      15_000,
      signal,
    );
  } finally {
    frame.remove();
  }
}

type Preview = {
  text: string;
  image: Blob | null;
  hosted?: HostedPositionShare;
  notice: string;
};

export function PositionShareButton({
  details,
  cluster = "devnet",
}: {
  details: PositionShareDetails;
  cluster?: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [stage, setStage] = useState("");
  const active = useRef<AbortController | null>(null);
  const close = useCallback(() => {
    active.current?.abort();active.current=null;
    setStage("");setPreview(null);
  }, []);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  return (
    <>
      <div className="position-share-row" data-share-exclude>
        <button
          className="position-share-button"
          aria-label={
            stage ||
            `Share ${details.market} ${details.long ? "long" : "short"} position on X`
          }
          title={stage || "Preview this position’s snapshot for X"}
          aria-busy={!!stage}
          disabled={!!stage}
          onClick={async (event) => {
            if (active.current) return;
            const card = event.currentTarget.closest<HTMLElement>(".position");
            if (!card) return;
            const frozen: Preview = {
              text: positionShareText(details),
              image: null,
              notice: "",
            };
            const controller = new AbortController();
            active.current = controller;
            // Stay in the app while preparing. The ready draft opens only from
            // the preview's explicit link, with a fresh user gesture.
            setPreview({...frozen});
            setStage("Creating image…");
            try {
              frozen.image = await capturePosition(card, controller.signal, cluster);
              controller.signal.throwIfAborted();
              setPreview({...frozen});
              setStage("Creating share link…");
              frozen.hosted = await uploadPositionShare(
                frozen.text,
                frozen.image,
                window.location.origin,
                controller.signal,
              );
              controller.signal.throwIfAborted();
              frozen.notice = "Your snapshot is ready. Open your X draft below.";
              setPreview({...frozen});
            } catch (error) {
              if (!controller.signal.aborted) {
                frozen.notice =
                  error instanceof Error
                    ? error.message
                    : "Couldn’t prepare the share link. Close this preview and try again.";
                setPreview({...frozen});
              }
            } finally {
              if (active.current === controller) {
                active.current = null;
                setStage("");
              }
            }
          }}
        >
          {stage ? <span className="spinner" /> : <XIcon />}{" "}
          <span
            className={stage ? "position-share-stage" : "position-share-label"}
          >
            {stage || "Share"}
          </span>
        </button>
      </div>
      {preview &&
        createPortal(
          <PositionSharePreview preview={preview} stage={stage} close={close} />,
          document.body,
        )}
    </>
  );
}

function PositionSharePreview({
  preview,
  stage,
  close,
}: {
  preview: Preview;
  stage: string;
  close: () => void;
}) {
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  useEffect(() => {
    if (!preview.image) return;
    const url = URL.createObjectURL(preview.image);
    setImage({ blob: preview.image, url });
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [preview.image]);
  return (
    <Modal title="Share on X" close={close}>
      <div className="position-share-preview" aria-busy={!!stage}>
        <p className="position-share-text">{preview.text}</p>
        {image ? (
          <img
            className="position-share-image"
            src={image.url}
            alt="Snapshot of your position card"
          />
        ) : (
          <div className="position-share-loading" role="status">
            {stage || preview.image ? (
              <>
                <span className="spinner" aria-hidden="true" /> {stage || "Loading your snapshot…"}
              </>
            ) : (
              "Couldn’t create the image. Close this preview to try again, or share the text above."
            )}
          </div>
        )}
        <div className="position-share-actions position-share-footer">
          <p className={stage ? "position-share-progress" : "position-share-notice"} role="status">
            {stage && <span className="spinner" aria-hidden="true" />}
            {stage || preview.notice}
          </p>
          {stage?<button className="share-open-x" disabled><XIcon /> Open X draft</button>:<a
            className="share-open-x"
            href={positionShareUrl(preview.text, preview.hosted?.url)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <XIcon /> Open X draft
          </a>}
        </div>
      </div>
    </Modal>
  );
}
