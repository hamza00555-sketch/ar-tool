/**
 * Generates the "AR model" companion for image experiences: fetches the
 * uploaded image, wraps it in a poster-plane GLB, stores the GLB next to the
 * other assets, and returns its URL. Never throws — AR-model generation is a
 * bonus; failures just leave the experience without native camera AR.
 */
import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getSupabaseConfig } from "./env";
import { SupabaseStore } from "./supabase-store";
import { glbCompatibleMime, imageToGlb } from "./image-to-glb";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

export async function generateImageArModel(assetUrl: string): Promise<string | null> {
  try {
    const mime = glbCompatibleMime(assetUrl);
    if (!mime) return null; // webp/gif can't be embedded in glTF

    let bytes: Uint8Array;
    if (assetUrl.startsWith("/api/files/")) {
      // Local dev mode — read straight from the upload dir
      const name = path.basename(assetUrl);
      bytes = new Uint8Array(await fs.readFile(path.join(UPLOAD_DIR, name)));
    } else {
      const res = await fetch(assetUrl);
      if (!res.ok) throw new Error(`fetching image failed (${res.status})`);
      bytes = new Uint8Array(await res.arrayBuffer());
    }

    const glb = await imageToGlb(bytes, mime);

    const cfg = getSupabaseConfig();
    if (cfg) {
      const store = SupabaseStore.fromConfig(cfg);
      return await store.uploadAsset(
        `model-from-image/${nanoid(12)}.glb`,
        glb,
        "model/gltf-binary"
      );
    }
    const name = `${nanoid(12)}.glb`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, name), glb);
    return `/api/files/${name}`;
  } catch (e) {
    console.error("[ar-model] poster GLB generation failed:", e);
    return null;
  }
}
