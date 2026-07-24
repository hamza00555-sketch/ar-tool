import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/store";
import { serverError } from "@/lib/api-errors";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** Poll a scan job's status (the capture flow watches this until it's ready). */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const job = await getStore().getScanJob(id);
    if (!job) {
      return NextResponse.json({ error: "Scan job not found" }, { status: 404 });
    }
    return NextResponse.json({ job });
  } catch (e) {
    return serverError("api/scan/[id] GET", e);
  }
}
