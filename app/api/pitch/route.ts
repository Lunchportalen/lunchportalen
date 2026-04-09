export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { getPitchData } from "@/lib/pitch/data";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("pitch");
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get("mode") === "live" ? "live" : "demo";
    const metrics = await getPitchData(mode);
    return jsonOk(rid, { metrics, mode }, 200);
  } catch (e) {
    return jsonErr(rid, "Kunne ikke laste pitch-data.", 500, "PITCH_FAILED", e);
  }
}
