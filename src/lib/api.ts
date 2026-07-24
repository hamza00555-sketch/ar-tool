/** Client-side fetch helpers for the Holoform API. */
import type {
  Experience,
  ExperienceInput,
  ExperienceWithStats,
  ScanJob,
} from "./types";

async function handle<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Request failed (${res.status})`
    );
  }
  return data as T;
}

export async function listExperiences(): Promise<ExperienceWithStats[]> {
  const res = await fetch("/api/experiences", { cache: "no-store" });
  return (await handle<{ experiences: ExperienceWithStats[] }>(res)).experiences;
}

export async function getExperience(id: string): Promise<ExperienceWithStats> {
  const res = await fetch(`/api/experiences/${id}`, { cache: "no-store" });
  return (await handle<{ experience: ExperienceWithStats }>(res)).experience;
}

export async function createExperience(
  input: ExperienceInput
): Promise<Experience> {
  const res = await fetch("/api/experiences", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await handle<{ experience: Experience }>(res)).experience;
}

export async function updateExperience(
  id: string,
  patch: Partial<ExperienceInput>
): Promise<Experience> {
  const res = await fetch(`/api/experiences/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return (await handle<{ experience: Experience }>(res)).experience;
}

export async function deleteExperience(id: string): Promise<void> {
  const res = await fetch(`/api/experiences/${id}`, { method: "DELETE" });
  await handle<{ ok: true }>(res);
}

export async function uploadFile(
  file: File,
  kind: "model" | "usdz" | "image" | "video" | "mind" | "audio"
): Promise<{ url: string; originalName: string; size: number }> {
  // Step 1 — ask the server how to upload (validates name/size/kind too)
  const signRes = await fetch("/api/upload/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, kind }),
  });
  const sign = await handle<
    | { mode: "local" }
    | { mode: "supabase"; uploadUrl: string; publicUrl: string; contentType: string }
  >(signRes);

  // Step 2a — Supabase: PUT the file straight to Storage. It never touches
  // our server, so serverless body-size limits don't apply.
  if (sign.mode === "supabase") {
    const put = await fetch(sign.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": sign.contentType, "x-upsert": "false" },
      body: file,
    });
    if (!put.ok) {
      const detail = await put.text().catch(() => "");
      throw new Error(
        `Storage upload failed (HTTP ${put.status})${detail ? `: ${detail.slice(0, 200)}` : ""}`
      );
    }
    return { url: sign.publicUrl, originalName: file.name, size: file.size };
  }

  // Step 2b — local dev: multipart to this server, saved under data/uploads
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  return handle(res);
}

/** Storage mode reported by the server ("supabase" in production, "local" in dev). */
export async function getStorageMode(): Promise<"supabase" | "local"> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    const data = (await res.json()) as { storage?: "supabase" | "local" };
    return data.storage ?? "local";
  } catch {
    return "local";
  }
}

/** Create a 3D-scan job from already-uploaded frame URLs. */
export async function createScanJob(
  title: string,
  frameUrls: string[]
): Promise<ScanJob> {
  const res = await fetch("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, frameUrls }),
  });
  return (await handle<{ job: ScanJob }>(res)).job;
}

export async function getScanJob(id: string): Promise<ScanJob> {
  const res = await fetch(`/api/scan/${id}`, { cache: "no-store" });
  return (await handle<{ job: ScanJob }>(res)).job;
}

export async function trackView(id: string): Promise<void> {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, referrer: document.referrer }),
      keepalive: true,
    });
  } catch {
    // Analytics must never break the viewer
  }
}

/**
 * Public share URL for an experience. NEXT_PUBLIC_APP_URL (the deployed
 * HTTPS domain) wins so QR codes always point at the canonical public URL;
 * otherwise falls back to the current origin.
 */
export function shareUrl(id: string): string {
  const envBase = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envBase) return `${envBase}/ar/${id}`;
  if (typeof window === "undefined") return `/ar/${id}`;
  return `${window.location.origin}/ar/${id}`;
}

/** True when a share URL can't be reached from a phone (localhost / LAN-only dev). */
export function isLocalShareUrl(url: string): boolean {
  return /\/\/(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url);
}
