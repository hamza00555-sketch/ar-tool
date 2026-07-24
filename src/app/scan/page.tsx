"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppShell from "@/components/AppShell";
import { createScanJob, uploadFile } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

const TARGET_FRAMES = 40;
const MIN_FRAMES = 20;
const AUTO_INTERVAL_MS = 500;
const MAX_FRAME_DIM = 1440; // enough detail for photogrammetry, keeps uploads sane
const JPEG_QUALITY = 0.85;

type Phase = "intro" | "capturing" | "building";

/**
 * Guided 3D-scan capture: the visitor circles a real object while the camera
 * grabs frames from every angle. The frames are uploaded and handed to a
 * scan job, which the self-hosted reconstruction worker turns into a model.
 */
export default function ScanPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);
  const [auto, setAuto] = useState(true);
  const [frames, setFrames] = useState<Blob[]>([]);
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };

  // Stop the camera on unmount
  useEffect(() => () => stopCamera(), []);

  const startCamera = async () => {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
    } catch {
      setError(t.scan.cameraDenied);
      return;
    }
    streamRef.current = stream;
    setPhase("capturing");
    // The <video> mounts with the phase change; attach on the next tick.
    requestAnimationFrame(() => {
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      v.play().catch(() => {});
    });
  };

  const grabFrame = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const scale = Math.min(1, MAX_FRAME_DIM / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale);
    const h = Math.round(v.videoHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(v, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob(res, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return;
    const thumb = canvas.toDataURL("image/jpeg", 0.4);
    setFrames((f) => (f.length >= TARGET_FRAMES ? f : [...f, blob]));
    setThumbs((tp) => [thumb, ...tp].slice(0, 5));
  }, []);

  // Auto-capture loop while enabled and below target
  useEffect(() => {
    if (phase !== "capturing" || !auto) return;
    if (frames.length >= TARGET_FRAMES) return;
    const timer = setInterval(grabFrame, AUTO_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [phase, auto, frames.length, grabFrame]);

  const build = async () => {
    if (frames.length < MIN_FRAMES) {
      setError(t.scan.tooFew(MIN_FRAMES));
      return;
    }
    setPhase("building");
    setError(null);
    stopCamera();
    try {
      const urls: string[] = [];
      for (let i = 0; i < frames.length; i++) {
        setProgress(t.scan.uploading(i + 1, frames.length));
        const file = new File([frames[i]], `frame-${String(i).padStart(3, "0")}.jpg`, {
          type: "image/jpeg",
        });
        const up = await uploadFile(file, "image");
        urls.push(up.url);
      }
      setProgress(t.scan.creating);
      const job = await createScanJob(t.scan.title, urls);
      router.push(`/scan/${job.id}`);
    } catch (e) {
      setPhase("capturing");
      setProgress(null);
      setError(e instanceof Error ? e.message : t.scan.failedCreate);
    }
  };

  const reset = () => {
    setFrames([]);
    setThumbs([]);
    setError(null);
  };

  const pct = Math.min(100, Math.round((frames.length / TARGET_FRAMES) * 100));

  return (
    <AppShell>
      <div className="animate-rise mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold tracking-tight">{t.scan.title}</h1>
        <p className="mt-1 text-sm text-mist-500">{t.scan.intro}</p>

        {error && (
          <p className="mt-4 rounded-lg border border-danger-400/30 bg-danger-400/10 px-3 py-2 text-sm text-danger-400">
            {error}
          </p>
        )}

        {phase === "intro" && (
          <div className="mt-6 flex flex-col gap-5">
            <ul className="glass flex flex-col gap-2 p-4 text-sm text-mist-300">
              {t.scan.tips.map((tip) => (
                <li key={tip} className="flex items-start gap-2">
                  <span className="mt-0.5 text-aurora-300">✦</span>
                  {tip}
                </li>
              ))}
            </ul>
            <button onClick={startCamera} className="btn btn-primary self-start !py-3 text-base">
              {t.scan.startCamera}
            </button>
          </div>
        )}

        {phase === "capturing" && (
          <div className="mt-6 flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-950">
              <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover sm:aspect-video" />
              {/* framing guide */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-3/5 w-3/5 rounded-full border-2 border-dashed border-white/40" />
              </div>
              <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
                <span className="rounded-full bg-ink-950/70 px-3 py-1 text-sm font-semibold text-aurora-300 backdrop-blur">
                  {t.scan.frames(frames.length, TARGET_FRAMES)}
                </span>
                <label className="flex items-center gap-2 rounded-full bg-ink-950/70 px-3 py-1 text-xs text-mist-200 backdrop-blur">
                  <input
                    type="checkbox"
                    checked={auto}
                    onChange={(e) => setAuto(e.target.checked)}
                    className="h-3.5 w-3.5 accent-teal-400"
                  />
                  {t.scan.autoCapture}
                </label>
              </div>
              {thumbs.length > 0 && (
                <div className="absolute bottom-3 start-3 flex gap-1.5">
                  {thumbs.map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt="" className="h-10 w-10 rounded-md border border-white/20 object-cover" />
                  ))}
                </div>
              )}
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-aurora-400 to-iris-400 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-mist-600">{t.scan.minHint(MIN_FRAMES)}</p>

            <div className="flex flex-wrap items-center gap-3">
              <button onClick={grabFrame} className="btn btn-ghost" disabled={frames.length >= TARGET_FRAMES}>
                {t.scan.shutter}
              </button>
              <button onClick={build} disabled={frames.length < MIN_FRAMES} className="btn btn-primary">
                {t.scan.build}
              </button>
              {frames.length > 0 && (
                <button onClick={reset} className="btn btn-ghost text-xs">
                  {t.scan.retake}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === "building" && (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-aurora-400 border-t-transparent" />
            <p className="text-sm text-mist-300">{progress}</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
