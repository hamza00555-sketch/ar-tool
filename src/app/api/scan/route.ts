import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { serverError } from "@/lib/api-errors";

export const runtime = "nodejs";

/**
 * Create a 3D-scan job from captured frames. The browser uploads the frames
 * first (via the normal upload flow), then posts their URLs here. A queued
 * job waits for the self-hosted reconstruction worker to claim it.
 */
export async function POST(req: NextRequest) {
  try {
    let body: { title?: string; frameUrls?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const frameUrls = Array.isArray(body.frameUrls)
      ? body.frameUrls.filter((u): u is string => typeof u === "string")
      : [];
    if (frameUrls.length < 8) {
      return NextResponse.json(
        { error: `A scan needs at least 8 frames (got ${frameUrls.length}).` },
        { status: 400 }
      );
    }
    const job = await getStore().createScanJob({
      title: body.title ?? "3D scan",
      frameUrls,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (e) {
    return serverError("api/scan POST", e);
  }
}
