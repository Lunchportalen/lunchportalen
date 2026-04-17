// app/api/order/cancel/route.ts
// CANONICAL — employee cancel HTTP entry (day_choices + cutoff/policy). Orders row changes go through /api/order/set-day (lp_order_set) where applicable.

/* agents-ci: JSON responses include ok: true, rid: (success) and ok: false, rid: (errors) via jsonOrderWrite*. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  coerceOrderWriteErrorResponse,
  jsonOrderWriteErr,
  jsonOrderWriteOk,
  makeRid,
  orderWriteStatusFromDb,
} from "@/lib/http/respond";
import { persistDayChoiceOrderCancelOutbox } from "@/lib/orderBackup/outbox";
import type { Database } from "@/lib/types/database";
import { assertCompanyActiveOr403 } from "@/lib/guards/assertCompanyActiveApi";
import { assertCompanyOrderWriteAllowed } from "@/lib/orders/companyOrderEligibility";
import { assertOrderWithinAgreementPreflight } from "@/lib/orders/orderWriteGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ORDER_TABLE_SLOT_DEFAULT } from "@/lib/orders/rpcWrite";


type Body = {
  date: string; // YYYY-MM-DD
};

type ProfileRow = {
  id: string;
  company_id: string | null;
  location_id: string | null;
  role?: string | null;
};

type DayChoiceRow = {
  id: string;
  company_id: string;
  location_id: string;
  user_id: string;
  date: string;
  status: string; // "ACTIVE" | "CANCELLED"
  updated_at?: string | null;
};

function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

async function readOrdersRowForReceipt(
  supa: any,
  params: { user_id: string; company_id: string; location_id: string; date: string }
): Promise<{ ok: true; id: string; status: string; updated_at: string | null } | { ok: false }> {
  const { data, error } = await supa
    .from("orders")
    .select("id,status,updated_at")
    .eq("user_id", params.user_id)
    .eq("company_id", params.company_id)
    .eq("location_id", params.location_id)
    .eq("date", params.date)
    .eq("slot", ORDER_TABLE_SLOT_DEFAULT)
    .maybeSingle();

  if (error || !data || typeof (data as any).id !== "string" || !(data as any).id) {
    return { ok: false };
  }
  return {
    ok: true,
    id: String((data as any).id),
    status: String((data as any).status ?? ""),
    updated_at: (data as any).updated_at != null ? String((data as any).updated_at) : null,
  };
}

/** Europe/Oslo "nå" -> (YYYY-MM-DD, HH:MM) */
function osloNowParts() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
    timeHM: `${get("hour")}:${get("minute")}`,
  };
}

/** Lås etter 08:00 Europe/Oslo samme dag */
function cutoffState(dateISO: string) {
  const now = osloNowParts();
  const cutoffTime = "08:00";

  const locked =
    dateISO < now.dateISO ? true : dateISO > now.dateISO ? false : now.timeHM >= cutoffTime;

  return { locked, cutoffTime, now: `${now.dateISO}T${now.timeHM}` };
}

function weekdayKeyOslo(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" {
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    weekday: "short",
  }).format(d);

  const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
  };

  const key = map[wd];
  if (!key) throw new Error("Dato må være Man–Fre.");
  return key;
}

async function getAuthedUserId() {
  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const cookieStore = await cookies();

  const supa = createServerClient<Database>(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set() {},
      remove() {},
    },
  });

  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

function supabaseService() {
  return supabaseAdmin();
}

export async function POST(req: Request) {
  const rid = makeRid();

  try {
    const body = (await req.json().catch(() => null)) as Partial<Body> | null;
    const date = (body?.date ?? "").trim();

    // 0) Input validering
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonOrderWriteErr(rid, 400, "BAD_DATE", "Ugyldig datoformat. Bruk YYYY-MM-DD.");
    }

    // 1) Auth (cookie-basert)
    const user_id = await getAuthedUserId();
    if (!user_id) {
      return jsonOrderWriteErr(rid, 401, "UNAUTH", "Ikke innlogget.");
    }

    // 2) Cutoff-lås
    const cutoff = cutoffState(date);
    if (cutoff.locked) {
      return jsonOrderWriteErr(rid, 423, "LOCKED", "Dagen er låst etter 08:00.");
    }

    // 3) Ukedag (Man–Fri)
    try {
      weekdayKeyOslo(date);
    } catch {
      return jsonOrderWriteErr(rid, 400, "WEEKDAY_ONLY", "Dato må være Man–Fre. Helg bestilles ikke i portalen.");
    }

    // 4) Service role for DB (ingen RLS)
    const supa = supabaseService();

    // 5) Profil -> firma + lokasjon
    const { data: profileRaw, error: pErr } = await (supa as any)
      .from("profiles")
      .select("id, company_id, location_id, role")
      .eq("id", user_id)
      .maybeSingle();

    const profile = (profileRaw ?? null) as ProfileRow | null;

    if (pErr) {
      logApiError("POST /api/order/cancel profile failed", pErr, { rid, user_id, date });
      return jsonOrderWriteErr(rid, 500, "PROFILE_LOOKUP_FAILED", "Kunne ikke hente profil.");
    }

    if (!profile) {
      return jsonOrderWriteErr(rid, 403, "PROFILE_NOT_FOUND", "Fant ikke profil.");
    }

    const company_id = profile.company_id;
    const location_id = profile.location_id;

    if (!company_id || !location_id) {
      return jsonOrderWriteErr(rid, 403, "PROFILE_MISSING_SCOPE", "Profil mangler company_id/location_id.");
    }

    const gate = await assertCompanyActiveOr403({
      supa: supa as any,
      companyId: company_id,
      rid,
    });
    if (gate.ok === false) return await coerceOrderWriteErrorResponse(gate.res);

    const hold = await assertCompanyOrderWriteAllowed(supa as any, company_id, rid);
    if (hold.ok === false) {
      return jsonOrderWriteErr(rid, hold.status, hold.code, hold.message);
    }

    const ruleSlot = "lunch";
    const pre = await assertOrderWithinAgreementPreflight({
      sb: supa as any,
      companyId: company_id,
      locationId: location_id,
      orderIsoDate: date,
      agreementRuleSlot: ruleSlot,
      rid,
      action: "CANCEL",
    });
    if (pre.ok === false) {
      return jsonOrderWriteErr(rid, pre.status, pre.code, pre.message);
    }

    // 7) Finn eksisterende day_choice (idempotent)
    const { data: existingRaw, error: eErr } = await (supa as any)
      .from("day_choices")
      .select("id, company_id, location_id, user_id, date, status, updated_at")
      .eq("company_id", company_id)
      .eq("location_id", location_id)
      .eq("user_id", user_id)
      .eq("date", date)
      .maybeSingle();

    const existing = (existingRaw ?? null) as DayChoiceRow | null;

    if (eErr) {
      logApiError("POST /api/order/cancel read existing failed", eErr, {
        rid,
        company_id,
        location_id,
        user_id,
        date,
      });
      return jsonOrderWriteErr(rid, 500, "READ_FAILED", "Kunne ikke lese eksisterende valg.");
    }

    if (!existing) {
      return jsonOrderWriteErr(rid, 404, "ORDER_NOT_FOUND", "Ingen bestilling å avbestille for denne dagen.");
    }

    const persistCancelOutboxOrErr = async (ordRow: { id: string; status: string }) => {
      try {
        await persistDayChoiceOrderCancelOutbox({
          dbEventKey: `order.cancel.day_choice:${user_id}:${date}`,
          rid,
          orderId: ordRow.id,
          companyId: company_id,
          locationId: location_id,
          userId: user_id,
          userEmail: null,
          date,
          orderStatus: ordRow.status,
        });
      } catch (e) {
        logApiError("POST /api/order/cancel outbox persist failed", e, { rid, user_id, date });
        return jsonOrderWriteErr(rid, 500, "OUTBOX_PERSIST_FAILED", "Kunne ikke lagre operasjonsspor. Prøv igjen.");
      }
      return null;
    };

    const statusUpper = String(existing.status ?? "").toUpperCase();
    if (statusUpper === "CANCELLED") {
      const ord = await readOrdersRowForReceipt(supa, { user_id, company_id, location_id, date });
      if (!ord.ok) {
        return jsonOrderWriteErr(rid, 404, "ORDER_NOT_FOUND", "Allerede avbestilt; fant ikke verifiserbar ordre.");
      }
      const obErr = await persistCancelOutboxOrErr({ id: ord.id, status: ord.status });
      if (obErr) return obErr;
      return jsonOrderWriteOk(rid, {
        orderId: ord.id,
        status: orderWriteStatusFromDb(ord.status),
        date,
        timestamp: new Date().toISOString(),
      });
    }

    // 8) Marker som CANCELLED (behold rad)
    const { data: updatedRaw, error: uErr } = await (supa as any)
      .from("day_choices")
      .update({ status: "CANCELLED" })
      .eq("id", existing.id)
      .select("id, date, status, updated_at")
      .single();

    if (uErr || !updatedRaw) {
      logApiError("POST /api/order/cancel update failed", uErr, { rid, existingId: existing.id });
      return jsonOrderWriteErr(rid, 500, "CANCEL_FAILED", "Kunne ikke avbestille.");
    }

    const ord = await readOrdersRowForReceipt(supa, { user_id, company_id, location_id, date });
    if (!ord.ok) {
      return jsonOrderWriteErr(rid, 500, "ORDER_READ_FAILED", "Avbestilling utført, men ordre kunne ikke verifiseres.");
    }

    const obErr2 = await persistCancelOutboxOrErr({ id: ord.id, status: ord.status });
    if (obErr2) return obErr2;

    return jsonOrderWriteOk(rid, {
      orderId: ord.id,
      status: orderWriteStatusFromDb(ord.status),
      date,
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    logApiError("POST /api/order/cancel failed", e, { rid: "cancel_unknown" });
    return jsonOrderWriteErr(makeRid(), 500, "SERVER_ERROR", "Uventet feil.");
  }
}
