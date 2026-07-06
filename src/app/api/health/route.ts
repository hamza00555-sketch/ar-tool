import { NextResponse } from "next/server";
import { storageMode } from "@/lib/env";

export const runtime = "nodejs";

/** Lets the UI show whether it's running on Supabase or the local dev store. */
export async function GET() {
  return NextResponse.json({ ok: true, storage: storageMode() });
}
