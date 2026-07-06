import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getSupabaseConfig } from "@/lib/env";
import { SupabaseStore } from "@/lib/supabase-store";
import { serverError } from "@/lib/api-errors";
import {
  ALLOWED_EXTENSIONS,
  MAX_UPLOAD_BYTES,
  MIME_BY_EXT,
} from "@/lib/upload-config";

export const runtime = "nodejs";

/**
 * Step 1 of the upload flow.
 *
 * In Supabase mode this returns a signed URL the browser PUTs the file to
 * directly — the file never passes through this server, which keeps us under
 * serverless request-body limits (Vercel caps request bodies at 4.5 MB).
 * In local mode it tells the client to use the multipart /api/upload route.
 */

export async function POST(req: NextRequest) {
  try {
    let body: { name?: string; size?: number; kind?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { name, size, kind } = body;
    if (!name || typeof size !== "number" || !kind) {
      return NextResponse.json(
        { error: "`name`, `size`, and `kind` are required" },
        { status: 400 }
      );
    }
    const allowed = ALLOWED_EXTENSIONS[kind];
    if (!allowed) {
      return NextResponse.json({ error: `Unknown upload kind "${kind}"` }, { status: 400 });
    }
    const ext = ("." + (name.split(".").pop() ?? "")).toLowerCase();
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type "${ext}". Allowed: ${allowed.join(", ")}` },
        { status: 415 }
      );
    }
    if (size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          error: `File is too large (${(size / 1024 / 1024).toFixed(1)} MB). Max is ${Math.round(
            MAX_UPLOAD_BYTES / 1024 / 1024
          )} MB.`,
        },
        { status: 413 }
      );
    }

    const cfg = getSupabaseConfig();
    if (!cfg) {
      // Local dev — the client falls back to multipart POST /api/upload
      return NextResponse.json({ mode: "local" });
    }

    const store = SupabaseStore.fromConfig(cfg);
    const path = `${kind}/${nanoid(12)}${ext}`;
    const { uploadUrl, publicUrl } = await store.createUploadUrl(path);
    return NextResponse.json({
      mode: "supabase",
      uploadUrl,
      publicUrl,
      contentType: MIME_BY_EXT[ext] ?? "application/octet-stream",
    });
  } catch (e) {
    return serverError("api/upload/sign", e);
  }
}
