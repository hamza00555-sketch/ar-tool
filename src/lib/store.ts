/**
 * Persistence entrypoint.
 *
 * `getStore()` returns the production Supabase store when SUPABASE_URL +
 * a secret key are configured, otherwise the local JSON-file store for
 * development. Both implement the same `ExperienceStore` interface, so
 * nothing above this layer knows which backend is active.
 */
import { getSupabaseConfig } from "./env";
import { JsonFileStore } from "./local-store";
import { SupabaseStore } from "./supabase-store";
import type {
  Experience,
  ExperienceInput,
  ExperienceWithStats,
  ScanJob,
  ViewEvent,
} from "./types";
import { SAMPLE_MODEL_NAME, SAMPLE_MODEL_URL } from "./types";

/** Result the reconstruction worker reports for a finished scan. */
export interface ScanResult {
  resultGlbUrl: string;
  resultUsdzUrl?: string;
  thumbnailUrl?: string;
  experienceId?: string;
}

export interface ExperienceStore {
  list(): Promise<ExperienceWithStats[]>;
  get(id: string): Promise<ExperienceWithStats | null>;
  create(input: ExperienceInput): Promise<Experience>;
  update(id: string, patch: Partial<ExperienceInput>): Promise<Experience | null>;
  remove(id: string): Promise<boolean>;
  trackView(id: string, event: ViewEvent): Promise<boolean>;

  /* 3D scan jobs */
  createScanJob(input: { title: string; frameUrls: string[] }): Promise<ScanJob>;
  getScanJob(id: string): Promise<ScanJob | null>;
  /** Atomically hand the oldest queued job to a worker (marks it processing). */
  claimScanJob(): Promise<ScanJob | null>;
  completeScanJob(id: string, result: ScanResult): Promise<ScanJob | null>;
  failScanJob(id: string, error: string): Promise<ScanJob | null>;
}

export function stripAnalytics(exp: ExperienceWithStats): Experience {
  const { analytics, ...rest } = exp;
  void analytics;
  return rest;
}

/** A ready-made experience so the end-to-end flow is testable on first run */
export function seedExperience(): ExperienceWithStats {
  const now = new Date().toISOString();
  return {
    id: "demo-knot",
    title: "Aurora Knot — sample",
    description:
      "A bundled sample 3D model. Open it on your phone to try AR immediately, no upload needed.",
    type: "model",
    status: "published",
    content: { assetUrl: SAMPLE_MODEL_URL, assetName: SAMPLE_MODEL_NAME },
    createdAt: now,
    updatedAt: now,
    analytics: { totalViews: 0, lastViewedAt: null, events: [] },
  };
}

// Reuse one instance across dev hot-reloads / route invocations
const globalStore = globalThis as unknown as { __holoformStore?: ExperienceStore };

export function getStore(): ExperienceStore {
  if (!globalStore.__holoformStore) {
    const cfg = getSupabaseConfig();
    globalStore.__holoformStore = cfg
      ? SupabaseStore.fromConfig(cfg)
      : new JsonFileStore();
  }
  return globalStore.__holoformStore;
}
