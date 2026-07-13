import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { serverError } from "@/lib/api-errors";
import { generateImageArModel } from "@/lib/ar-model";
import type { ExperienceInput } from "@/lib/types";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const experience = await getStore().get(id);
    if (!experience) {
      return NextResponse.json({ error: "Experience not found" }, { status: 404 });
    }
    return NextResponse.json({ experience });
  } catch (e) {
    return serverError("api/experiences/[id] GET", e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    let patch: Partial<ExperienceInput>;
    try {
      patch = (await req.json()) as Partial<ExperienceInput>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    // Regenerate the poster GLB when an image experience's picture changes
    // (unless the client provided a baked themed GLB itself)
    if (patch.content?.assetUrl && !patch.content.arModelUrl) {
      const current = await getStore().get(id);
      if ((patch.type ?? current?.type) === "image") {
        const arModelUrl = await generateImageArModel(patch.content.assetUrl);
        if (arModelUrl) patch.content.arModelUrl = arModelUrl;
      }
    }
    const experience = await getStore().update(id, patch);
    if (!experience) {
      return NextResponse.json({ error: "Experience not found" }, { status: 404 });
    }
    return NextResponse.json({ experience });
  } catch (e) {
    return serverError("api/experiences/[id] PATCH", e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const ok = await getStore().remove(id);
    if (!ok) {
      return NextResponse.json({ error: "Experience not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("api/experiences/[id] DELETE", e);
  }
}
