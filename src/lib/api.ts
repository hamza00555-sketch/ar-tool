/** Client-side fetch helpers for the Holoform API. */
import type {
  Experience,
  ExperienceInput,
  ExperienceWithStats,
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
  kind: "model" | "usdz" | "image" | "video"
): Promise<{ url: string; originalName: string; size: number }> {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  return handle(res);
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

/** Public share URL for an experience, based on the current origin. */
export function shareUrl(id: string): string {
  if (typeof window === "undefined") return `/ar/${id}`;
  return `${window.location.origin}/ar/${id}`;
}
