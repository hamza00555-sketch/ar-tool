/**
 * Production store backed by Supabase Postgres.
 *
 * Tables (see supabase/migrations/0001_init.sql):
 *  - experiences: one row per AR experience, with denormalized
 *    total_views / last_viewed_at so the dashboard list is one query.
 *  - scans: one row per public-viewer load (analytics events).
 *
 * All access goes through the service-role/secret key on the server;
 * RLS is enabled with no anon policies, so browser keys can't touch data.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { nanoid } from "nanoid";
import type { SupabaseConfig } from "./env";
import type { ExperienceStore, ScanResult } from "./store";
import type {
  ARContentType,
  Experience,
  ExperienceInput,
  ExperienceWithStats,
  ScanJob,
  ViewEvent,
} from "./types";

/** DB uses explicit names (model3d/text3d); app code uses short names. */
const TYPE_TO_DB: Record<ARContentType, string> = {
  model: "model3d",
  image: "image",
  video: "video",
  text: "text3d",
  tracked: "tracked_image",
};
const DB_TO_TYPE: Record<string, ARContentType> = {
  model3d: "model",
  image: "image",
  video: "video",
  text3d: "text",
  tracked_image: "tracked",
};

interface ExperienceRow {
  id: string;
  title: string;
  description: string;
  type: string;
  status: "draft" | "published";
  asset_url: string | null;
  asset_type: string | null;
  usdz_url: string | null;
  thumbnail_url: string | null;
  config: {
    text?: string;
    textStyle?: Experience["content"]["textStyle"];
    assetName?: string;
    arModelUrl?: string;
    targetImageUrl?: string;
    mindUrl?: string;
    scene?: Experience["content"]["scene"];
    audioUrl?: string;
    audioName?: string;
    audioLoop?: boolean;
    audioInUsdz?: boolean;
  };
  total_views: number;
  last_viewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ScanRow {
  device_type: string;
  os: string;
  browser: string;
  referrer: string;
  created_at: string;
}

interface ScanJobRow {
  id: string;
  status: ScanJob["status"];
  title: string;
  frame_urls: string[];
  result_glb_url: string | null;
  result_usdz_url: string | null;
  thumbnail_url: string | null;
  error: string | null;
  experience_id: string | null;
  created_at: string;
  updated_at: string;
}

function rowToScanJob(r: ScanJobRow): ScanJob {
  return {
    id: r.id,
    status: r.status,
    title: r.title,
    frameUrls: Array.isArray(r.frame_urls) ? r.frame_urls : [],
    resultGlbUrl: r.result_glb_url ?? undefined,
    resultUsdzUrl: r.result_usdz_url ?? undefined,
    thumbnailUrl: r.thumbnail_url ?? undefined,
    error: r.error ?? undefined,
    experienceId: r.experience_id ?? undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function rowToExperience(row: ExperienceRow, events: ViewEvent[] = []): ExperienceWithStats {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: DB_TO_TYPE[row.type] ?? "model",
    status: row.status,
    thumbnail: row.thumbnail_url ?? undefined,
    content: {
      assetUrl: row.asset_url ?? undefined,
      assetName: row.config?.assetName,
      usdzUrl: row.usdz_url ?? undefined,
      arModelUrl: row.config?.arModelUrl,
      targetImageUrl: row.config?.targetImageUrl,
      mindUrl: row.config?.mindUrl,
      scene: row.config?.scene,
      text: row.config?.text,
      textStyle: row.config?.textStyle,
      audioUrl: row.config?.audioUrl,
      audioName: row.config?.audioName,
      audioLoop: row.config?.audioLoop,
      audioInUsdz: row.config?.audioInUsdz,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    analytics: {
      totalViews: row.total_views,
      lastViewedAt: row.last_viewed_at,
      events,
    },
  };
}

function scanToEvent(s: ScanRow): ViewEvent {
  return {
    at: s.created_at,
    device: (["phone", "tablet", "desktop", "other"].includes(s.device_type)
      ? s.device_type
      : "other") as ViewEvent["device"],
    os: s.os,
    browser: s.browser,
    referrer: s.referrer,
  };
}

/** Translate an ExperienceInput (full or partial) into row columns. */
function inputToColumns(input: Partial<ExperienceInput>): Partial<ExperienceRow> {
  const cols: Partial<ExperienceRow> = {};
  if (input.title !== undefined) cols.title = input.title.trim() || "Untitled experience";
  if (input.description !== undefined) cols.description = input.description;
  if (input.type !== undefined) cols.type = TYPE_TO_DB[input.type];
  if (input.status !== undefined) cols.status = input.status;
  if (input.thumbnail !== undefined) cols.thumbnail_url = input.thumbnail || null;
  if (input.content !== undefined) {
    const c = input.content;
    if (c.assetUrl !== undefined) {
      cols.asset_url = c.assetUrl || null;
      cols.asset_type = c.assetUrl ? extOf(c.assetUrl) : null;
    }
    if (c.usdzUrl !== undefined) cols.usdz_url = c.usdzUrl || null;
    // text / textStyle / assetName live in config (merged with existing on update)
  }
  return cols;
}

function extOf(url: string): string | null {
  const m = /\.([a-z0-9]{2,5})(?:\?|$)/i.exec(url);
  return m ? m[1].toLowerCase() : null;
}

function dbError(op: string, message: string): Error {
  return new Error(`Database error while trying to ${op}: ${message}`);
}

export class SupabaseStore implements ExperienceStore {
  constructor(private client: SupabaseClient, private bucket: string) {}

  static fromConfig(cfg: SupabaseConfig): SupabaseStore {
    const client = createClient(cfg.url, cfg.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabaseStore(client, cfg.bucket);
  }

  async list(): Promise<ExperienceWithStats[]> {
    const { data, error } = await this.client
      .from("experiences")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw dbError("list experiences", error.message);
    return (data as ExperienceRow[]).map((r) => rowToExperience(r));
  }

  async get(id: string): Promise<ExperienceWithStats | null> {
    const { data, error } = await this.client
      .from("experiences")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw dbError("load the experience", error.message);
    if (!data) return null;

    const { data: scans, error: scanErr } = await this.client
      .from("scans")
      .select("device_type, os, browser, referrer, created_at")
      .eq("experience_id", id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (scanErr) throw dbError("load analytics", scanErr.message);
    const events = (scans as ScanRow[]).map(scanToEvent).reverse();
    return rowToExperience(data as ExperienceRow, events);
  }

  async create(input: ExperienceInput): Promise<Experience> {
    const row = {
      id: nanoid(10),
      description: "",
      config: {
        text: input.content?.text,
        textStyle: input.content?.textStyle,
        assetName: input.content?.assetName,
        arModelUrl: input.content?.arModelUrl,
        targetImageUrl: input.content?.targetImageUrl,
        mindUrl: input.content?.mindUrl,
        scene: input.content?.scene,
        audioUrl: input.content?.audioUrl,
        audioName: input.content?.audioName,
        audioLoop: input.content?.audioLoop,
        audioInUsdz: input.content?.audioInUsdz,
      },
      status: input.status ?? "draft",
      ...inputToColumns(input),
    };
    const { data, error } = await this.client
      .from("experiences")
      .insert(row)
      .select()
      .single();
    if (error) throw dbError("create the experience", error.message);
    const { analytics, ...exp } = rowToExperience(data as ExperienceRow);
    void analytics;
    return exp;
  }

  async update(id: string, patch: Partial<ExperienceInput>): Promise<Experience | null> {
    // config is a merged JSON blob — read current value first
    const { data: current, error: readErr } = await this.client
      .from("experiences")
      .select("config")
      .eq("id", id)
      .maybeSingle();
    if (readErr) throw dbError("load the experience", readErr.message);
    if (!current) return null;

    const cols = inputToColumns(patch);
    if (patch.content !== undefined) {
      const c = patch.content;
      cols.config = {
        ...(current.config ?? {}),
        ...(c.text !== undefined && { text: c.text }),
        ...(c.textStyle !== undefined && { textStyle: c.textStyle }),
        ...(c.assetName !== undefined && { assetName: c.assetName }),
        ...(c.arModelUrl !== undefined && { arModelUrl: c.arModelUrl }),
        ...(c.targetImageUrl !== undefined && { targetImageUrl: c.targetImageUrl }),
        ...(c.mindUrl !== undefined && { mindUrl: c.mindUrl }),
        ...(c.scene !== undefined && { scene: c.scene }),
        ...(c.audioUrl !== undefined && { audioUrl: c.audioUrl }),
        ...(c.audioName !== undefined && { audioName: c.audioName }),
        ...(c.audioLoop !== undefined && { audioLoop: c.audioLoop }),
        ...(c.audioInUsdz !== undefined && { audioInUsdz: c.audioInUsdz }),
      };
    }
    cols.updated_at = new Date().toISOString();

    const { data, error } = await this.client
      .from("experiences")
      .update(cols)
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw dbError("save the experience", error.message);
    if (!data) return null;
    const { analytics, ...exp } = rowToExperience(data as ExperienceRow);
    void analytics;
    return exp;
  }

  async remove(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from("experiences")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) throw dbError("delete the experience", error.message);
    return (data?.length ?? 0) > 0;
  }

  async trackView(id: string, event: ViewEvent): Promise<boolean> {
    // record_scan() inserts the scan row and bumps the denormalized counters
    // in one transaction (see migration SQL).
    const { data, error } = await this.client.rpc("record_scan", {
      p_experience_id: id,
      p_device: event.device,
      p_os: event.os,
      p_browser: event.browser,
      p_referrer: event.referrer,
      p_user_agent: event.userAgent ?? "",
    });
    if (error) throw dbError("record the scan", error.message);
    return data === true;
  }

  /* --------------------------------- scans -------------------------------- */

  async createScanJob(input: { title: string; frameUrls: string[] }): Promise<ScanJob> {
    const { data, error } = await this.client
      .from("scan_jobs")
      .insert({
        id: nanoid(10),
        title: input.title.trim() || "3D scan",
        frame_urls: input.frameUrls,
        status: "queued",
      })
      .select()
      .single();
    if (error) throw dbError("create the scan job", error.message);
    return rowToScanJob(data as ScanJobRow);
  }

  async getScanJob(id: string): Promise<ScanJob | null> {
    const { data, error } = await this.client
      .from("scan_jobs")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw dbError("load the scan job", error.message);
    return data ? rowToScanJob(data as ScanJobRow) : null;
  }

  async claimScanJob(): Promise<ScanJob | null> {
    // SECURITY DEFINER function picks the oldest queued job with SKIP LOCKED
    const { data, error } = await this.client.rpc("claim_scan_job");
    if (error) throw dbError("claim a scan job", error.message);
    const rows = data as ScanJobRow[];
    return rows && rows.length ? rowToScanJob(rows[0]) : null;
  }

  async completeScanJob(id: string, result: ScanResult): Promise<ScanJob | null> {
    const { data, error } = await this.client
      .from("scan_jobs")
      .update({
        status: "ready",
        result_glb_url: result.resultGlbUrl,
        result_usdz_url: result.resultUsdzUrl ?? null,
        thumbnail_url: result.thumbnailUrl ?? null,
        experience_id: result.experienceId ?? null,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw dbError("finish the scan job", error.message);
    return data ? rowToScanJob(data as ScanJobRow) : null;
  }

  async failScanJob(id: string, message: string): Promise<ScanJob | null> {
    const { data, error } = await this.client
      .from("scan_jobs")
      .update({ status: "failed", error: message, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) throw dbError("mark the scan job failed", error.message);
    return data ? rowToScanJob(data as ScanJobRow) : null;
  }

  /** Server-side upload for generated assets (poster GLBs — small files only). */
  async uploadAsset(
    path: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<string> {
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(path, bytes, { contentType, upsert: true });
    if (error) {
      throw new Error(`Storage error while saving a generated asset: ${error.message}`);
    }
    return this.client.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }

  /** Signed URL the browser can PUT a file to directly (bypasses Vercel's 4.5 MB body limit). */
  async createUploadUrl(
    path: string
  ): Promise<{ uploadUrl: string; publicUrl: string }> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(path);
    if (error) {
      throw new Error(
        `Storage error while preparing the upload: ${error.message}. ` +
          `Check that the "${this.bucket}" bucket exists (see SETUP.md).`
      );
    }
    const { data: pub } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return { uploadUrl: data.signedUrl, publicUrl: pub.publicUrl };
  }
}
