"use client";

/**
 * Bakes a themed poster experience into a single GLB so it can ride the
 * native AR pipeline (Quick Look on iOS, Scene Viewer on Android) and get
 * REAL world tracking — identical to plain 3D-model experiences.
 *
 * Contents: standing poster plane + banner-text plane (rendered to a PNG via
 * canvas, so Arabic shaping is correct) + balloons + static confetti, plus
 * glTF animations (balloon bobbing, banner float/pulse/spin). Android plays
 * the animations; Apple's USDZ conversion drops them (static but tracked).
 *
 * Runs entirely in the browser at save time (@gltf-transform/core is pure JS).
 */
import { Document, WebIO, type Node as GltfNode } from "@gltf-transform/core";
import {
  buildThemedUsdz,
  type ThemedUsdzAudio,
  type ThemedUsdzInputs,
} from "./bake-theme-usdz";
import type { SceneConfig } from "./types";

const BALLOON_COLORS: [number, number, number][] = [
  [1.0, 0.42, 0.54],
  [0.27, 0.89, 0.78],
  [1.0, 0.79, 0.3],
  [0.55, 0.42, 0.96],
  [0.43, 0.91, 1.0],
  [1.0, 0.62, 0.37],
];

export interface ThemedAssets {
  /** For Android Scene Viewer / web preview — animations play */
  glb: Blob;
  /** For iOS Quick Look — hand-authored so animations survive */
  usdz: Blob;
  /** True when the soundtrack got embedded into the USDZ */
  audioEmbedded: boolean;
}

export async function bakeThemedPosterAssets(
  imageUrl: string,
  scene: SceneConfig,
  /** Soundtrack to embed in the USDZ so Quick Look plays it natively */
  audio?: { url: string; loop: boolean } | null
): Promise<ThemedAssets> {
  /* ---- rasterize once (canvas: shaping-safe text, size-safe poster) ---- */
  const posterCanvas = await imageToCanvas(imageUrl, 2048);
  const posterPng = await canvasPng(posterCanvas);
  const aspect = posterCanvas.width / posterCanvas.height;
  const w = aspect >= 1 ? 0.9 : 0.9 * aspect;
  const h = aspect >= 1 ? 0.9 / aspect : 0.9;

  let bannerPng: Uint8Array | null = null;
  let bw = 0;
  let bh = 0;
  const bannerText = (scene.bannerText ?? "").trim();
  if (bannerText) {
    const bc = renderBannerCanvas(bannerText, scene.bannerColor ?? "#ffc94d");
    bannerPng = await canvasPng(bc);
    const bAspect = bc.width / bc.height;
    bw = Math.min(1.15 * w, bAspect * 0.22);
    bh = bw / bAspect;
  }

  // The soundtrack goes into the USDZ only — glTF has no audio, and the web
  // viewer plays the same file straight from its URL. Non-fatal on failure.
  let usdzAudio: ThemedUsdzAudio | null = null;
  if (audio) {
    try {
      const ext = "." + (audio.url.split(".").pop() ?? "").toLowerCase().split("?")[0];
      if ([".mp3", ".m4a", ".wav"].includes(ext)) {
        const res = await fetch(audio.url);
        if (res.ok) {
          usdzAudio = {
            data: new Uint8Array(await res.arrayBuffer()),
            ext,
            loop: audio.loop,
          };
        }
      }
    } catch (e) {
      console.error("soundtrack embed failed", e);
    }
  }

  const inputs: ThemedUsdzInputs = {
    posterPng, w, h, bannerPng, bw, bh, scene,
    audio: usdzAudio,
  };
  return {
    glb: await buildGlb(inputs),
    usdz: buildThemedUsdz(inputs),
    audioEmbedded: usdzAudio !== null,
  };
}

async function buildGlb(inp: ThemedUsdzInputs): Promise<Blob> {
  const { posterPng, w, h, scene } = inp;

  const doc = new Document();
  const buffer = doc.createBuffer();
  const gltfScene = doc.createScene("Scene");
  doc.getRoot().setDefaultScene(gltfScene);

  const anim = doc.createAnimation("celebrate");

  /* ------------------------------- poster -------------------------------- */
  const posterTex = doc.createTexture("poster").setImage(posterPng).setMimeType("image/png");
  const posterMat = doc
    .createMaterial("poster")
    .setBaseColorTexture(posterTex)
    .setMetallicFactor(0)
    .setRoughnessFactor(0.9)
    .setDoubleSided(true);
  const posterPrim = quadPrim(doc, buffer, w, h).setMaterial(posterMat);
  gltfScene.addChild(
    doc.createNode("Poster").setMesh(doc.createMesh("poster").addPrimitive(posterPrim))
  );

  /* ------------------------------- banner -------------------------------- */
  if (inp.bannerPng) {
    const { bannerPng, bw, bh } = inp;
    const tex = doc.createTexture("banner").setImage(bannerPng).setMimeType("image/png");
    const mat = doc
      .createMaterial("banner")
      .setBaseColorTexture(tex)
      .setMetallicFactor(0)
      .setRoughnessFactor(0.85)
      .setAlphaMode("BLEND")
      .setDoubleSided(true);
    const prim = quadPrim(doc, buffer, bw, bh).setMaterial(mat);
    const baseY = h + 0.06;
    const node = doc
      .createNode("Banner")
      .setMesh(doc.createMesh("banner").addPrimitive(prim))
      .setTranslation([0, baseY, 0.02]);
    gltfScene.addChild(node);
    addBannerAnimation(doc, buffer, anim, node, scene.bannerAnimation ?? "float", baseY);
  }

  /* ------------------------------ balloons ------------------------------- */
  if (scene.balloons !== false) {
    const sphere = uvSphere(0.07 * (w / 0.9), 18, 14);
    for (let i = 0; i < 6; i++) {
      const c = BALLOON_COLORS[i % BALLOON_COLORS.length];
      const mat = doc
        .createMaterial(`balloon${i}`)
        .setBaseColorFactor([c[0], c[1], c[2], 1])
        .setMetallicFactor(0.05)
        .setRoughnessFactor(0.3);
      const prim = meshPrim(doc, buffer, sphere).setMaterial(mat);
      const side = i % 2 === 0 ? -1 : 1;
      const base: [number, number, number] = [
        side * (0.6 + (i % 3) * 0.12) * w,
        h * (0.35 + ((i * 37) % 50) / 100),
        (-0.06 + (i % 3) * 0.06) * w,
      ];
      const node = doc
        .createNode(`Balloon${i}`)
        .setMesh(doc.createMesh(`balloon${i}`).addPrimitive(prim))
        .setTranslation(base)
        .setScale([1, 1.18, 1]);
      gltfScene.addChild(node);
      addBobAnimation(doc, buffer, anim, node, base, 0.045, 2.4 + (i % 3) * 0.5, i * 0.4);
    }
  }

  /* --------------------------- confetti (static) ------------------------- */
  if (scene.confetti !== false) {
    for (let ci = 0; ci < BALLOON_COLORS.length; ci++) {
      const c = BALLOON_COLORS[ci];
      const mat = doc
        .createMaterial(`confetti${ci}`)
        .setBaseColorFactor([c[0], c[1], c[2], 1])
        .setMetallicFactor(0)
        .setRoughnessFactor(0.9)
        .setDoubleSided(true);
      const merged = confettiCluster(ci, 10, w, h);
      const prim = meshPrim(doc, buffer, merged).setMaterial(mat);
      gltfScene.addChild(
        doc
          .createNode(`Confetti${ci}`)
          .setMesh(doc.createMesh(`confetti${ci}`).addPrimitive(prim))
      );
    }
  }

  if (!anim.listChannels().length) anim.dispose();

  const glb = await new WebIO().writeBinary(doc);
  return new Blob([glb as BlobPart], { type: "model/gltf-binary" });
}

/* ---------------------------- canvas helpers ----------------------------- */

async function imageToCanvas(url: string, maxDim: number): Promise<HTMLCanvasElement> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("poster image load failed"));
    el.src = url;
  });
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function renderBannerCanvas(text: string, colorHex: string): HTMLCanvasElement {
  const fontPx = 180;
  const font = `800 ${fontPx}px system-ui, "Segoe UI", "Noto Sans Arabic", sans-serif`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const wpx = Math.ceil(ctx.measureText(text).width);
  canvas.width = Math.max(2, wpx + fontPx);
  canvas.height = Math.ceil(fontPx * 1.6);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = fontPx * 0.09;
  ctx.shadowOffsetY = fontPx * 0.04;
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, colorHex);
  grad.addColorStop(1, colorHex);
  ctx.fillStyle = grad;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  return canvas;
}

function canvasPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("png encode failed"));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

/* --------------------------- geometry helpers ---------------------------- */

interface MeshData {
  pos: Float32Array<ArrayBuffer>;
  norm: Float32Array<ArrayBuffer>;
  uv: Float32Array<ArrayBuffer>;
  idx: Uint16Array<ArrayBuffer>;
}

/** Vertical quad from y=0..h, centred on x, facing +Z. */
function quadPrim(doc: Document, buffer: ReturnType<Document["createBuffer"]>, w: number, h: number) {
  return meshPrim(doc, buffer, {
    pos: new Float32Array([-w / 2, 0, 0, w / 2, 0, 0, w / 2, h, 0, -w / 2, h, 0]),
    norm: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
    uv: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
    idx: new Uint16Array([0, 1, 2, 0, 2, 3]),
  });
}

function meshPrim(
  doc: Document,
  buffer: ReturnType<Document["createBuffer"]>,
  data: MeshData
) {
  const pos = doc.createAccessor().setType("VEC3").setArray(data.pos).setBuffer(buffer);
  const norm = doc.createAccessor().setType("VEC3").setArray(data.norm).setBuffer(buffer);
  const uv = doc.createAccessor().setType("VEC2").setArray(data.uv).setBuffer(buffer);
  const idx = doc.createAccessor().setType("SCALAR").setArray(data.idx).setBuffer(buffer);
  return doc
    .createPrimitive()
    .setAttribute("POSITION", pos)
    .setAttribute("NORMAL", norm)
    .setAttribute("TEXCOORD_0", uv)
    .setIndices(idx);
}

function uvSphere(radius: number, widthSeg: number, heightSeg: number): MeshData {
  const pos: number[] = [], norm: number[] = [], uv: number[] = [], idx: number[] = [];
  for (let y = 0; y <= heightSeg; y++) {
    const v = y / heightSeg;
    const phi = v * Math.PI;
    for (let x = 0; x <= widthSeg; x++) {
      const u = x / widthSeg;
      const theta = u * Math.PI * 2;
      const nx = Math.sin(phi) * Math.cos(theta);
      const ny = Math.cos(phi);
      const nz = Math.sin(phi) * Math.sin(theta);
      pos.push(nx * radius, ny * radius, nz * radius);
      norm.push(nx, ny, nz);
      uv.push(u, v);
    }
  }
  const row = widthSeg + 1;
  for (let y = 0; y < heightSeg; y++) {
    for (let x = 0; x < widthSeg; x++) {
      const a = y * row + x, b = a + row;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return {
    pos: new Float32Array(pos),
    norm: new Float32Array(norm),
    uv: new Float32Array(uv),
    idx: new Uint16Array(idx),
  };
}

/** ~N tiny quads sprinkled around the poster, transforms baked into vertices. */
function confettiCluster(seed: number, count: number, w: number, h: number): MeshData {
  const pos: number[] = [], norm: number[] = [], uv: number[] = [], idx: number[] = [];
  const rnd = (n: number) => {
    const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const qw = 0.016, qh = 0.026;
  for (let i = 0; i < count; i++) {
    const cx = (rnd(i * 3 + 1) - 0.5) * 1.6 * w;
    const cy = rnd(i * 3 + 2) * (h + 0.35);
    const cz = (rnd(i * 3 + 3) - 0.5) * 0.5 * w;
    const rx = rnd(i * 5) * Math.PI, rz = rnd(i * 7) * Math.PI;
    // rotated quad basis
    const cosx = Math.cos(rx), sinx = Math.sin(rx), cosz = Math.cos(rz), sinz = Math.sin(rz);
    const ux = [cosz * qw, sinz * qw, 0];
    const uy = [-sinz * cosx * qh, cosz * cosx * qh, sinx * qh];
    const base = pos.length / 3;
    const corners = [
      [-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5],
    ];
    for (const [sx, sy] of corners) {
      pos.push(cx + ux[0] * sx + uy[0] * sy, cy + ux[1] * sx + uy[1] * sy, cz + ux[2] * sx + uy[2] * sy);
      norm.push(0, 0, 1);
      uv.push(sx + 0.5, 0.5 - sy);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return {
    pos: new Float32Array(pos),
    norm: new Float32Array(norm),
    uv: new Float32Array(uv),
    idx: new Uint16Array(idx),
  };
}

/* --------------------------- animation helpers --------------------------- */

function timeAccessor(doc: Document, buffer: ReturnType<Document["createBuffer"]>, times: number[]) {
  return doc.createAccessor().setType("SCALAR").setArray(new Float32Array(times)).setBuffer(buffer);
}

/** Sine-sampled vertical bob around a base translation. */
function addBobAnimation(
  doc: Document,
  buffer: ReturnType<Document["createBuffer"]>,
  anim: ReturnType<Document["createAnimation"]>,
  node: GltfNode,
  base: [number, number, number],
  amp: number,
  period: number,
  phase: number
) {
  const STEPS = 8;
  const times: number[] = [], values: number[] = [];
  for (let s = 0; s <= STEPS; s++) {
    const t = (s / STEPS) * period;
    times.push(t);
    values.push(base[0], base[1] + Math.sin((t / period) * Math.PI * 2 + phase) * amp, base[2]);
  }
  // Loop-safe: last keyframe equals first offset by full cycle phase
  const sampler = doc
    .createAnimationSampler()
    .setInput(timeAccessor(doc, buffer, times))
    .setOutput(doc.createAccessor().setType("VEC3").setArray(new Float32Array(values)).setBuffer(buffer))
    .setInterpolation("LINEAR");
  anim.addSampler(sampler);
  const channel = doc.createAnimationChannel().setTargetNode(node).setTargetPath("translation").setSampler(sampler);
  anim.addChannel(channel);
}

function addBannerAnimation(
  doc: Document,
  buffer: ReturnType<Document["createBuffer"]>,
  anim: ReturnType<Document["createAnimation"]>,
  node: GltfNode,
  kind: SceneConfig["bannerAnimation"],
  baseY: number
) {
  if (kind === "none") return;
  if (kind === "spin") {
    const times = [0, 1.5, 3, 4.5, 6];
    const quats: number[] = [];
    for (const t of times) {
      const a = (t / 6) * Math.PI * 2;
      quats.push(0, Math.sin(a / 2), 0, Math.cos(a / 2));
    }
    const sampler = doc
      .createAnimationSampler()
      .setInput(timeAccessor(doc, buffer, times))
      .setOutput(doc.createAccessor().setType("VEC4").setArray(new Float32Array(quats)).setBuffer(buffer))
      .setInterpolation("LINEAR");
    anim.addSampler(sampler);
    const ch = doc.createAnimationChannel().setTargetNode(node).setTargetPath("rotation").setSampler(sampler);
    anim.addChannel(ch);
    return;
  }
  if (kind === "pulse") {
    const times = [0, 0.6, 1.2, 1.8, 2.4];
    const scales = [1, 1.06, 1, 0.94, 1].flatMap((s) => [s, s, s]);
    const sampler = doc
      .createAnimationSampler()
      .setInput(timeAccessor(doc, buffer, times))
      .setOutput(doc.createAccessor().setType("VEC3").setArray(new Float32Array(scales)).setBuffer(buffer))
      .setInterpolation("LINEAR");
    anim.addSampler(sampler);
    const ch = doc.createAnimationChannel().setTargetNode(node).setTargetPath("scale").setSampler(sampler);
    anim.addChannel(ch);
    return;
  }
  // float (default)
  addBobAnimation(doc, buffer, anim, node, [0, baseY, 0.02], 0.03, 2.8, 0);
}
