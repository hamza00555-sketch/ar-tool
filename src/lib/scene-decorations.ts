"use client";

/**
 * Procedural themed decorations rendered around the main AR content.
 * Everything is generated in code (no downloaded assets), sized for a
 * normalized ~1-unit-wide content space, so the same group works in the
 * plane viewer (1 unit ≈ 1 m) and the tracked viewer (1 unit = target width).
 *
 * buildDecorations() returns a group to add to the scene/anchor plus an
 * update(dt) function to drive the animations from the render loop.
 */
import * as THREE from "three";
import type { SceneConfig } from "./types";

export interface Decorations {
  group: THREE.Group;
  update: (dt: number) => void;
}

const BALLOON_PALETTE = [0xff6b8a, 0x46e3c6, 0xffc94d, 0x8b6cf6, 0x6ee9ff, 0xff9e5e];

export function buildDecorations(scene: SceneConfig | undefined): Decorations | null {
  if (!scene?.theme) return null;
  // Only "birthday" exists today; a switch keeps future themes trivial to add.
  switch (scene.theme) {
    case "birthday":
      return buildBirthday(scene);
    default:
      return null;
  }
}

/* ------------------------------- birthday -------------------------------- */

function buildBirthday(scene: SceneConfig): Decorations {
  const group = new THREE.Group();
  const updaters: ((dt: number, t: number) => void)[] = [];
  let elapsed = 0;

  /* Banner text above the content */
  const text = (scene.bannerText ?? "").trim();
  if (text) {
    const banner = textPlane(text, scene.bannerColor ?? "#ffc94d");
    banner.position.set(0, 0.63, 0.05);
    group.add(banner);
    const anim = scene.bannerAnimation ?? "float";
    const baseY = banner.position.y;
    updaters.push((dt, t) => {
      if (anim === "float") banner.position.y = baseY + Math.sin(t * 1.4) * 0.035;
      else if (anim === "pulse") {
        const s = 1 + Math.sin(t * 2.6) * 0.06;
        banner.scale.setScalar(s);
      } else if (anim === "spin") banner.rotation.y += dt * 1.2;
    });
  }

  /* Balloons floating at the sides */
  if (scene.balloons !== false) {
    const balloons = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const b = balloon(BALLOON_PALETTE[i % BALLOON_PALETTE.length]);
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (0.55 + (i % 3) * 0.13);
      const y = -0.1 + ((i * 37) % 50) / 100;
      b.position.set(x, y, -0.08 + (i % 3) * 0.08);
      balloons.add(b);
      const phase = i * 1.1;
      const baseY = y;
      updaters.push((_dt, t) => {
        b.position.y = baseY + Math.sin(t * 0.9 + phase) * 0.06;
        b.rotation.z = Math.sin(t * 0.7 + phase) * 0.08;
      });
    }
    group.add(balloons);
  }

  /* Confetti — instanced falling particles, looping */
  if (scene.confetti !== false) {
    const COUNT = 130;
    const geo = new THREE.PlaneGeometry(0.018, 0.03);
    // Per-instance colors come from mesh.instanceColor — the material stays
    // white and must NOT enable vertexColors (no vertex color attribute exists).
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, COUNT);
    const colors = new Float32Array(COUNT * 3);
    const particles: { x: number; y: number; z: number; speed: number; rot: number; rotSpeed: number; sway: number }[] = [];
    const color = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      color.setHex(BALLOON_PALETTE[i % BALLOON_PALETTE.length]);
      colors.set([color.r, color.g, color.b], i * 3);
      particles.push({
        x: (pseudo(i * 3 + 1) - 0.5) * 1.5,
        y: pseudo(i * 3 + 2) * 1.6 - 0.3,
        z: (pseudo(i * 3 + 3) - 0.5) * 0.5,
        speed: 0.12 + pseudo(i * 7) * 0.18,
        rot: pseudo(i * 11) * Math.PI * 2,
        rotSpeed: 1 + pseudo(i * 13) * 3,
        sway: 0.5 + pseudo(i * 17),
      });
    }
    mesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
    const dummy = new THREE.Object3D();
    updaters.push((dt, t) => {
      for (let i = 0; i < COUNT; i++) {
        const p = particles[i];
        p.y -= p.speed * dt;
        if (p.y < -0.55) p.y = 1.25; // loop back to the top
        dummy.position.set(p.x + Math.sin(t * p.sway + i) * 0.05, p.y, p.z);
        dummy.rotation.set(p.rot + t * p.rotSpeed, t * p.rotSpeed * 0.7, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    });
    group.add(mesh);
  }

  return {
    group,
    update(dt: number) {
      elapsed += dt;
      for (const u of updaters) u(dt, elapsed);
    },
  };
}

/* -------------------------------- helpers -------------------------------- */

/** Deterministic pseudo-random in [0,1) — keeps layouts stable per index. */
function pseudo(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Crisp text on a transparent canvas plane — browser shaping (Arabic-safe).
 * Built as front + back copies so the text reads correctly from BOTH sides
 * (a single double-sided plane shows mirrored text from behind — noticeable
 * because the preview idles in rotation).
 */
function textPlane(text: string, colorHex: string): THREE.Group {
  const front = textMesh(text, colorHex);
  const back = textMesh(text, colorHex);
  back.rotation.y = Math.PI;
  back.position.z = -0.001;
  front.position.z = 0.001;
  const g = new THREE.Group();
  g.add(front, back);
  return g;
}

function textMesh(text: string, colorHex: string): THREE.Mesh {
  const fontPx = 180;
  const font = `800 ${fontPx}px system-ui, "Segoe UI", "Noto Sans Arabic", sans-serif`;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width);
  canvas.width = Math.max(2, w + fontPx);
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

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const aspect = canvas.width / canvas.height;
  const width = Math.min(1.15, aspect * 0.22);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / aspect),
    new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      side: THREE.FrontSide, // each copy is visible from its own side only
      toneMapped: false,
    })
  );
}

/** A balloon: stretched sphere + knot + hanging string. */
function balloon(colorHex: number): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 20, 16),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3, metalness: 0.05 })
  );
  body.scale.y = 1.18;
  const knot = new THREE.Mesh(
    new THREE.ConeGeometry(0.014, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.5 })
  );
  knot.position.y = -0.086;
  knot.rotation.x = Math.PI;
  const stringGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -0.095, 0),
    new THREE.Vector3(0.012, -0.16, 0),
    new THREE.Vector3(-0.008, -0.23, 0),
  ]);
  const string = new THREE.Line(
    stringGeo,
    new THREE.LineBasicMaterial({ color: 0xd8dbe6, transparent: true, opacity: 0.8 })
  );
  g.add(body, knot, string);
  return g;
}
