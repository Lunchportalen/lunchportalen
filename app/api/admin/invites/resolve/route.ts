// app/api/invites/resolve/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { rid as makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function getBaseUrl() {
  const raw = safeStr(process.env.NEXT_PUBLIC_SITE_URL);
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  const body = { ok: false, rid, error, message, detail: detail ?? undefined };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}
function jsonOk(rid: string, body: any, status = 200) {
  return new Response(JSON.stringify({ ...body, rid }), {
    status,
    headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
  });
}

export async function GET(req: NextRequest) {
  const rid = makeRid();

  const url = new URL(req.url);
  const code = safeStr(url.searchParams.get("invite") ?? url.searchParams.get("code"));
  if (!code) return jsonErr(400, rid, "missing_invite", "Mangler invitasjonskode.");

  const base = getBaseUrl();
  if (!base) return jsonErr(500, rid, "config_error", "NEXT_PUBLIC_SITE_URL mangler. Kan ikke bygge registerUrl.");

  // Call lookup internally (same origin)
  const lookupUrl = new URL(`${base}/api/invites/lookup`);
  lookupUrl.searchParams.set("code", code);

  try {
    const res = await fetch(lookupUrl.toString(), {
      method: "GET",
      headers: { "x-lp-rid": rid },
      cache: "no-store",
    });

    const txt = await res.text();
    let j: any = null;
    try {
      j = txt ? JSON.parse(txt) : null;
    } catch {
      j = null;
    }

    if (!res.ok || !j?.ok) {
      // forward best-effort
      return new Response(txt || JSON.stringify({ ok: false, rid, error: "lookup_failed", message: "Lookup feilet." }), {
        status: res.status || 500,
        headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8" },
      });
    }

    const registerUrl = `${base}/register?invite=${encodeURIComponent(code)}`;

    return jsonOk(rid, {
      ok: true,
      invite: { code, company_id: j.company?.id ?? null, created_at: null },
      company: j.company,
      registerUrl,
    });
  } catch (e: any) {
    return jsonErr(500, rid, "server_error", "Uventet feil ved resolve av invitasjon.", { message: String(e?.message ?? e) });
  }
}
