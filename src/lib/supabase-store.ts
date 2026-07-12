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
import type { ExperienceStore } from "./store";
import type {
  ARContentType,
  Experience,
  ExperienceInput,
  ExperienceWithStats,
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
      text: row.config?.text,
      textStyle: row.config?.textStyle,
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
