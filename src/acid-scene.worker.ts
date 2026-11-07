import { createAcidScene, type SceneActivity, type SceneSize } from "./acid-scene.ts";

export type SceneMessage =
  | { type: "init"; canvas: OffscreenCanvas; seed: number; size: SceneSize; activity: SceneActivity }
  | { type: "resize"; size: SceneSize }
  | { type: "activity"; activity: SceneActivity };

let scene: ReturnType<typeof createAcidScene> | undefined;
self.onmessage = ({ data }: MessageEvent<SceneMessage>) => {
  try {
    if (data.type === "init") {
      if (typeof requestAnimationFrame !== "function") throw Error("Worker frames unavailable");
      scene?.dispose();
      scene = createAcidScene(data.canvas, {
        ...data.size, ...data.activity, seed: data.seed,
        makeCanvas: () => new OffscreenCanvas(1, 1),
        diagnostics: import.meta.env.DEV ? stats => self.postMessage({ type: "stats", stats }) : undefined,
      });
      self.postMessage({ type: "ready" });
    } else if (data.type === "resize") scene?.resize(data.size);
    else scene?.activity(data.activity);
  } catch {
    scene?.dispose();
    self.postMessage({ type: "failed" });
  }
};
