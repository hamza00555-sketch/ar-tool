import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { serverError } from "@/lib/api-errors";
import { classifyUserAgent } from "@/lib/ua";

export const runtime = "nodejs";

/** Records one view of a public AR page. Called by the viewer on load. */
export async function POST(req: NextRequest) {
  try {
    let body: { id?: string; referrer?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!body.id) {
      return NextResponse.json({ error: "`id` is required" }, { status: 400 });
    }
    const ua = req.headers.get("user-agent") ?? "";
    const ok = await getStore().trackView(body.id, {
      at: new Date().toISOString(),
      ...classifyUserAgent(ua),
      referrer: (body.referrer ?? "").slice(0, 300),
      userAgent: ua.slice(0, 500),
    });
    if (!ok) {
      return NextResponse.json({ error: "Experience not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return serverError("api/track POST", e);
  }
}
