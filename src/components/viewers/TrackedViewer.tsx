"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { buildDecorations } from "@/lib/scene-decorations";
import { loadSafeTexture } from "@/lib/safe-texture";
import type { Experience } from "@/lib/types";

export interface TrackedViewerHandle {
  /** Ask for the camera and start tracking. Rejects on permission denial. */
  start(): Promise<void>;
  getVideoEl(): HTMLVideoElement | null;
}

/**
 * Image-tracking viewer: our own thin bridge between MindAR's core
 * Controller (feature matching + pose estimation, no three.js dependency)
 * and modern three.js. Replicates the official MindARThree wrapper's
 * anchor/projection math, which targets an older three API.
 *
 * Anchor space: origin at the target-image centre, X right, Y up,
 * Z out of the image; 1 unit = the printed image's width.
 */
const TrackedViewer = forwardRef<
  TrackedViewerHandle,
  {
    experience: Experience;
    onTargetVisible?: (visible: boolean) => void;
    onError?: (kind: "camera" | "tracker" | "content") => void;
  }
>(function TrackedViewer({ experience, onTargetVisible, onError }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const startedRef = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onTargetVisibleRef = useRef(onTargetVisible);
  const onErrorRef = useRef(onError);
  onTargetVisibleRef.current = onTargetVisible;
  onErrorRef.current = onError;

  useImperativeHandle(ref, () => ({
    async start() {
      if (startedRef.current) return;
      startedRef.current = true;
      try {
        await startTracking();
      } catch (e) {
        startedRef.current = false;
        throw e;
      }
    },
    getVideoEl() {
      return videoRef.current;
    },
  }));

  async function startTracking() {
    const container = containerRef.current;
    const { mindUrl, assetUrl } = experience.content;
    if (!container || !mindUrl || !assetUrl) return;

    /* ---- camera ---- */
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "environment" },
      });
    } catch {
      onErrorRef.current?.("camera");
      throw new Error("camera");
    }

    const video = document.createElement("video");
    video.setAttribute("autoplay", "");
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.style.cssText = "position:absolute;top:0;left:0;z-index:0";
    container.appendChild(video);
    video.srcObject = stream;
    await new Promise<void>((res) => {
      video.addEventListener("loadedmetadata", () => res(), { once: true });
    });
    video.play().catch(() => {});

    /* ---- three scene ---- */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.cssText = "position:absolute;top:0;left:0;z-index:1";
    container.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(1, 2, 2);
    scene.add(key);

    const anchor = new THREE.Group();
    anchor.visible = false;
    anchor.matrixAutoUpdate = false;
    scene.add(anchor);

    /* ---- MindAR controller ---- */
    const { Controller } = await import("mind-ar/dist/mindar-image.prod.js");
    let targetVisible = false;
    let postMatrix = new THREE.Matrix4();
    const invisibleMatrix = new THREE.Matrix4().set(0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,1);

    const controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: 1,
      onUpdate: (data) => {
        // Lightweight diagnostics, readable from the console on any device
        const w = window as unknown as { __holoformTracker?: { updates: number; found: number } };
        w.__holoformTracker ??= { updates: 0, found: 0 };
        w.__holoformTracker.updates++;
        if (data.type !== "updateMatrix" || data.targetIndex !== 0) return;
        if (data.worldMatrix != null) w.__holoformTracker.found++;
        const { worldMatrix } = data;
        anchor.visible = worldMatrix != null;
        if (worldMatrix != null) {
          const m = new THREE.Matrix4();
          m.elements = [...worldMatrix] as THREE.Matrix4["elements"];
          m.multiply(postMatrix);
          anchor.matrix.copy(m);
        } else {
          anchor.matrix.copy(invisibleMatrix);
        }
        const nowVisible = worldMatrix != null;
        if (nowVisible !== targetVisible) {
          targetVisible = nowVisible;
          onTargetVisibleRef.current?.(nowVisible);
        }
      },
    });

    /* ---- layout: video cover-fit + camera projection (official math) ---- */
    const resize = () => {
      const cw = container.clientWidth;
      const ch = Math.max(1, container.clientHeight);
      const videoRatio = video.videoWidth / video.videoHeight;
      const containerRatio = cw / ch;
      let vw: number, vh: number;
      if (videoRatio > containerRatio) {
        vh = ch; vw = vh * videoRatio;
      } else {
        vw = cw; vh = vw / videoRatio;
      }
      const proj = controller.getProjectionMatrix();
      const inputRatio = controller.inputWidth / controller.inputHeight;
      let videoDisplayHeight: number;
      if (inputRatio > containerRatio) {
        videoDisplayHeight = ch * (vh / video.videoHeight) * (video.videoHeight / controller.inputHeight);
      } else {
        videoDisplayHeight = (cw / controller.inputWidth) * controller.inputHeight * (vw / video.videoWidth);
      }
      const fovAdjust = ch / videoDisplayHeight;
      camera.fov = (2 * Math.atan((1 / proj[5]) * fovAdjust) * 180) / Math.PI;
      camera.near = proj[14] / (proj[10] - 1.0);
      camera.far = proj[14] / (proj[10] + 1.0);
      camera.aspect = cw / ch;
      camera.updateProjectionMatrix();

      video.style.width = `${vw}px`;
      video.style.height = `${vh}px`;
      video.style.top = `${-(vh - ch) / 2}px`;
      video.style.left = `${-(vw - cw) / 2}px`;
      renderer.setSize(cw, ch);
      renderer.domElement.style.width = `${cw}px`;
      renderer.domElement.style.height = `${ch}px`;
    };

    /* ---- load target features ---- */
    let dims: [number, number][];
    try {
      const res = await controller.addImageTargets(mindUrl);
      dims = res.dimensions;
    } catch {
      onErrorRef.current?.("tracker");
      throw new Error("tracker");
    }
    const [markerWidth, markerHeight] = dims[0];
    // Anchor at image centre, scaled so 1 unit = image width (official math)
    postMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(markerWidth / 2, markerWidth / 2 + (markerHeight - markerWidth) / 2, 0),
      new THREE.Quaternion(),
      new THREE.Vector3(markerWidth, markerWidth, markerWidth)
    );
    const targetAspect = markerHeight / markerWidth;

    /* ---- content ---- */
    const mixers: THREE.AnimationMixer[] = [];
    buildOverlay(assetUrl, targetAspect, anchor, videoRef, mixers, () =>
      onErrorRef.current?.("content")
    );

    // Themed decorations ride the anchor: they stick to the tracked image too
    const deco = buildDecorations(experience.content.scene);
    if (deco) anchor.add(deco.group);

    resize();
    window.addEventListener("resize", resize);

    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      mixers.forEach((m) => m.update(dt));
      deco?.update(dt);
      renderer.render(scene, camera);
    });

    await controller.dummyRun(video); // tf warm-up
    controller.processVideo(video);

    cleanupRef.current = () => {
      window.removeEventListener("resize", resize);
      try { controller.stopProcessVideo(); controller.dispose(); } catch {}
      renderer.setAnimationLoop(null);
      renderer.dispose();
      renderer.domElement.remove();
      stream.getTracks().forEach((t) => t.stop());
      video.remove();
      if (videoRef.current && videoRef.current !== video) {
        videoRef.current.pause();
        videoRef.current.remove();
        videoRef.current = null;
      }
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
    };
  }

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      startedRef.current = false;
    };
  }, []);

  return <div ref={containerRef} className="relative h-full w-full overflow-hidden" />;
});

export default TrackedViewer;

/** Attach the overlay content (GLB model, video, or image plane) to the anchor. */
function buildOverlay(
  assetUrl: string,
  targetAspect: number,
  anchor: THREE.Group,
  videoRef: React.MutableRefObject<HTMLVideoElement | null>,
  mixers: THREE.AnimationMixer[],
  onError: () => void
) {
  const ext = (assetUrl.split(".").pop() ?? "").toLowerCase().split("?")[0];

  if (ext === "glb" || ext === "gltf") {
    new GLTFLoader().load(
      assetUrl,
      (gltf) => {
        const model = gltf.scene;
        // Normalize: longest side ≈ 0.8 of the image width, standing out of it
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = 0.8 / Math.max(size.x, size.y, size.z, 0.0001);
        model.scale.setScalar(scale);
        box.setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.sub(center); // centre it on the target
        const holder = new THREE.Group();
        holder.add(model);
        holder.rotation.x = Math.PI / 2; // model's "up" points out of the image
        holder.position.z = (box.max.z - box.min.z) / 2;
        anchor.add(holder);
        if (gltf.animations.length) {
          const mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
          mixers.push(mixer);
        }
      },
      undefined,
      onError
    );
    return;
  }

  if (ext === "mp4" || ext === "webm" || ext === "mov") {
    const video = document.createElement("video");
    video.src = assetUrl;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true; // viewer exposes an unmute toggle
    video.playsInline = true;
    video.style.cssText =
      "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;inset-inline-start:0;top:0";
    video.setAttribute("aria-hidden", "true");
    document.body.appendChild(video);
    videoRef.current = video;
    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(1, targetAspect),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    anchor.add(plane); // covers the printed image exactly — “poster comes alive”
    video.addEventListener("error", onError, { once: true });
    video.play().catch(() => {});
    return;
  }

  // image overlay — safe loader downscales beyond-limit phone photos
  loadSafeTexture(assetUrl)
    .then((tex) => {
      const img = tex.image as { width: number; height: number };
      const aspect = img.height / img.width;
      const plane = new THREE.Mesh(
        new THREE.PlaneGeometry(1, aspect),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false })
      );
      plane.position.z = 0.01;
      anchor.add(plane);
    })
    .catch(onError);
}
