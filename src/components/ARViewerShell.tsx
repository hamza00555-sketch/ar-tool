"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import type { Experience } from "@/lib/types";
import { trackView, shareUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import TypeIcon from "./TypeIcon";
import QRPanel from "./QRPanel";
import ModelViewerClient, {
  type ModelViewerHandle,
} from "./viewers/ModelViewerClient";
import PlaneViewer, {
  type PlaneViewerHandle,
  isImmersiveARSupported,
} from "./viewers/PlaneViewer";
import TrackedViewer, { type TrackedViewerHandle } from "./viewers/TrackedViewer";

type ARCapability = "checking" | "ready" | "unsupported";

interface Platform {
  mobile: boolean;
  ios: boolean;
  android: boolean;
  /** In-app webview (WhatsApp/Instagram/…): camera and AR are blocked there */
  inApp: boolean;
}

const SERVER_PLATFORM: Platform = { mobile: false, ios: false, android: false, inApp: false };
let platformCache: Platform | null = null;

function detectPlatform(): Platform {
  if (!platformCache) {
    const ua = navigator.userAgent;
    const ios =
      /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
    const android = /Android/.test(ua);
    const inApp =
      /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Snapchat|TikTok|Line\/|MicroMessenger/i.test(ua) ||
      (android && /; wv\)/.test(ua));
    platformCache = { mobile: ios || android || /Mobile/.test(ua), ios, android, inApp };
  }
  return platformCache;
}

const noopSubscribe = () => () => {};

/**
 * The public viewer: records the scan, shows a start screen, launches AR where
 * the device supports it, and falls back to an interactive 3D preview with a
 * clear explanation (plus a QR code on desktop) everywhere else.
 */
export default function ARViewerShell({ experience }: { experience: Experience }) {
  const { t, toggleLocale, langName } = useViewerI18n();
  const [started, setStarted] = useState(false);
  const [capability, setCapability] = useState<ARCapability>("checking");
  const [error, setError] = useState<string | null>(null);
  // Videos must start muted (autoplay policy); a soundtrack starts audible
  // because it only ever plays from the user's Start-AR tap.
  const [muted, setMuted] = useState(() => !experience.content.audioUrl);
  const { mobile, ios, android, inApp } = useSyncExternalStore(
    noopSubscribe,
    detectPlatform,
    () => SERVER_PLATFORM
  );

  const modelRef = useRef<ModelViewerHandle>(null);
  const planeRef = useRef<PlaneViewerHandle>(null);
  const trackedRef = useRef<TrackedViewerHandle>(null);
  const [targetVisible, setTargetVisible] = useState(false);
  // How flat content enters AR: real WebXR, or the camera-backdrop AR-lite
  // mode for browsers without WebXR (iOS Safari)
  const [planeArMode, setPlaneArMode] = useState<"webxr" | "camera" | null>(null);

  // Image experiences with a generated poster GLB also go through
  // model-viewer: that unlocks native camera AR (Quick Look / Scene Viewer)
  // on phones, where WebXR isn't available for flat content.
  const isTracked = experience.type === "tracked";
  // Image experiences with a generated GLB (plain poster or fully baked
  // themed scene) ride the native AR pipeline — real world tracking.
  const isModel =
    experience.type === "model" ||
    (experience.type === "image" && Boolean(experience.content.arModelUrl));
  const modelSrc =
    experience.type === "model"
      ? experience.content.assetUrl
      : experience.content.arModelUrl;
  const hasContent =
    experience.type === "text"
      ? Boolean(experience.content.text)
      : isTracked
        ? Boolean(experience.content.assetUrl && experience.content.mindUrl)
        : Boolean(experience.content.assetUrl);

  useEffect(() => {
    trackView(experience.id);
  }, [experience.id]);

  /* ------------------------------ soundtrack ------------------------------ */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { audioUrl, audioLoop } = experience.content;
  useEffect(() => {
    if (!audioUrl) return;
    const el = new Audio(audioUrl);
    el.loop = audioLoop !== false;
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    audioRef.current = el;
    // Console-inspectable handle (same spirit as window.__holoformTracker)
    (window as unknown as { __holoformAudio?: HTMLAudioElement }).__holoformAudio = el;
    return () => {
      el.pause();
      el.src = "";
      audioRef.current = null;
    };
  }, [audioUrl, audioLoop]);

  // Tracked experiences: the soundtrack follows the target — plays while the
  // image is in view, pauses when it's lost. (Playback was unlocked by the
  // Start-AR tap, so later play() calls are allowed.)
  useEffect(() => {
    if (!isTracked || !started) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (targetVisible) audio.play().catch(() => {});
    else audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetVisible, started]);

  // In-app webviews block camera/AR even when model-viewer reports ready —
  // derived at render time so the warning shows without any state churn.
  const effectiveCapability: ARCapability = inApp ? "unsupported" : capability;

  // Determine AR capability. model-viewer decides lazily, so poll it briefly.
  useEffect(() => {
    if (!hasContent || inApp) return;
    let cancelled = false;
    if (isTracked) {
      // Image tracking needs only a camera (works even on desktop webcams)
      Promise.resolve().then(() => {
        if (!cancelled)
          setCapability(
            typeof navigator.mediaDevices?.getUserMedia === "function"
              ? "ready"
              : "unsupported"
          );
      });
      return () => {
        cancelled = true;
      };
    }
    if (isModel) {
      let tries = 0;
      const tick = () => {
        if (cancelled) return;
        if (modelRef.current?.canActivateAR()) return setCapability("ready");
        if (++tries > 20) return setCapability("unsupported");
        setTimeout(tick, 250);
      };
      tick();
    } else {
      isImmersiveARSupported().then((ok) => {
        if (cancelled) return;
        if (ok) {
          setPlaneArMode("webxr");
          setCapability("ready");
        } else if (
          detectPlatform().mobile &&
          typeof navigator.mediaDevices?.getUserMedia === "function"
        ) {
          // No WebXR (iOS Safari) — offer the camera-backdrop AR-lite mode
          setPlaneArMode("camera");
          setCapability("ready");
        } else {
          setCapability("unsupported");
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [isModel, isTracked, hasContent, inApp]);

  const onStartAR = async () => {
    setStarted(true);
    // Start (or unlock) the soundtrack inside the tap gesture, before any
    // await breaks the user-activation chain.
    const audio = audioRef.current;
    if (audio) {
      // Baked themed posters carry the sound inside the USDZ itself — Quick
      // Look plays it natively, so page audio would double up on iPhone.
      const quickLookHasAudio =
        ios && isModel && experience.type === "image" && Boolean(experience.content.usdzUrl);
      if (isTracked) {
        // Unlock only — playback follows target visibility
        audio.play().then(() => audio.pause()).catch(() => {});
      } else if (!quickLookHasAudio) {
        audio.play().catch(() => {});
      }
    }
    if (effectiveCapability !== "ready") return; // preview only
    if (isTracked) {
      try {
        await trackedRef.current?.start();
      } catch (e) {
        setStarted(false);
        setError(
          e instanceof Error && e.message === "camera"
            ? t.viewer.cameraDenied
            : t.viewer.trackerFailed
        );
      }
      return;
    }
    if (!isModel && planeArMode === "camera") {
      const ok = await planeRef.current?.startCameraBackdrop();
      if (!ok) {
        setStarted(false);
        setError(t.viewer.cameraDenied);
      }
      return;
    }
    const ok = isModel
      ? await modelRef.current?.activateAR()
      : await planeRef.current?.startAR();
    if (!ok) setCapability("unsupported");
  };

  const toggleMute = () => {
    const video = isTracked
      ? trackedRef.current?.getVideoEl()
      : planeRef.current?.getVideoEl();
    const audio = audioRef.current;
    if (!video && !audio) return;
    const next = !muted;
    if (video) {
      video.muted = next;
      if (!next) video.play().catch(() => {});
    }
    if (audio) {
      audio.muted = next;
      if (!next && (!isTracked || targetVisible)) audio.play().catch(() => {});
    }
    setMuted(next);
  };

  const url = useMemo(() => shareUrl(experience.id), [experience.id]);

  /* ------------------------------ error states ----------------------------- */
  if (!hasContent) {
    return (
      <ViewerFrame>
        <Notice title={t.viewer.noContentTitle} body={t.viewer.noContentBody} />
      </ViewerFrame>
    );
  }

  return (
    <ViewerFrame>
      {/* The 3D stage fills the screen behind the overlays */}
      <div className="absolute inset-0">
        {isTracked ? (
          <TrackedViewer
            ref={trackedRef}
            experience={experience}
            onTargetVisible={setTargetVisible}
            onError={(kind) =>
              setError(
                kind === "camera"
                  ? t.viewer.cameraDenied
                  : kind === "tracker"
                    ? t.viewer.trackerFailed
                    : t.viewer.loadErrorContent
              )
            }
          />
        ) : isModel ? (
          <ModelViewerClient
            ref={modelRef}
            src={modelSrc!}
            iosSrc={experience.content.usdzUrl}
            alt={experience.title}
            onLoadError={() => setError(t.viewer.loadErrorModel)}
            onArFailed={() => {
              // AR launch failed after the tap (ARCore missing, webview, …) —
              // reopen the start overlay with the specific explanation.
              setCapability("unsupported");
              setStarted(false);
            }}
          />
        ) : (
          <PlaneViewer
            ref={planeRef}
            experience={experience}
            onError={() => setError(t.viewer.loadErrorContent)}
          />
        )}
      </div>

      {/* Language toggle — public visitors pick their language here */}
      {!started && (
        <button
          onClick={toggleLocale}
          className="btn btn-ghost absolute top-4 end-4 z-30 !rounded-full !px-3 !py-1.5 text-xs"
        >
          {langName}
        </button>
      )}

      {/* Start overlay */}
      {!started && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-end bg-gradient-to-t from-ink-950 via-ink-950/60 to-transparent p-6 pb-10 text-center">
          <div className="animate-rise flex w-full max-w-sm flex-col items-center gap-4">
            <span className="flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs text-mist-300 backdrop-blur">
              <TypeIcon type={experience.type} className="h-3.5 w-3.5 text-aurora-300" />
              {t.types[experience.type].label}
            </span>
            <h1 className="text-2xl font-bold">{experience.title}</h1>
            {experience.description && (
              <p className="text-sm text-mist-300">{experience.description}</p>
            )}

            {effectiveCapability === "ready" ? (
              <button onClick={onStartAR} className="btn btn-primary w-full !py-3.5 text-base">
                <ARGlyph /> {t.viewer.startAR}
              </button>
            ) : (
              <button onClick={onStartAR} className="btn btn-primary w-full !py-3.5 text-base">
                {t.viewer.open3D}
              </button>
            )}

            {effectiveCapability === "unsupported" && (
              <div className="w-full rounded-xl border border-ember-400/25 bg-ember-400/8 px-4 py-3 text-xs text-ember-400">
                {!mobile ? (
                  t.viewer.desktopHint
                ) : inApp ? (
                  t.viewer.inAppBrowser
                ) : android ? (
                  <>
                    {t.viewer.androidNeedsArcore}{" "}
                    <a
                      href="https://play.google.com/store/apps/details?id=com.google.ar.core"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold underline"
                    >
                      {t.viewer.androidArcoreLink}
                    </a>
                  </>
                ) : ios && isModel && !experience.content.usdzUrl ? (
                  t.viewer.iosNeedsUsdz
                ) : (
                  t.viewer.unsupportedMobile
                )}
              </div>
            )}

            {!mobile && effectiveCapability !== "ready" && (
              <div className="glass-strong mt-2 w-full p-4">
                <QRPanel url={url} compact />
              </div>
            )}
          </div>
        </div>
      )}

      {/* In-experience chrome */}
      {started && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between p-4">
            <div className="rounded-full border border-white/10 bg-ink-950/60 px-3.5 py-1.5 text-xs text-mist-300 backdrop-blur">
              {experience.title}
            </div>
            {(experience.type === "video" ||
              Boolean(experience.content.audioUrl) ||
              (isTracked && /\.(mp4|webm|mov)(\?|$)/i.test(experience.content.assetUrl ?? ""))) && (
              <button
                onClick={toggleMute}
                className="btn btn-ghost pointer-events-auto !rounded-full !px-3 !py-2 text-xs"
              >
                {muted ? t.viewer.unmute : t.viewer.mute}
              </button>
            )}
          </div>
          {isTracked && !targetVisible && (
            <div className="absolute inset-x-0 bottom-20 z-10 flex justify-center">
              <span className="animate-pulse-soft rounded-full border border-aurora-500/30 bg-ink-950/70 px-4 py-2 text-sm text-aurora-300 backdrop-blur">
                {t.viewer.pointAtTarget}
              </span>
            </div>
          )}
          {effectiveCapability === "ready" &&
            !isTracked &&
            !(planeArMode === "camera" && !isModel) && (
              <div className="absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
                <button onClick={onStartAR} className="btn btn-primary !rounded-full text-sm">
                  <ARGlyph /> {t.viewer.enterAR}
                </button>
              </div>
            )}
        </>
      )}

      {error && (
        <div className="absolute inset-x-4 top-4 z-30">
          <div className="mx-auto max-w-md rounded-xl border border-danger-400/30 bg-ink-950/90 px-4 py-3 text-sm text-danger-400 backdrop-blur">
            {error}
          </div>
        </div>
      )}
    </ViewerFrame>
  );
}

/** Shown by the server route when the id doesn't exist (client for i18n). */
export function ViewerNotFound() {
  const { t } = useI18n();
  return (
    <div className="flex h-dvh items-center justify-center p-6">
      <div className="glass-strong max-w-sm p-8 text-center">
        <h1 className="text-lg font-bold">{t.viewer.notFoundTitle}</h1>
        <p className="mt-2 text-sm text-mist-500">{t.viewer.notFoundBody}</p>
      </div>
    </div>
  );
}

function useViewerI18n() {
  const { t, toggleLocale } = useI18n();
  return { t, toggleLocale, langName: t.langName };
}

function ViewerFrame({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink-950">
      {children}
      <Link
        href="/"
        className="absolute bottom-2 end-3 z-10 text-[0.65rem] text-mist-600 hover:text-mist-300"
      >
        {t.viewer.madeWith}
      </Link>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="glass-strong max-w-sm p-8 text-center">
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="mt-2 text-sm text-mist-500">{body}</p>
      </div>
    </div>
  );
}

function ARGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <path d="m12 7.5 3.5 2v4l-3.5 2-3.5-2v-4l3.5-2Z" />
    </svg>
  );
}
