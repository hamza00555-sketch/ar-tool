import { NextResponse } from "next/server";

/**
 * Turn a thrown error into a JSON 500 with the real message.
 * We deliberately surface store/storage messages (they're written to be
 * user-readable and actionable) instead of a generic "something went wrong".
 */
export function serverError(route: string, e: unknown): NextResponse {
  const message = e instanceof Error ? e.message : "Unexpected server error";
  console.error(`[${route}]`, e);
  return NextResponse.json({ error: message }, { status: 500 });
}
