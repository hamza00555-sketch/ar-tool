/**
 * Server-side environment configuration.
 *
 * The app runs in one of two storage modes:
 *  - "supabase": SUPABASE_URL + a secret key are set → Postgres + Storage.
 *    This is the production mode (required on Vercel/serverless hosts).
 *  - "local": nothing configured → JSON file + local uploads. Development
 *    only; serverless filesystems are read-only/ephemeral so this mode
 *    cannot work there.
 */

export interface SupabaseConfig {
  url: string;
  /** service_role (legacy) or sb_secret_… (new) key — server only, never NEXT_PUBLIC */
  secretKey: string;
  bucket: string;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return null;
  return {
    url: url.replace(/\/$/, ""),
    secretKey,
    bucket: process.env.SUPABASE_STORAGE_BUCKET ?? "ar-assets",
  };
}

export function storageMode(): "supabase" | "local" {
  return getSupabaseConfig() ? "supabase" : "local";
}
