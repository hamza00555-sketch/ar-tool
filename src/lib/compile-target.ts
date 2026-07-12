"use client";

/**
 * In-browser compilation of a target image into a MindAR .mind feature file.
 * Same principle as ARCore/ARKit reference-image libraries: distinctive
 * feature points are extracted once at creation time so the phone only has
 * to match them at view time. Runs client-side to avoid serverless time
 * limits — takes a few seconds up to ~a minute depending on the device.
 */
export async function compileTargetImage(
  imageUrl: string,
  onProgress: (pct: number) => void
): Promise<Blob> {
  const { Compiler } = await import("mind-ar/dist/mindar-image.prod.js");

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Could not load the target image"));
    el.src = imageUrl;
  });

  const compiler = new Compiler();

  // MindAR can fail inside detached promises (e.g. WebGL unavailable) without
  // rejecting the awaited call — a stall watchdog turns that into a clear error.
  let lastTick = Date.now();
  const compilePromise = compiler.compileImageTargets([img], (p: number) => {
    lastTick = Date.now();
    onProgress(Math.round(p));
  });
  const watchdog = new Promise<never>((_, reject) => {
    const iv = setInterval(() => {
      if (Date.now() - lastTick > 90_000) {
        clearInterval(iv);
        reject(new Error("Image analysis stalled — this device/browser may lack WebGL support"));
      }
    }, 5_000);
    compilePromise.finally(() => clearInterval(iv));
  });
  await Promise.race([compilePromise, watchdog]);

  const buffer = await compiler.exportData();
  return new Blob([buffer], { type: "application/octet-stream" });
}
