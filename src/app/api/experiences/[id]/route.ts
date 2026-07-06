import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { serverError } from "@/lib/api-errors";
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
