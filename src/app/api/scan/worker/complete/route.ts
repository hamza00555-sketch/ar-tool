import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { serverError } from "@/lib/api-errors";
import { checkWorker } from "@/lib/worker-auth";

export const runtime = "nodejs";

/**
 * The worker reports a finished (or failed) scan.
 *  - success: `{ id, glbUrl, usdzUrl?, thumbnailUrl? }` → we create a `model`
 *    experience from the reconstructed GLB and mark the job ready with its id.
 *  - failure: `{ id, error }` → the job is marked failed with the message.
 */
export async function POST(req: NextRequest) {
  const denied = checkWorker(req);
  if (denied) return denied;
  try {
    let body: {
      id?: string;
      glbUrl?: string;
      usdzUrl?: string;
      thumbnailUrl?: string;
      error?: string;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { id } = body;
    if (!id) return NextResponse.json({ error: "`id` is required" }, { status: 400 });

    const store = getStore();
    const job = await store.getScanJob(id);
    if (!job) return NextResponse.json({ error: "Scan job not found" }, { status: 404 });

    if (body.error) {
      const failed = await store.failScanJob(id, body.error.slice(0, 500));
      return NextResponse.json({ job: failed });
    }

    if (!body.glbUrl) {
      return NextResponse.json(
        { error: "Either `glbUrl` (success) or `error` (failure) is required" },
        { status: 400 }
      );
    }

    // Turn the reconstructed model into a normal `model` experience so it
    // rides the whole existing pipeline (Quick Look, decorations, audio, …).
    const experience = await store.create({
      title: job.title || "3D scan",
      type: "model",
      status: "published",
      thumbnail: body.thumbnailUrl,
      content: {
        assetUrl: body.glbUrl,
        assetName: `${job.title || "scan"}.glb`,
        usdzUrl: body.usdzUrl,
      },
    });

    const ready = await store.completeScanJob(id, {
      resultGlbUrl: body.glbUrl,
      resultUsdzUrl: body.usdzUrl,
      thumbnailUrl: body.thumbnailUrl,
      experienceId: experience.id,
    });
    return NextResponse.json({ job: ready, experienceId: experience.id });
  } catch (e) {
    return serverError("api/scan/worker/complete", e);
  }
}
