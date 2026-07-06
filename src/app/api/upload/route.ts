import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { nanoid } from "nanoid";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 60 * 1024 * 1024; // 60 MB

/** kind → allowed extensions. Extension-based: browsers often send empty/odd MIME for .glb/.usdz */
const ALLOWED: Record<string, string[]> = {
  model: [".glb", ".gltf"],
  usdz: [".usdz"],
  image: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
  video: [".mp4", ".webm", ".mov"],
};

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }
  const file = form.get("file");
  const kind = String(form.get("kind") ?? "");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const allowed = ALLOWED[kind];
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File is too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` },
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
}
