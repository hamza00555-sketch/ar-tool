import { NextRequest, NextResponse } from "next/server";
import { getWorkerToken } from "./env";

/**
 * Authenticates the self-hosted reconstruction worker on the worker-facing
 * scan endpoints. Returns a response to short-circuit with (503 when the
 * feature is disabled, 401 on a bad token), or null when the request is allowed.
 */
export function checkWorker(req: NextRequest): NextResponse | null {
  const expected = getWorkerToken();
  if (!expected) {
    return NextResponse.json(
      { error: "Scan worker API is disabled (WORKER_TOKEN not set on the server)." },
      { status: 503 }
    );
  }
  const got =
    req.headers.get("x-worker-token") ??
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (got !== expected) {
    return NextResponse.json({ error: "Bad worker token" }, { status: 401 });
  }
  return null;
}
