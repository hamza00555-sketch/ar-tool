/**
 * Server-side environment configuration.
 *
 * The app runs in one of two storage modes:
 *  - "supabase": SUPABASE_URL + a key are set → Postgres + Storage.
 *    This is the production mode (required on Vercel/serverless hosts).
 *  - "local": nothing configured → JSON file + local uploads. Development
 *    only; serverless filesystems are read-only/ephemeral so this mode
 *    cannot work there.
 *
 * Two key types are accepted, in priority order:
 *  1. SUPABASE_SECRET_KEY (service_role / sb_secret_…) — RECOMMENDED.
 *     Bypasses RLS; the database stays locked to the public and only this
 *     server can read/write. Keep it server-side only.
 *  2. SUPABASE_PUBLISHABLE_KEY (anon / sb_publishable_…) — fallback.
 *     Requires permissive RLS policies (migration 0002). Simpler to obtain
 *     but means anyone holding the key can read/write, so treat it as a
 *     server secret and prefer the secret key for anything real.
 */

export type SupabaseKeyKind = "secret" | "publishable";

export interface SupabaseConfig {
  url: string;
  key: string;
  keyKind: SupabaseKeyKind;
  bucket: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey =
    process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  const key = secretKey ?? publishableKey;
  if (!key) return null;

  return {
    url: url.replace(/\/$/, ""),
    key,
    keyKind: secretKey ? "secret" : "publishable",
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "ar-assets",
  };
}

export function storageMode(): "supabase" | "local" {
  return getSupabaseConfig() ? "supabase" : "local";
}

/**
 * Shared secret the self-hosted reconstruction worker authenticates with.
 * Set WORKER_TOKEN in the app's env AND give the same value to the worker.
 * When unset, the scan worker API is disabled (returns 503), so scans queue
 * but never get claimed — the capture flow still works for testing.
 */
export function getWorkerToken(): string | null {
  return process.env.WORKER_TOKEN?.trim() || null;
}
