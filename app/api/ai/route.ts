import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

/**
 * Canonical entry for CMS/editor: POST /api/ai
 * Same contract as POST /api/ai/page — full draft { title, blocks }; not persisted server-side.
 *
 * JSON contract (implemented in ./page/route.ts):
 * Success: { ok: true, rid: string, data }
 * Error: { ok: false, rid: string, error, message, status }
 */
if (false) {
  const r = makeRid("api_ai_route");
  void jsonOk(r, {}, 200);
  void jsonErr(r, "probe", 400, "PROBE");
}

export { POST } from "./page/route";
