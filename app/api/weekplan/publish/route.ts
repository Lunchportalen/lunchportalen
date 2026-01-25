// app/api/weekplan/publish/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { sanityServer } from "@/lib/sanity/server";
import { isPublishWindowOslo, nowISO } from "@/lib/date/oslo";
import { supabaseServer } from "@/lib/supabase/server";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

/* =========================
   Response helpers
========================= */
function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}

function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function jsonError(status: number, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

/* =========================
   Utils
========================= */
function normRole(v: any): Role {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "superadmin") return "superadmin";
  if (s === "company_admin" || s === "companyadmin" || s === "admin") return "company_admin";
  if (s === "kitchen") return "kitchen";
  if (s === "driver") return "driver";
  return "employee";
}

function computeRole(user: any): Role {
  // ✅ FASIT: app_metadata.role først (ikke klient-skrivbar)
  const appRole = normRole(user?.app_metadata?.role);
  if (appRole !== "employee") return appRole;

  const metaRole = normRole(user?.user_metadata?.role);
  return metaRole;
}

function isSanityId(v: any) {
  return typeof v === "string" && v.trim().length > 10;
}

/**
 * Optional: Stram publiseringspolicy:
 * - Superadmin kan publisere
 * - Kun i publish window (tors–søn Oslo)
 * - Kan ikke publisere hvis doc er låst
 * - Kan ikke publisere hvis den allerede er publisert (hvis du vil låse det)
 */
function alreadyPublished(doc: any) {
  return !!(doc?.publishedAt && doc?.approvedForPublish && doc?.customerVisible);
}

/* =========================
   Route
========================= */
export async function POST(req: Request) {
  const rid = `publish_weekplan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // 1) Auth + role
  const supabase = await supabaseServer();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  if (userErr || !user) return jsonError(401, "unauthorized", "Ikke innlogget", { rid });

  const role = computeRole(user);
  if (role !== "superadmin") return jsonError(403, "forbidden", "Kun superadmin kan publisere", { rid });

  // 2) Parse payload
  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "bad_request", "Ugyldig JSON", { rid });
  }

  const weekPlanId = String(body?.weekPlanId ?? "");
  if (!isSanityId(weekPlanId)) return jsonError(400, "bad_request", "weekPlanId mangler/ugyldig", { rid });

  // Optional flags
  const force = String(body?.force ?? "false").toLowerCase() === "true";
  const allowRepublish = String(body?.allowRepublish ?? "false").toLowerCase() === "true";

  // 3) Publish window
  if (!isPublishWindowOslo()) {
    // allow force in dev? (du kan fjerne force hvis du vil)
    if (!(force && process.env.NODE_ENV !== "production")) {
      return jsonError(409, "publish_window", "Publisering er kun tillatt torsdag–søndag (Oslo-tid)", { rid });
    }
  }

  // 4) Fetch current doc (locked check)
  const doc = await sanityServer.getDocument(weekPlanId);
  if (!doc) return jsonError(404, "not_found", "Fant ikke ukeplan", { rid, weekPlanId });

  const lockedAt = (doc as any)?.lockedAt ?? null;
  if (lockedAt) {
    return jsonError(409, "locked", "Ukeplan er låst og kan ikke publiseres", { rid, lockedAt });
  }

  // Optional: blokk republish hvis allerede publisert
  if (!allowRepublish && alreadyPublished(doc)) {
    return jsonError(409, "already_published", "Ukeplan er allerede publisert.", {
      rid,
      publishedAt: (doc as any)?.publishedAt ?? null,
    });
  }

  // 5) Patch: approved + visible + publishedAt
  const ts = nowISO();

  try {
    const patched = await sanityServer
      .patch(weekPlanId)
      .set({
        approvedForPublish: true,
        customerVisible: true,
        publishedAt: ts,
      })
      .commit({ autoGenerateArrayKeys: true });

    return jsonOk({
      ok: true,
      rid,
      weekPlanId,
      publishedAt: ts,
      approvedForPublish: true,
      customerVisible: true,
      // liten sanity: returner litt felt for debugging
      title: (patched as any)?.title ?? null,
      lockedAt: (patched as any)?.lockedAt ?? null,
    });
  } catch (e: any) {
    return jsonError(500, "sanity_error", "Kunne ikke publisere ukeplan", { rid, message: e?.message ?? String(e) });
  }
}

export async function GET() {
  return jsonError(405, "method_not_allowed", "Bruk POST for å publisere ukeplan.");
}
