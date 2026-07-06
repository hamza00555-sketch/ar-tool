import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { serverError } from "@/lib/api-errors";
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
    if (!["model", "image", "video", "text"].includes(body.type)) {
      return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
    }
    const experience = await getStore().create(body);
    return NextResponse.json({ experience }, { status: 201 });
  } catch (e) {
    return serverError("api/experiences POST", e);
  }
}
