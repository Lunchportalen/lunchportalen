export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function GET() {
  const rid = makeRid();
  return jsonErr(rid, "Endepunktet er ikke implementert.", 501, "NOT_IMPLEMENTED");
}

export async function POST() {
  const rid = makeRid();
  return jsonErr(rid, "Endepunktet er ikke implementert.", 501, "NOT_IMPLEMENTED");
}

export async function OPTIONS() {
  const rid = makeRid();
  return jsonOk(rid, { ok: true, rid, allow: ["GET", "POST"] }, 200);
}
