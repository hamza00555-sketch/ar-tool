import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { storageMode } from "@/lib/env";
import { serverError } from "@/lib/api-errors";
import { ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES } from "@/lib/upload-config";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/**
 * LOCAL-MODE multipart upload — writes to data/uploads on this machine.
 * In Supabase mode the client uploads directly to Storage via a signed URL
 * from /api/upload/sign, and this route refuses (serverless request bodies
 * are capped — 4.5 MB on Vercel — and the filesystem is read-only there).
 */
export async function POST(req: NextRequest) {
  try {
    if (storageMode() === "supabase") {
      return NextResponse.json(
        { error: "Direct uploads are disabled — use the signed-URL flow (/api/upload/sign)." },
        { status: 400 }
      );
    }

    const form = await req.formData().catch(() => null);
    if (!form) {
      return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
    }
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const allowed = ALLOWED_EXTENSIONS[kind];
    if (!allowed) {
      return NextResponse.json({ error: "Unknown upload kind" }, { status: 400 });
    }
    const ext = path.extname(file.name).toLowerCase();
    if (!allowed.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type "${ext || "none"}". Allowed: ${allowed.join(", ")}` },
        { status: 415 }
      );
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File is too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB)` },
        { status: 413 }
      );
    }

    const name = `${nanoid(12)}${ext}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, name), bytes);

    return NextResponse.json({
      url: `/api/files/${name}`,
      originalName: file.name,
      size: file.size,
    });
  } catch (e) {
    return serverError("api/upload POST", e);
  }
}
