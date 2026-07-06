"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import type { Experience } from "@/lib/types";

export interface PlaneViewerHandle {
  /** Enter WebXR immersive-ar. Resolves false when unsupported/denied. */
  startAR(): Promise<boolean>;
  /** The underlying <video> for video experiences (for the mute toggle) */
  getVideoEl(): HTMLVideoElement | null;
}

/** True when the browser can run a WebXR immersive-ar session. */
export async function isImmersiveARSupported(): Promise<boolean> {
  if (typeof navigator === "undefined" || !("xr" in navigator)) return false;
  try {
    return Boolean(await navigator.xr?.isSessionSupported("immersive-ar"));
  } catch {
    return false;
  }
}

const FONT_URL = "/fonts/holoform_display.typeface.json";
/** Content is placed slightly below eye level, ~1.3 m ahead, when AR starts */
const AR_ANCHOR = new THREE.Vector3(0, -0.15, -1.3);

/**
 * Three.js viewer for image / video / 3D-text experiences.
 * Renders an interactive 3D preview by default, and can promote itself into a
 * WebXR immersive-ar session on supporting browsers (Android Chrome et al.).
 */
const PlaneViewer = forwardRef<
  PlaneViewerHandle,
  { experience: Experience; onError?: (message: string) => void }
>(function PlaneViewer({ experience, onError }, ref) {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const contentRef = useRef<THREE.Group | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useImperativeHandle(ref, () => ({
    async startAR() {
      const renderer = rendererRef.current;
      const content = contentRef.current;
      if (!renderer || !content) return false;
      if (!(await isImmersiveARSupported())) return false;
      try {
        const session = await navigator.xr!.requestSession("immersive-ar", {
          optionalFeatures: ["dom-overlay", "local-floor"],
          domOverlay: { root: document.body },
        });
        renderer.xr.setReferenceSpaceType("local");
        await renderer.xr.setSession(session);
        content.position.copy(AR_ANCHOR);
        content.rotation.set(0, 0, 0);
        session.addEventListener("end", () => {
          content.position.set(0, 0, 0);
        });
        videoRef.current?.play().catch(() => {});
        return true;
      } catch {
        return false;
      }
    },
    getVideoEl() {
      return videoRef.current;
    },
  }));

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let disposed = false;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      55,
      mount.clientWidth / Math.max(1, mount.clientHeight),
      0.01,
      40
    );
    camera.position.set(0, 0, 1.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.xr.enabled = true;
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Soft studio lighting + environment for metallic materials
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(1.5, 2.5, 2);
    scene.add(key);

    const content = new THREE.Group();
    scene.add(content);
    contentRef.current = content;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 0.5;
    controls.maxDistance = 6;

    buildContent(experience, content, videoRef, () =>
      onErrorRef.current?.(contentErrorMessage(experience))
    );

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const inXR = renderer.xr.isPresenting;
      if (!inXR) {
        controls.update();
        // Gentle idle float in preview mode
        content.rotation.y += clock.getDelta() * 0.12;
      }
      renderer.render(scene, camera);
    });

    const onResize = () => {
      if (disposed || renderer.xr.isPresenting) return;
      const w = mount.clientWidth;
      const h = Math.max(1, mount.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      window.removeEventListener("resize", onResize);
      renderer.setAnimationLoop(null);
      renderer.xr.getSession()?.end().catch(() => {});
      controls.dispose();
      pmrem.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach((m) => {
            if ("map" in m && m.map instanceof THREE.Texture) m.map.dispose();
            m.dispose();
          });
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.remove();
        videoRef.current = null;
      }
      rendererRef.current = null;
      contentRef.current = null;
    };
    // Rebuild the whole scene if the experience content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    experience.type,
    experience.content.assetUrl,
    experience.content.text,
    experience.content.textStyle?.color,
    experience.content.textStyle?.finish,
  ]);

  return <div ref={mountRef} className="h-full w-full" />;
});

export default PlaneViewer;

function contentErrorMessage(exp: Experience): string {
  switch (exp.type) {
    case "image":
      return "The image couldn’t be loaded. Re-upload it or check the link.";
    case "video":
      return "The video couldn’t be loaded. Use an .mp4/.webm file or a direct video URL.";
    default:
      return "The content couldn’t be loaded.";
  }
}

/** Populate `group` with the experience content (plane, video screen, or 3D text). */
function buildContent(
  exp: Experience,
  group: THREE.Group,
  videoRef: React.MutableRefObject<HTMLVideoElement | null>,
  onError: () => void
) {
  const { content, type } = exp;

  if (type === "image" && content.assetUrl) {
    new THREE.TextureLoader().load(
      content.assetUrl,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        const aspect = tex.image.width / tex.image.height;
        group.add(framedPlane(tex, aspect));
      },
      undefined,
      onError
    );
    return;
  }

  if (type === "video" && content.assetUrl) {
    const video = document.createElement("video");
    video.src = content.assetUrl;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true; // autoplay policy — the viewer exposes an unmute toggle
    video.playsInline = true;
    video.preload = "auto";
    // Keep the element in the DOM (invisible) — some mobile browsers only
    // decode reliably for attached elements, and it makes playback inspectable
    video.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;inset-inline-start:0;top:0";
    video.setAttribute("aria-hidden", "true");
    document.body.appendChild(video);
    videoRef.current = video;

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    const attach = () => {
      const aspect =
        video.videoWidth && video.videoHeight
          ? video.videoWidth / video.videoHeight
          : 16 / 9;
      group.add(framedPlane(tex, aspect));
      video.play().catch(() => {
        // Will start on the user's Start-AR / preview tap instead
      });
    };
    video.addEventListener("loadedmetadata", attach, { once: true });
    video.addEventListener("error", onError, { once: true });
    video.load();
    return;
  }

  if (type === "text" && content.text) {
    const style = content.textStyle ?? { color: "#7ef4dc", finish: "metal" as const };

    // The bundled typeface has Latin glyphs only. Arabic (or any non-Latin)
    // text is rendered through a crisp canvas texture instead, which also
    // shapes RTL script correctly via the browser's own text engine.
    const latinOnly = /^[\x20-\x7E\u00A0-\u00FF]*$/.test(content.text);
    if (!latinOnly) {
      group.add(canvasTextPlane(content.text, style));
      return;
    }

    new FontLoader().load(
      FONT_URL,
      (font) => {
        const geo = new TextGeometry(content.text!, {
          font,
          size: 0.14,
          depth: 0.05,
          curveSegments: 8,
          bevelEnabled: true,
          bevelThickness: 0.008,
          bevelSize: 0.005,
          bevelSegments: 3,
        });
        geo.center();
        const mesh = new THREE.Mesh(geo, textMaterial(style.color, style.finish));
        // Normalize very long strings to ~1 m wide
        geo.computeBoundingBox();
        const width = geo.boundingBox
          ? geo.boundingBox.max.x - geo.boundingBox.min.x
          : 1;
        if (width > 1) mesh.scale.setScalar(1 / width);
        group.add(mesh);
      },
      undefined,
      onError
    );
    return;
  }

  onError();
}

/** Content plane with a thin dark backing frame, ~0.9 m on its longest side. */
function framedPlane(tex: THREE.Texture, aspect: number): THREE.Group {
  const g = new THREE.Group();
  const w = aspect >= 1 ? 0.9 : 0.9 * aspect;
  const h = aspect >= 1 ? 0.9 / aspect : 0.9;

  const frame = new THREE.Mesh(
    new THREE.PlaneGeometry(w + 0.05, h + 0.05),
    new THREE.MeshStandardMaterial({
      color: 0x121724,
      roughness: 0.4,
      metalness: 0.6,
      side: THREE.DoubleSide,
    })
  );
  frame.position.z = -0.006;

  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })
  );

  g.add(frame, face);
  return g;
}

/**
 * Text rendered onto a transparent canvas texture — used for scripts the
 * bundled 3D font can't shape (e.g. Arabic). The browser handles glyph
 * shaping, ligatures, and RTL direction.
 */
function canvasTextPlane(
  text: string,
  style: { color: string; finish: "matte" | "metal" | "neon" }
): THREE.Mesh {
  const fontPx = 220;
  const pad = fontPx * 0.6;
  const font = `700 ${fontPx}px system-ui, "Segoe UI", "Noto Sans Arabic", sans-serif`;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const textW = Math.ceil(ctx.measureText(text).width);
  canvas.width = Math.max(2, textW + pad * 2);
  canvas.height = Math.ceil(fontPx * 1.7);

  // Canvas state resets after resizing — set everything again
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (style.finish === "neon") {
    ctx.shadowColor = style.color;
    ctx.shadowBlur = fontPx * 0.25;
  }
  if (style.finish === "metal") {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.45, style.color);
    grad.addColorStop(1, "#606a80");
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = style.color;
  }
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;

  // ~1 m wide at most, height follows the canvas aspect
  const aspect = canvas.width / canvas.height;
  const w = Math.min(1, aspect * 0.35);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w / aspect),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false,
    })
  );
  return mesh;
}

function textMaterial(
  color: string,
  finish: "matte" | "metal" | "neon"
): THREE.MeshStandardMaterial {
  switch (finish) {
    case "matte":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
    case "metal":
      return new THREE.MeshStandardMaterial({ color, roughness: 0.18, metalness: 0.95 });
    case "neon":
      return new THREE.MeshStandardMaterial({
        color: 0x0b0e16,
        emissive: new THREE.Color(color),
        emissiveIntensity: 2.4,
        roughness: 0.35,
        metalness: 0.1,
      });
  }
}
