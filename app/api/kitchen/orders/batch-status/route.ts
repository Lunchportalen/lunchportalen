// app/api/kitchen/orders/batch-status/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { cutoffStatusForDate0805, osloNowISO } from "@/lib/date/oslo";
import { sendOrderBackup } from "@/lib/orders/orderBackup";
import { loadProfileByUserId } from "@/lib/db/profileLookup";

type OrderStatus = "QUEUED" | "PACKED" | "DELIVERED";
const allowedRoles = ["kitchen", "superadmin"] as const;

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}
function asString(v: unknown) {
  return String(v ?? "").trim();
}
function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}
function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function normStatus(v: unknown): OrderStatus | null {
  const s = asString(v).toUpperCase();
  if (s === "QUEUED" || s === "PACKED" || s === "DELIVERED") return s;
  return null;
}

function rankStatus(s: string | null | undefined) {
  const v = asString(s).toUpperCase();
  if (v === "DELIVERED") return 2;
  if (v === "PACKED") return 1;
  if (v === "QUEUED" || v === "ACTIVE") return 0;
  return -1;
}

function cutoffAllowed(dateISO: string) {
  const status = cutoffStatusForDate0805(dateISO);
  if (status === "TODAY_LOCKED") return { ok: true as const };
  if (status === "PAST") return { ok: false as const, code: "DATE_LOCKED_PAST", message: "Datoen er passert og kan ikke endres." };
  return { ok: false as const, code: "LOCKED_AFTER_0805", message: "Statusendring er kun tillatt etter kl. 08:05 i dag." };
}

type Body = {
  // Variant A: presis batch
  orderIds?: string[];

  // Variant B: filter-batch (hvis orderIds ikke er sendt)
  date?: string; // YYYY-MM-DD
  slot?: string;
  companyId?: string;
  locationId?: string;

  // Felles
  status: OrderStatus;
  note?: string | null;
};

function parseQuery(req: NextRequest) {
  const u = new URL(req.url);
  const date = asString(u.searchParams.get("date"));
  const slot = asString(u.searchParams.get("slot"));
  const companyId = asString(u.searchParams.get("companyId"));
  const locationId = asString(u.searchParams.get("locationId"));

  const orderIds = u.searchParams
    .getAll("orderId")
    .map((x) => asString(x))
    .filter(Boolean);

  return { date, slot, companyId, locationId, orderIds };
}

/**
 * GET = DRY-RUN
 * - Returnerer hvor mange ordre som matcher (og ev. id-liste innenfor en cap)
 */
export async function GET(req: NextRequest) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s = await scopeOr401(req);
  if (s.ok === false) return s.res;

  const ctx = s.ctx;
  const { rid, scope } = ctx;

  // âœ… riktig signatur: (ctx|rid, role, allowed)
  const roleBlock = requireRoleOr403(ctx, scope.role ?? null, allowedRoles);
  if (roleBlock) return roleBlock;

  const q = parseQuery(req);
  const role = asString(scope?.role).toLowerCase();
  const today = osloNowISO().slice(0, 10);
  if (role === "kitchen" && q.date && q.date !== today) {
    return jsonErr(rid, "KjÃ¸kken kan kun se dagens ordre.", 403, { code: "FORBIDDEN_DATE", detail: { date: q.date, today } });
  }

  // Valider query
  if (q.date && !isISODate(q.date)) {
    return jsonErr(rid, "Ugyldig datoformat. Bruk YYYY-MM-DD.", 400, { code: "BAD_REQUEST", detail: { date: q.date } });
  }
  if (q.locationId && !isUuid(q.locationId)) {
    return jsonErr(rid, "Ugyldig locationId.", 400, { code: "BAD_REQUEST", detail: { locationId: q.locationId } });
  }

  const rawIds = uniq(q.orderIds).filter(isUuid);
  const hasIds = rawIds.length > 0;
  const hasFilter = !!(q.date || q.slot || q.companyId || q.locationId);

  if (!hasIds && !hasFilter) {
    return jsonErr(rid, "Mangler input. Send enten query orderId=... (flere) eller filter (date/slot/companyId/locationId).", 400, { code: "BAD_REQUEST", detail: { q } });
  }

  const admin = supabaseAdmin();

  const userId = asString(scope?.userId);
  if (!userId) return jsonErr(rid, "Mangler bruker.", 403, "FORBIDDEN");

  const { data: prof, error: profErr } = await loadProfileByUserId(
    admin as any,
    userId,
    "company_id, location_id, disabled_at, is_active"
  );

  if (profErr || !prof) return jsonErr(rid, "Mangler profil.", 403, "FORBIDDEN");
  if ((prof as any).disabled_at || (prof as any).is_active === false) {
    return jsonErr(rid, "Bruker er deaktivert.", 403, "FORBIDDEN");
  }

  const companyId = asString((prof as any).company_id);
  const locationId = asString((prof as any).location_id);
  if (!companyId) return jsonErr(rid, "Mangler firmatilknytning.", 403, "MISSING_COMPANY");

  if (q.companyId && q.companyId !== companyId) {
    return jsonErr(rid, "Ugyldig firmatilknytning.", 403, "FORBIDDEN");
  }
  if (locationId && q.locationId && q.locationId !== locationId) {
    return jsonErr(rid, "Ugyldig lokasjon.", 403, "FORBIDDEN");
  }

  let ids: string[] = [];
  if (hasIds) {
    let sel = admin.from("orders").select("id").in("id", rawIds).eq("company_id", companyId);
    if (role === "kitchen") sel = sel.eq("date", today);
    if (locationId) sel = sel.eq("location_id", locationId);
    const { data, error } = await sel;
    if (error) {
      return jsonErr(rid, "Kunne ikke hente ordre for dry-run.", 500, { code: "DB_ERROR", detail: {
        code: error.code,
        message: error.message,
        detail: (error as any).details ?? (error as any).hint ?? null,
      } });
    }
    ids = uniq((data ?? []).map((r: any) => String(r.id))).filter(isUuid);
  } else {
    let sel = admin.from("orders").select("id");
    if (q.date) sel = sel.eq("date", q.date);
    if (!q.date && role === "kitchen") sel = sel.eq("date", today);
    if (q.slot) sel = sel.eq("slot", q.slot);
    sel = sel.eq("company_id", companyId);
    if (locationId) sel = sel.eq("location_id", locationId);

    const { data, error } = await sel;
    if (error) {
      return jsonErr(rid, "Kunne ikke hente ordre for dry-run.", 500, { code: "DB_ERROR", detail: {
        code: error.code,
        message: error.message,
        detail: (error as any).details ?? (error as any).hint ?? null,
      } });
    }

    ids = uniq((data ?? []).map((r: any) => String(r.id))).filter(isUuid);
  }

  const MAX_RETURN = 200;
  return jsonOk(rid, {
      matched: ids.length,
      idsPreview: ids.slice(0, MAX_RETURN),
      truncated: ids.length > MAX_RETURN,
      mode: hasIds ? "ids" : "filter",
      q,
    }, 200);
}

/**
 * POST = APPLY
 * - Oppdaterer status pÃ¥ mange ordre samtidig
 * - Logger 1 audit-rad (batch)
 */
export async function POST(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid } = a.ctx;
  const deny = requireRoleOr403(a.ctx, "kitchen.orders.batch-status.POST", [...allowedRoles]);
  if (deny) return deny;

  return jsonErr(
    rid,
    "Skriving til ordrestatus via kjøkken er deaktivert. Endepunktet er nå skrivebeskyttet.",
    403,
    { code: "READ_ONLY_ENDPOINT" }
  );
}

