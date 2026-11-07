type RasterEnvironment = {
  createImage: () => HTMLImageElement;
  createCanvas: () => HTMLCanvasElement;
};

/** Rasterize a self-contained SVG without animation frames or document font readiness. */
export function rasterizePositionSvg(
  dataUrl: string,
  signal: AbortSignal,
  environment: RasterEnvironment = {
    createImage: () => new Image(),
    createCanvas: () => document.createElement("canvas"),
  },
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    if (!/^data:image\/svg\+xml(?:;[^,]*)?,/.test(dataUrl)) {
      reject(new Error("Position capture must be an inline SVG"));
      return;
    }
    const image = environment.createImage();
    let settled = false;
    const cleanup = () => {
      image.onload = null;
      image.onerror = null;
      signal.removeEventListener("abort", abort);
      image.src = "";
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };
    const abort = () => fail(signal.reason);
    image.onload = () => {
      if (settled) return;
      image.onload = null;
      image.onerror = null;
      try {
        signal.throwIfAborted();
        const canvas = environment.createCanvas();
        canvas.width = 1200;
        canvas.height = 630;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Image capture is unavailable");
        context.fillStyle = "#101613";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (settled) return;
          if (signal.aborted) return abort();
          if (!blob) return fail(new Error("Image capture failed"));
          settled = true;
          cleanup();
          resolve(blob);
        }, "image/png");
      } catch (error) {
        fail(error);
      }
    };
    image.onerror = () => fail(new Error("Couldn’t render the position image"));
    signal.addEventListener("abort", abort, { once: true });
    try {
      image.src = dataUrl;
    } catch (error) {
      fail(error);
    }
  });
}
