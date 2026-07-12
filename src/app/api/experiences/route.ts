import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { serverError } from "@/lib/api-errors";
import { generateImageArModel } from "@/lib/ar-model";
import type { ExperienceInput } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const experiences = await getStore().list();
    return NextResponse.json({ experiences });
  } catch (e) {
    return serverError("api/experiences GET", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: ExperienceInput;
    try {
      body = (await req.json()) as ExperienceInput;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.title || !body.type) {
      return NextResponse.json(
        { error: "`title` and `type` are required" },
        { status: 400 }
      );
    }
    if (!["model", "image", "video", "text", "tracked"].includes(body.type)) {
      return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
    }
    // Image experiences get a poster-plane GLB so phones can open camera AR
    // (Quick Look / Scene Viewer) — iOS Safari has no WebXR for flat content.
    if (body.type === "image" && body.content?.assetUrl) {
      const arModelUrl = await generateImageArModel(body.content.assetUrl);
      if (arModelUrl) body.content.arModelUrl = arModelUrl;
    }
    const experience = await getStore().create(body);
    return NextResponse.json({ experience }, { status: 201 });
  } catch (e) {
    return serverError("api/experiences POST", e);
  }
}
