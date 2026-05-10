export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { NextRequest as WrappedNextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

import { POST as setStatusPost } from "../../set-status/route";

type Ctx = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(value: unknown) {
  return String(value ?? "").trim();
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const params = await Promise.resolve(ctx.params as { companyId?: string });
  const companyId = safeStr(params?.companyId);
  if (!companyId) return jsonErr(makeRid(), "companyId mangler.", 400, "VALIDATION");

  const headers = new Headers(req.headers);
  headers.set("content-type", "application/json");
  const wrapped = new WrappedNextRequest(req.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ companyId, status: "ACTIVE" }),
  });

  const res = await setStatusPost(wrapped);
  const body = await res.clone().json().catch(() => null);
  if (!res.ok || body?.ok !== true) return res;
  return jsonOk(safeStr(body.rid) || makeRid(), null, 200);
}
