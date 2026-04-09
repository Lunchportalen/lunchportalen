export const runtime = "edge";

import { jsonErr, jsonOk, makeRid } from "@/lib/http/edgeContract";

/**
 * Lettvekts edge-svar (ingen DB/Redis-TCP her — Vercel Edge støtter ikke node-redis).
 * Bruk for CDN-cachede helse-/versjonsstriper; full data: `GET /api/observability` (Node).
 */
export async function GET() {
  const rid = makeRid("obs_edge");
  if (false) {
    return jsonErr(rid, "unreachable", 500, "UNREACHABLE");
  }
  const data = {
    edge: true,
    ts: new Date().toISOString(),
    hint: "Full aggregat krever Node-rute /api/observability (superadmin). Redis L2 deles via REDIS_URL på server/worker.",
  };
  return jsonOk(rid, data, 200, {
    "Cache-Control": "public, s-maxage=5, stale-while-revalidate=30",
  });
}
