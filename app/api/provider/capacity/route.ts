export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { hasProviderRole } from "@/lib/auth/provider";
import { getProviderAdminContext } from "@/lib/auth/providerContext";
import {
  parseCapacityMode,
  remainingCapacity,
  type CapacityMode,
  type ProviderCapacityDayView,
  type ProviderCapacityPolicyView,
} from "@/lib/capacity/providerCapacity";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WRITE_ROLE = "provider_admin" as const;
const READ_ROLE = "provider_viewer" as const;

function isoDate(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function mapDay(row: Record<string, unknown>): ProviderCapacityDayView {
  const mode = parseCapacityMode(row.capacity_mode) ?? "LIMITED";
  const limit = row.capacity_limit == null ? null : Number(row.capacity_limit);
  const reserved = Number(row.reserved_qty ?? 0);
  const released = Number(row.released_qty ?? 0);
  return {
    providerId: String(row.provider_id),
    serviceDate: String(row.service_date).slice(0, 10),
    choiceKey: String(row.choice_key),
    capacityMode: mode,
    capacityLimit: Number.isFinite(limit as number) ? limit : null,
    reservedQty: reserved,
    releasedQty: released,
    remainingQty: remainingCapacity(mode, limit, reserved),
    countryCode: String(row.country_code ?? "NO"),
    timezone: String(row.timezone ?? "Europe/Oslo"),
    locationId: row.location_id ? String(row.location_id) : null,
    deliveryWindow: row.delivery_window ? String(row.delivery_window) : null,
    productId: row.product_id ? String(row.product_id) : null,
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export async function GET(req: NextRequest) {
  const rid = makeRid("prov_cap");
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
  }

  const userId = String(auth.user.id).trim();
  const ctx = await getProviderAdminContext(userId);
  const provider = ctx.primaryProvider;
  if (!provider) {
    return jsonErr(rid, "Ingen leverandørtilgang.", 403, "FORBIDDEN");
  }

  const canRead =
    (await hasProviderRole(userId, provider.id, READ_ROLE)) ||
    (await hasProviderRole(userId, provider.id, WRITE_ROLE)) ||
    (await hasProviderRole(userId, provider.id, "provider_kitchen"));
  if (!canRead) {
    return jsonErr(rid, "Du har ikke tilgang til kapasitet.", 403, "FORBIDDEN");
  }

  const url = new URL(req.url);
  const from = isoDate(url.searchParams.get("from")) ?? new Date().toISOString().slice(0, 10);
  const to = isoDate(url.searchParams.get("to")) ?? from;
  const choiceKey = String(url.searchParams.get("choiceKey") ?? "").trim() || null;

  const admin = supabaseAdmin();
  const { data: policyRow, error: policyErr } = await admin
    .from("provider_capacity_policy")
    .select("provider_id,country_code,timezone,default_mode,default_capacity_limit,migration_decision")
    .eq("provider_id", provider.id)
    .maybeSingle();
  if (policyErr) {
    return jsonErr(rid, "Kunne ikke hente kapasitetspolicy.", 500, "CAPACITY_POLICY_READ_FAILED");
  }

  let dayQuery = admin
    .from("dish_day_capacity")
    .select(
      "provider_id,service_date,choice_key,capacity_mode,capacity_limit,reserved_qty,released_qty,country_code,timezone,location_id,delivery_window,product_id,updated_at",
    )
    .eq("provider_id", provider.id)
    .gte("service_date", from)
    .lte("service_date", to)
    .order("service_date", { ascending: true });
  if (choiceKey) dayQuery = dayQuery.eq("choice_key", choiceKey);

  const { data: days, error: dayErr } = await dayQuery;
  if (dayErr) {
    return jsonErr(rid, "Kunne ikke hente dagskapasitet.", 500, "CAPACITY_DAY_READ_FAILED");
  }

  const { data: audit, error: auditErr } = await admin
    .from("dish_day_capacity_audit")
    .select("id,provider_id,service_date,choice_key,actor_id,action,created_at")
    .eq("provider_id", provider.id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (auditErr) {
    return jsonErr(rid, "Kunne ikke hente kapasitetsrevisjon.", 500, "CAPACITY_AUDIT_READ_FAILED");
  }

  const policy: ProviderCapacityPolicyView | null = policyRow
    ? {
        providerId: String(policyRow.provider_id),
        countryCode: String(policyRow.country_code ?? "NO"),
        timezone: String(policyRow.timezone ?? "Europe/Oslo"),
        defaultMode: (parseCapacityMode(policyRow.default_mode) ?? "UNLIMITED") as CapacityMode,
        defaultCapacityLimit:
          policyRow.default_capacity_limit == null ? null : Number(policyRow.default_capacity_limit),
        migrationDecision: policyRow.migration_decision ? String(policyRow.migration_decision) : null,
      }
    : null;

  return jsonOk(rid, {
    providerId: provider.id,
    providerName: provider.name,
    policy,
    days: (Array.isArray(days) ? days : []).map((r) => mapDay(r as Record<string, unknown>)),
    audit: Array.isArray(audit) ? audit : [],
  });
}

export async function PUT(req: NextRequest) {
  const rid = makeRid("prov_cap");
  const auth = await getAuthContext();
  if (!auth.ok || !auth.user?.id) {
    return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTHORIZED");
  }

  const userId = String(auth.user.id).trim();
  const ctx = await getProviderAdminContext(userId);
  const provider = ctx.primaryProvider;
  if (!provider) {
    return jsonErr(rid, "Ingen leverandørtilgang.", 403, "FORBIDDEN");
  }

  const canWrite = await hasProviderRole(userId, provider.id, WRITE_ROLE);
  if (!canWrite) {
    return jsonErr(rid, "Du har ikke tilgang til å endre kapasitet.", 403, "FORBIDDEN");
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonErr(rid, "Ugyldig JSON.", 400, "BAD_REQUEST");
  }

  // Fail closed: never accept another provider_id from client.
  if (body.providerId && String(body.providerId) !== provider.id) {
    return jsonErr(rid, "Kan ikke endre kapasitet for annen leverandør.", 403, "WRONG_PROVIDER");
  }
  if (body.countryCode && String(body.countryCode).trim().toUpperCase() !== "NO") {
    return jsonErr(rid, "Kapasitet kan kun settes for Norge (NO).", 422, "WRONG_COUNTRY");
  }

  const serviceDate = isoDate(body.serviceDate);
  if (!serviceDate) {
    return jsonErr(rid, "Ugyldig serviceDate (YYYY-MM-DD).", 422, "INVALID_DATE");
  }

  const mode = parseCapacityMode(body.capacityMode);
  if (!mode) {
    return jsonErr(rid, "Ugyldig capacityMode. Bruk UNLIMITED, LIMITED eller CLOSED.", 422, "INVALID_MODE");
  }

  const choiceKey = String(body.choiceKey ?? "varmrett").trim() || "varmrett";
  const capacityLimit =
    body.capacityLimit == null || body.capacityLimit === ""
      ? null
      : Number(body.capacityLimit);
  if (mode === "LIMITED" && (!Number.isInteger(capacityLimit) || (capacityLimit as number) < 0)) {
    return jsonErr(rid, "LIMITED krever et heltallig capacityLimit >= 0.", 422, "INVALID_LIMIT");
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin.rpc("lp_capacity_upsert_day", {
    p_provider_id: provider.id,
    p_service_date: serviceDate,
    p_choice_key: choiceKey,
    p_capacity_mode: mode,
    p_capacity_limit: mode === "LIMITED" ? capacityLimit : null,
    p_actor_id: userId,
    p_country_code: "NO",
    p_timezone: "Europe/Oslo",
    p_location_id: body.locationId ? String(body.locationId) : null,
    p_delivery_window: body.deliveryWindow ? String(body.deliveryWindow) : null,
    p_product_id: body.productId ? String(body.productId) : null,
    p_allow_below_reserved: false,
    p_note: body.note ? String(body.note).slice(0, 500) : "provider_capacity_ui",
  });

  if (error) {
    const msg = String(error.message || "");
    if (msg.includes("CAPACITY_BELOW_RESERVED")) {
      return jsonErr(
        rid,
        "Kan ikke sette kapasitet under allerede reserverte bestillinger.",
        409,
        "CAPACITY_BELOW_RESERVED",
      );
    }
    return jsonErr(rid, "Kunne ikke lagre kapasitet.", 500, "CAPACITY_UPSERT_FAILED");
  }

  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  return jsonOk(rid, {
    day: row ? mapDay(row) : null,
  });
}
