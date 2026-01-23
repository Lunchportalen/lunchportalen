// app/api/admin/locations/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { getScope, allowSuperadminOrCompanyAdmin, mustCompanyId } from "@/lib/auth/scope";

/**
 * ADMIN / LOCATIONS
 * - company_admin: only own company locations
 * - superadmin: can see all OR filter by ?company_id=
 * - Never trust client-provided company_id for company_admin
 *
 * GET  -> list locations
 * PUT  -> update delivery contact fields (whitelist) + audit light write
 */

const SELECT_FIELDS =
  "id,company_id,name,address,address_line1,postal_code,city,label,delivery_contact_name,delivery_contact_phone,delivery_notes,delivery_window_from,delivery_window_to";

function jsonErr(status: number, error: string, detail?: string, extra?: any) {
  return NextResponse.json(
    { ok: false, error, detail: detail ?? undefined, extra: extra ?? undefined },
    { status }
  );
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function safeText(v: any, max = 500) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  return s.slice(0, max);
}

function digitsPlus(v: any, max = 40) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  // allow +, spaces, digits
  const cleaned = s.replace(/[^\d+ ]/g, "").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function normTime(v: any) {
  // Accept HH:MM or null
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^\d{2}:\d{2}$/.test(s)) return null;
  const [hh, mm] = s.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return s;
}

function cmpTime(a: string, b: string) {
  // a,b are HH:MM
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return ah * 60 + am - (bh * 60 + bm);
}

export async function GET(req: NextRequest) {
  const rid = `admin_locations_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Auth + scope (tenant lock)
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const supabase = await supabaseServer();

    const url = new URL(req.url);
    const requestedCompanyId = url.searchParams.get("company_id");

    // company_admin MUST be locked to own company
    const companyId =
      scope.role === "superadmin"
        ? requestedCompanyId
          ? String(requestedCompanyId)
          : null // null => all companies
        : mustCompanyId(scope);

    let q = supabase
      .from("company_locations")
      .select(SELECT_FIELDS)
      .order("label", { ascending: true })
      .order("name", { ascending: true });

    if (companyId) q = q.eq("company_id", companyId);

    const { data, error } = await q;
    if (error) return jsonErr(500, "DB_ERROR", error.message, { rid });

    return NextResponse.json({ ok: true, rid, company_id: companyId, locations: data ?? [] }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || "ERROR";
    return jsonErr(status, code, e?.message || "Ukjent feil.", { rid });
  }
}

export async function PUT(req: NextRequest) {
  const rid = `admin_locations_put_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    // Auth + scope (tenant lock)
    const scope = await getScope(req);
    allowSuperadminOrCompanyAdmin(scope);

    const supabase = await supabaseServer();

    const body = await req.json().catch(() => null);
    const id = body?.id;

    if (!isUuid(id)) return jsonErr(400, "BAD_REQUEST", "Mangler/ugyldig id.", { rid });

    // Read location to enforce scope
    const { data: loc, error: locErr } = await supabase
      .from("company_locations")
      .select("id,company_id")
      .eq("id", id)
      .maybeSingle();

    if (locErr) return jsonErr(500, "DB_ERROR", locErr.message, { rid });
    if (!loc) return jsonErr(404, "NOT_FOUND", "Lokasjon finnes ikke.", { rid });

    // company_admin locked to own company
    if (scope.role !== "superadmin") {
      const myCompanyId = mustCompanyId(scope);
      if (String((loc as any).company_id) !== String(myCompanyId)) {
        return jsonErr(403, "FORBIDDEN", "Ingen tilgang til denne lokasjonen.", { rid });
      }
    }

    // Allow only specific fields to be updated (whitelist)
    const patch = {
      delivery_contact_name: safeText(body.delivery_contact_name, 120),
      delivery_contact_phone: digitsPlus(body.delivery_contact_phone, 40),
      delivery_notes: safeText(body.delivery_notes, 800),
      delivery_window_from: normTime(body.delivery_window_from),
      delivery_window_to: normTime(body.delivery_window_to),
    };

    // If one time is provided, both should be valid or both null
    if ((patch.delivery_window_from && !patch.delivery_window_to) || (!patch.delivery_window_from && patch.delivery_window_to)) {
      return jsonErr(400, "BAD_REQUEST", "Begge tider må settes (from og to), eller ingen.", { rid });
    }

    // If both present, ensure from <= to
    if (patch.delivery_window_from && patch.delivery_window_to) {
      if (cmpTime(patch.delivery_window_from, patch.delivery_window_to) > 0) {
        return jsonErr(400, "BAD_REQUEST", "delivery_window_from kan ikke være etter delivery_window_to.", { rid });
      }
    }

    const { error: updErr } = await supabase.from("company_locations").update(patch).eq("id", id);
    if (updErr) return jsonErr(500, "DB_ERROR", updErr.message, { rid });

    // ---- audit light (best effort, skal ikke stoppe lagring) ----
    try {
      const { data: auth } = await supabase.auth.getUser();
      const actorEmail = auth?.user?.email ?? null;
      const actorUserId = auth?.user?.id ?? null;

      await supabase.from("location_audit").insert({
        location_id: id,
        company_id: (loc as any).company_id,
        actor_user_id: actorUserId,
        actor_email: actorEmail,
        action: "update",
        diff: patch, // enkel "diff" (hva vi satte)
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, rid }, { status: 200 });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = e?.code || "ERROR";
    return jsonErr(status, code, e?.message || "Ukjent feil.", { rid });
  }
}
