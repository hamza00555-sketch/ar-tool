import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { checkWorker } from "@/lib/worker-auth";
import { serverError } from "@/lib/api-errors";

export const runtime = "nodejs";

/**
 * The reconstruction worker calls this to claim the oldest queued scan.
 * Returns the job (id, title, frame URLs) or `{ job: null }` when idle.
 * The worker uploads its result files through the normal public upload
 * flow (/api/upload/sign), then reports the URLs to /api/scan/worker/complete.
 */
export async function POST(req: NextRequest) {
  const denied = checkWorker(req);
  if (denied) return denied;
  try {
    const job = await getStore().claimScanJob();
    return NextResponse.json({ job });
  } catch (e) {
    return serverError("api/scan/worker/claim", e);
  }
}
