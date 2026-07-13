"use client";

import * as THREE from "three";

/**
 * iOS Safari (and some Android GPUs) reject WebGL textures above 4096 px —
 * a modern phone photo (up to ~8000 px) simply renders black. Downscale
 * anything larger than this before it becomes a texture.
 */
const MAX_TEXTURE_DIM = 2048;

export function loadSafeTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const { width, height } = img;
        const max = Math.max(width, height);
        let tex: THREE.Texture;
        if (max > MAX_TEXTURE_DIM) {
          const scale = MAX_TEXTURE_DIM / max;
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(width * scale));
          canvas.height = Math.max(1, Math.round(height * scale));
          canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
          tex = new THREE.CanvasTexture(canvas);
        } else {
          tex = new THREE.Texture(img);
          tex.needsUpdate = true;
        }
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        resolve(tex);
      } catch (e) {
        reject(e instanceof Error ? e : new Error("texture creation failed"));
      }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = url;
  });
}
