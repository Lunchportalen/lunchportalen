// app/api/order/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { makeRid, jsonErr, jsonOk } from "@/lib/http/respond";
import { GET as OrdersGET, POST as OrdersPOST, DELETE as OrdersDELETE } from "@/app/api/orders/route";

async function callLegacy(rid: string, fn: (req: NextRequest) => Promise<Response>, req: NextRequest) {
  try {
    const res = await fn(req);
    if (!res) return jsonOk(rid, { ok: true, rid, data: null }, 200);
    return res;
  } catch (e: any) {
    return jsonErr(rid, "Legacy /api/order proxy failed.", 500, {
      code: "LEGACY_ORDER_PROXY_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}

// Legacy endpoint kept for compatibility.
// Canonical implementation lives in /api/orders.
export async function GET(req: NextRequest) {
  const rid = makeRid("legacy_order_get");
  return callLegacy(rid, OrdersGET, req);
}

export async function POST(req: NextRequest) {
  const rid = makeRid("legacy_order_post");
  return callLegacy(rid, OrdersPOST, req);
}

export async function DELETE(req: NextRequest) {
  const rid = makeRid("legacy_order_delete");
  return callLegacy(rid, OrdersDELETE, req);
}
