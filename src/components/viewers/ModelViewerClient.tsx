"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { ModelViewerElement } from "@/types/model-viewer";

export interface ModelViewerHandle {
  /** Launch native AR (WebXR / Scene Viewer / Quick Look) if the device can */
  activateAR(): Promise<boolean>;
  /** Whether this device reports AR availability for the current model */
  canActivateAR(): boolean;
}

/**
 * <model-viewer> wrapper for GLB/glTF: 3D preview everywhere, native AR entry
 * on Android (Scene Viewer / WebXR) and iOS (Quick Look when a USDZ is set).
 */
const ModelViewerClient = forwardRef<
  ModelViewerHandle,
  {
    src: string;
    iosSrc?: string;
    alt: string;
    onLoadError?: (message: string) => void;
    /** Fired when an AR launch attempt fails (e.g. Scene Viewer/ARCore missing) */
    onArFailed?: () => void;
  }
>(function ModelViewerClient({ src, iosSrc, alt, onLoadError, onArFailed }, ref) {
  const elRef = useRef<ModelViewerElement>(null);
  const [defined, setDefined] = useState(false);

  useEffect(() => {
    let active = true;
    // Register the custom element in the browser only
    import("@google/model-viewer")
      .then(() => active && setDefined(true))
      .catch(() => onLoadError?.("The 3D viewer failed to load."));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    const onError = () =>
      onLoadError?.("This 3D model couldn’t be loaded. Check the file is a valid .glb/.gltf.");
    // model-viewer reports AR launch failures (e.g. ARCore not installed)
    // asynchronously via ar-status — the click itself "succeeds".
    const onArStatus = (e: Event) => {
      const status = (e as CustomEvent<{ status?: string }>).detail?.status;
      if (status === "failed") onArFailed?.();
    };
    el.addEventListener("error", onError);
    el.addEventListener("ar-status", onArStatus);
    return () => {
      el.removeEventListener("error", onError);
      el.removeEventListener("ar-status", onArStatus);
    };
  }, [defined, onLoadError, onArFailed]);

  useImperativeHandle(ref, () => ({
    async activateAR() {
      const el = elRef.current;
      if (!el?.canActivateAR) return false;
      await el.activateAR();
      return true;
    },
    canActivateAR() {
      return Boolean(elRef.current?.canActivateAR);
    },
  }));

  if (!defined) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="h-9 w-9 animate-spin rounded-full border-2 border-aurora-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <model-viewer
      ref={elRef}
      src={src}
      ios-src={iosSrc}
      alt={alt}
      ar
      ar-modes="webxr scene-viewer quick-look"
      ios-src-allowed-browsers="safari chrome"
      ar-scale="auto"
      camera-controls
      auto-rotate
      shadow-intensity="1"
      exposure="1.1"
      style={{ width: "100%", height: "100%" }}
    />
  );
});

export default ModelViewerClient;
