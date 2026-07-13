"use client";

/**
 * Hand-built animated USDZ for themed posters.
 *
 * Apple's on-device GLB→USDZ conversion drops animations, so iOS Quick Look
 * showed the baked birthday scene frozen. This module authors the scene
 * directly in USDA text — poster & banner as textured meshes, balloons as
 * native USD Sphere prims, confetti as merged quads — with transform
 * `timeSamples` animation (balloon bobbing, banner float/pulse/spin), then
 * packs it as a USDZ: an uncompressed ZIP whose file payloads are 64-byte
 * aligned, per the USDZ spec.
 */
import type { SceneConfig } from "./types";

export interface ThemedUsdzInputs {
  posterPng: Uint8Array;
  /** Poster size in metres (width, height) */
  w: number;
  h: number;
  bannerPng: Uint8Array | null;
  bw: number;
  bh: number;
  scene: SceneConfig;
  /** Optional soundtrack embedded via Apple's preliminary audio schema */
  audio?: ThemedUsdzAudio | null;
}

export interface ThemedUsdzAudio {
  data: Uint8Array;
  /** File extension incl. dot — Quick Look accepts .mp3 / .m4a / .wav */
  ext: string;
  loop: boolean;
}

const BALLOON_COLORS: [number, number, number][] = [
  [1.0, 0.42, 0.54],
  [0.27, 0.89, 0.78],
  [1.0, 0.79, 0.3],
  [0.55, 0.42, 0.96],
  [0.43, 0.91, 1.0],
  [1.0, 0.62, 0.37],
];

const FPS = 24;

export function buildThemedUsdz(inp: ThemedUsdzInputs): Blob {
  const usda = buildUsda(inp);
  const files: { name: string; data: Uint8Array }[] = [
    { name: "model.usda", data: new TextEncoder().encode(usda) },
    { name: "textures/poster.png", data: inp.posterPng },
  ];
  if (inp.bannerPng) files.push({ name: "textures/banner.png", data: inp.bannerPng });
  if (inp.audio) files.push({ name: `audio/track${inp.audio.ext}`, data: inp.audio.data });
  return new Blob([packUsdz(files) as BlobPart], { type: "model/vnd.usdz+zip" });
}

/* ------------------------------ USDA authoring --------------------------- */

const f = (n: number) => (Object.is(n, -0) ? 0 : Math.round(n * 1e5) / 1e5);
const v3 = (x: number, y: number, z: number) => `(${f(x)}, ${f(y)}, ${f(z)})`;

function buildUsda(inp: ThemedUsdzInputs): string {
  const { w, h, scene } = inp;
  const endTime = FPS * 12; // 12 s master loop (balloon periods divide nicely)
  const parts: string[] = [];

  parts.push(`#usda 1.0
(
    defaultPrim = "Root"
    metersPerUnit = 1
    upAxis = "Y"
    startTimeCode = 0
    endTimeCode = ${endTime}
    timeCodesPerSecond = ${FPS}
)

def Xform "Root"
{`);

  /* poster */
  parts.push(quadMesh("Poster", w, h, "posterMat", 0));

  /* banner */
  const bannerText = (scene.bannerText ?? "").trim();
  if (bannerText && inp.bannerPng) {
    const baseY = h + 0.06;
    const anim = scene.bannerAnimation ?? "float";
    let ops = `        double3 xformOp:translate = ${v3(0, baseY, 0.02)}
        uniform token[] xformOpOrder = ["xformOp:translate"]`;
    if (anim === "float") {
      ops = `        float3 xformOp:translate.timeSamples = {
${sineSamples(endTime, (ph) => v3(0, baseY + Math.sin(ph * Math.PI * 2 * (12 / 2.8)) * 0.03, 0.02))}
        }
        uniform token[] xformOpOrder = ["xformOp:translate"]`;
    } else if (anim === "pulse") {
      ops = `        double3 xformOp:translate = ${v3(0, baseY, 0.02)}
        float3 xformOp:scale.timeSamples = {
${sineSamples(endTime, (ph) => {
        const s = 1 + Math.sin(ph * Math.PI * 2 * (12 / 2.4)) * 0.06;
        return v3(s, s, s);
      })}
        }
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]`;
    } else if (anim === "spin") {
      ops = `        double3 xformOp:translate = ${v3(0, baseY, 0.02)}
        float xformOp:rotateY.timeSamples = {
            0: 0,
            ${endTime / 2}: 360,
            ${endTime}: 720
        }
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:rotateY"]`;
    }
    parts.push(`
    def Xform "Banner"
    {
${ops}
${quadMesh("BannerGeo", inp.bw, inp.bh, "bannerMat", 2)}
    }`);
  }

  /* balloons — native Sphere prims with bobbing translate timeSamples */
  if (scene.balloons !== false) {
    const r = 0.07 * (w / 0.9);
    for (let i = 0; i < 6; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const bx = side * (0.6 + (i % 3) * 0.12) * w;
      const by = h * (0.35 + ((i * 37) % 50) / 100);
      const bz = (-0.06 + (i % 3) * 0.06) * w;
      const period = 2.4 + (i % 3) * 0.5;
      const phase = i * 0.4;
      parts.push(`
    def Xform "Balloon${i}"
    {
        float3 xformOp:translate.timeSamples = {
${sineSamples(endTime, (ph) =>
        v3(bx, by + Math.sin(ph * Math.PI * 2 * (12 / period) + phase) * 0.045, bz)
      )}
        }
        double3 xformOp:scale = ${v3(1, 1.18, 1)}
        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:scale"]

        def Sphere "geo"
        {
            double radius = ${f(r)}
            rel material:binding = </Root/Materials/balloonMat${i % BALLOON_COLORS.length}>
        }
    }`);
    }
  }

  /* confetti — merged quads per colour, gentle group sway */
  if (scene.confetti !== false) {
    for (let ci = 0; ci < BALLOON_COLORS.length; ci++) {
      parts.push(confettiMesh(ci, 10, w, h, endTime));
    }
  }

  /* soundtrack — Apple's preliminary audio schema (Quick Look plays it
     while the AR session runs; other USD tools simply ignore the prim) */
  if (inp.audio) {
    parts.push(`
    def Preliminary_AudioSpatialAudio "Soundtrack"
    {
        uniform asset preliminary:reference = @audio/track${inp.audio.ext}@
        uniform token preliminary:auralMode = "nonSpatial"
        uniform token preliminary:playbackMode = "${inp.audio.loop ? "loopFromStage" : "onceImmediate"}"
        uniform double preliminary:gain = 1
    }`);
  }

  /* materials */
  parts.push(`
    def Scope "Materials"
    {
${textureMaterial("posterMat", "textures/poster.png", false)}
${inp.bannerPng ? textureMaterial("bannerMat", "textures/banner.png", true) : ""}
${BALLOON_COLORS.map((c, i) => colorMaterial(`balloonMat${i}`, c, 0.3)).join("\n")}
${BALLOON_COLORS.map((c, i) => colorMaterial(`confettiMat${i}`, c, 0.9)).join("\n")}
    }
}
`);
  return parts.join("\n");
}

/** 8 sine keyframes across the master loop (start == end → seamless loop). */
function sineSamples(endTime: number, at: (phase01: number) => string): string {
  const STEPS = 48;
  const lines: string[] = [];
  for (let s = 0; s <= STEPS; s++) {
    const t = Math.round((s / STEPS) * endTime);
    lines.push(`            ${t}: ${at(s / STEPS)},`);
  }
  return lines.join("\n");
}

/** Vertical textured quad, y 0..h, facing +Z. */
function quadMesh(name: string, w: number, h: number, mat: string, indent: number): string {
  const pad = " ".repeat(4 + indent);
  return `
${pad}def Mesh "${name}"
${pad}{
${pad}    int[] faceVertexCounts = [3, 3]
${pad}    int[] faceVertexIndices = [0, 1, 2, 0, 2, 3]
${pad}    point3f[] points = [${v3(-w / 2, 0, 0)}, ${v3(w / 2, 0, 0)}, ${v3(w / 2, h, 0)}, ${v3(-w / 2, h, 0)}]
${pad}    normal3f[] normals = [(0, 0, 1), (0, 0, 1), (0, 0, 1), (0, 0, 1)] (
${pad}        interpolation = "vertex"
${pad}    )
${pad}    texCoord2f[] primvars:st = [(0, 0), (1, 0), (1, 1), (0, 1)] (
${pad}        interpolation = "vertex"
${pad}    )
${pad}    uniform token subdivisionScheme = "none"
${pad}    uniform bool doubleSided = 1
${pad}    rel material:binding = </Root/Materials/${mat}>
${pad}}`;
}

function confettiMesh(seed: number, count: number, w: number, h: number, endTime: number): string {
  const rnd = (n: number) => {
    const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const qw = 0.016, qh = 0.026;
  const pts: string[] = [];
  const idx: number[] = [];
  const counts: number[] = [];
  for (let i = 0; i < count; i++) {
    const cx = (rnd(i * 3 + 1) - 0.5) * 1.6 * w;
    const cy = rnd(i * 3 + 2) * (h + 0.35);
    const cz = (rnd(i * 3 + 3) - 0.5) * 0.5 * w;
    const rxa = rnd(i * 5) * Math.PI, rza = rnd(i * 7) * Math.PI;
    const cosx = Math.cos(rxa), sinx = Math.sin(rxa), cosz = Math.cos(rza), sinz = Math.sin(rza);
    const ux = [cosz * qw, sinz * qw, 0];
    const uy = [-sinz * cosx * qh, cosz * cosx * qh, sinx * qh];
    const base = pts.length;
    for (const [sx, sy] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      pts.push(v3(cx + ux[0] * sx + uy[0] * sy, cy + ux[1] * sx + uy[1] * sy, cz + ux[2] * sx + uy[2] * sy));
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    counts.push(3, 3);
  }
  // subtle group sway so the sprinkle feels alive on iOS too
  const amp = 0.02;
  return `
    def Xform "Confetti${seed}"
    {
        float3 xformOp:translate.timeSamples = {
${sineSamples(endTime, (ph) => v3(Math.sin(ph * Math.PI * 2 * 3 + seed) * amp, Math.cos(ph * Math.PI * 2 * 2 + seed) * amp, 0))}
        }
        uniform token[] xformOpOrder = ["xformOp:translate"]

        def Mesh "geo"
        {
            int[] faceVertexCounts = [${counts.join(", ")}]
            int[] faceVertexIndices = [${idx.join(", ")}]
            point3f[] points = [${pts.join(", ")}]
            uniform token subdivisionScheme = "none"
            uniform bool doubleSided = 1
            rel material:binding = </Root/Materials/confettiMat${seed}>
        }
    }`;
}

function textureMaterial(name: string, file: string, alpha: boolean): string {
  return `        def Material "${name}"
        {
            token outputs:surface.connect = </Root/Materials/${name}/PBRShader.outputs:surface>

            def Shader "PBRShader"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor.connect = </Root/Materials/${name}/diffuseTexture.outputs:rgb>${
                  alpha
                    ? `
                float inputs:opacity.connect = </Root/Materials/${name}/diffuseTexture.outputs:a>`
                    : ""
                }
                float inputs:metallic = 0
                float inputs:roughness = 0.9
                token outputs:surface
            }

            def Shader "stReader"
            {
                uniform token info:id = "UsdPrimvarReader_float2"
                token inputs:varname = "st"
                float2 outputs:result
            }

            def Shader "diffuseTexture"
            {
                uniform token info:id = "UsdUVTexture"
                asset inputs:file = @${file}@
                float2 inputs:st.connect = </Root/Materials/${name}/stReader.outputs:result>
                token inputs:wrapS = "repeat"
                token inputs:wrapT = "repeat"
                float3 outputs:rgb
                float outputs:a
            }
        }`;
}

function colorMaterial(name: string, c: [number, number, number], roughness: number): string {
  return `        def Material "${name}"
        {
            token outputs:surface.connect = </Root/Materials/${name}/PBRShader.outputs:surface>

            def Shader "PBRShader"
            {
                uniform token info:id = "UsdPreviewSurface"
                color3f inputs:diffuseColor = ${v3(c[0], c[1], c[2])}
                float inputs:metallic = 0.05
                float inputs:roughness = ${roughness}
                token outputs:surface
            }
        }`;
}

/* --------------------------- USDZ (zip) packing --------------------------- */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Store-only zip with each payload aligned to 64 bytes (USDZ requirement). */
function packUsdz(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (n: number) => new Uint8Array([n & 0xff, (n >> 8) & 0xff]);
  const u32 = (n: number) =>
    new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff]);

  for (const file of files) {
    const name = new TextEncoder().encode(file.name);
    const crc = crc32(file.data);
    // Pad with a zip "extra" field so payload starts on a 64-byte boundary
    let extraLen = (64 - ((offset + 30 + name.length) % 64)) % 64;
    if (extraLen > 0 && extraLen < 4) extraLen += 64;
    const extra = new Uint8Array(extraLen);
    if (extraLen >= 4) {
      extra.set(u16(0x1986), 0); // arbitrary private extra-field id
      extra.set(u16(extraLen - 4), 2);
    }

    const header = new Uint8Array(30);
    header.set(u32(0x04034b50), 0);
    header.set(u16(20), 4); // version needed
    header.set(u16(0), 6); // flags
    header.set(u16(0), 8); // method: stored
    header.set(u16(0), 10); // time
    header.set(u16(0x21), 12); // date (some readers dislike 0)
    header.set(u32(crc), 14);
    header.set(u32(file.data.length), 18);
    header.set(u32(file.data.length), 22);
    header.set(u16(name.length), 26);
    header.set(u16(extraLen), 28);

    const localOffset = offset;
    chunks.push(header, name, extra, file.data);
    offset += 30 + name.length + extraLen + file.data.length;

    const cd = new Uint8Array(46);
    cd.set(u32(0x02014b50), 0);
    cd.set(u16(20), 4); // version made by
    cd.set(u16(20), 6); // version needed
    cd.set(u16(0), 8);
    cd.set(u16(0), 10);
    cd.set(u16(0), 12);
    cd.set(u16(0x21), 14);
    cd.set(u32(crc), 16);
    cd.set(u32(file.data.length), 20);
    cd.set(u32(file.data.length), 24);
    cd.set(u16(name.length), 28);
    cd.set(u16(0), 30); // central extra len
    cd.set(u16(0), 32); // comment len
    cd.set(u16(0), 34); // disk
    cd.set(u16(0), 36); // internal attrs
    cd.set(u32(0), 38); // external attrs
    cd.set(u32(localOffset), 42);
    central.push(cd, name);
  }

  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const eocd = new Uint8Array(22);
  eocd.set(u32(0x06054b50), 0);
  eocd.set(u16(0), 4);
  eocd.set(u16(0), 6);
  eocd.set(u16(files.length), 8);
  eocd.set(u16(files.length), 10);
  eocd.set(u32(cdSize), 12);
  eocd.set(u32(cdStart), 16);
  eocd.set(u16(0), 20);

  const total = offset + cdSize + 22;
  const out = new Uint8Array(total);
  let p = 0;
  for (const c of [...chunks, ...central, eocd]) {
    out.set(c, p);
    p += c.length;
  }
  return out;
}
