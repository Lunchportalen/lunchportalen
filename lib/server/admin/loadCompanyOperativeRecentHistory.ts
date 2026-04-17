// lib/server/admin/loadCompanyOperativeRecentHistory.ts
/** Firmascopet read-only feed: audit_events + siste ordre-rader (samme filter som ellers, ingen ny auditmotor). */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid } from "@/lib/agreements/normalize";
import { formatDateNO, formatTimeNO } from "@/lib/date/format";
import { normKitchenSlot } from "@/lib/server/kitchen/loadOperativeKitchenOrders";
import { supabaseAdmin } from "@/lib/supabase/admin";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isIsoDateish(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function detailRecord(d: unknown): Record<string, unknown> | null {
  if (!d || typeof d !== "object" || Array.isArray(d)) return null;
  return d as Record<string, unknown>;
}

function pickOperativeDateFromAuditDetail(detail: unknown): string | null {
  const o = detailRecord(detail);
  if (!o) return null;
  const candidates = [o.date, o.delivery_date, o.p_date, (o.metadata as Record<string, unknown> | undefined)?.date];
  for (const c of candidates) {
    const s = safeStr(c);
    if (isIsoDateish(s)) return s;
  }
  return null;
}

function actorHintNb(actorRole: string | null, actorEmail: string | null): string | null {
  const role = actorRole ? safeStr(actorRole).toLowerCase() : "";
  if (role === "superadmin") return "Drift (superadmin)";
  if (role === "company_admin") return "Firmaadministrator";
  if (role === "employee") return "Ansatt";
  if (role === "driver") return "Sjåfør";
  if (role === "kitchen") return "Kjøkken";
  if (actorEmail) return safeStr(actorEmail);
  if (actorRole) return safeStr(actorRole);
  return null;
}

export type CompanyOperativeHistoryItem = {
  sort_at: string;
  source_kind: "audit" | "order";
  source_label_nb: string;
  title_nb: string;
  body_nb: string;
  operative_date_iso: string | null;
  location_label_nb: string | null;
  slot_label_nb: string | null;
  actor_hint_nb: string | null;
};

export type CompanyOperativeRecentHistoryPayload = {
  ok: true;
  company_id: string;
  items: CompanyOperativeHistoryItem[];
  warning_nb: string | null;
};

function mergeAndSort(
  auditItems: CompanyOperativeHistoryItem[],
  orderItems: CompanyOperativeHistoryItem[],
  take: number,
): CompanyOperativeHistoryItem[] {
  const all = [...auditItems, ...orderItems];
  all.sort((a, b) => {
    const c = b.sort_at.localeCompare(a.sort_at);
    if (c !== 0) return c;
    return `${a.source_kind}:${a.title_nb}`.localeCompare(`${b.source_kind}:${b.title_nb}`);
  });
  return all.slice(0, take);
}

export async function loadCompanyOperativeRecentHistory(input: {
  companyId: string;
}): Promise<CompanyOperativeRecentHistoryPayload> {
  const companyId = safeStr(input.companyId);
  if (!companyId || !isUuid(companyId)) {
    return { ok: true, company_id: "", items: [], warning_nb: "Mangler gyldig company_id." };
  }

  let admin: SupabaseClient;
  try {
    admin = supabaseAdmin() as unknown as SupabaseClient;
  } catch {
    return {
      ok: true,
      company_id: companyId,
      items: [],
      warning_nb: "Kunne ikke lese operativ historikk (service role mangler).",
    };
  }

  const auditFilter = `entity_id.eq.${companyId},detail->>company_id.eq.${companyId}`;

  const [auditRes, ordersRes, locRes] = await Promise.all([
    admin
      .from("audit_events")
      .select("id,created_at,action,summary,entity_type,entity_id,detail,actor_role,actor_email")
      .or(auditFilter)
      .order("created_at", { ascending: false })
      .limit(32),
    admin
      .from("orders")
      .select("id,created_at,updated_at,date,status,slot,location_id,user_id")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(18),
    admin.from("company_locations").select("id,name").eq("company_id", companyId),
  ]);

  const warnings: string[] = [];
  if (auditRes.error) {
    const m = safeStr(auditRes.error.message);
    if (!m.toLowerCase().includes("does not exist") && !m.toLowerCase().includes("relation")) {
      console.warn("[loadCompanyOperativeRecentHistory] audit_events", m);
    }
    warnings.push("Kunne ikke lese hendelseslogg (audit_events).");
  }
  if (ordersRes.error) {
    const m = safeStr(ordersRes.error.message);
    console.warn("[loadCompanyOperativeRecentHistory] orders", m);
    warnings.push("Kunne ikke lese siste ordreendringer.");
  }

  const locName = new Map<string, string>();
  if (!locRes.error && Array.isArray(locRes.data)) {
    for (const row of locRes.data as { id?: unknown; name?: unknown }[]) {
      const id = safeStr(row.id);
      if (id) locName.set(id, safeStr(row.name) || id);
    }
  }

  const auditRows = !auditRes.error && Array.isArray(auditRes.data) ? auditRes.data : [];
  const orderRows = !ordersRes.error && Array.isArray(ordersRes.data) ? ordersRes.data : [];

  const userIds = new Set<string>();
  for (const r of orderRows) {
    const u = safeStr((r as { user_id?: unknown }).user_id);
    if (u && isUuid(u)) userIds.add(u);
  }

  const emailByUserId = new Map<string, string>();
  if (userIds.size > 0) {
    const { data: profs, error: pErr } = await admin
      .from("profiles")
      .select("user_id,email")
      .eq("company_id", companyId)
      .in("user_id", [...userIds]);
    if (!pErr && Array.isArray(profs)) {
      for (const p of profs as { user_id?: unknown; email?: unknown }[]) {
        const uid = safeStr(p.user_id);
        const em = safeStr(p.email);
        if (uid && em) emailByUserId.set(uid, em);
      }
    }
  }

  const auditItems: CompanyOperativeHistoryItem[] = auditRows.map((x: Record<string, unknown>) => {
    const id = safeStr(x.id);
    const created_at = safeStr(x.created_at);
    const action = x.action != null ? safeStr(x.action) : null;
    const summary = x.summary != null ? safeStr(x.summary) : null;
    const entity_type = x.entity_type != null ? safeStr(x.entity_type) : null;
    const entity_id = x.entity_id != null ? safeStr(x.entity_id) : null;
    const detail = x.detail;
    const opDate = pickOperativeDateFromAuditDetail(detail);
    const et = entity_type || "hendelse";
    const title =
      summary ||
      [action, et].filter(Boolean).join(" · ") ||
      "Hendelse";
    const bodyParts: string[] = [];
    if (action) bodyParts.push(`Handling: ${action}`);
    if (entity_type) bodyParts.push(`Entitet: ${entity_type}`);
    if (entity_id && entity_id !== companyId) bodyParts.push(`Referanse: ${entity_id}`);
    const slotFromDetail = safeStr(detailRecord(detail)?.slot);
    const locFromDetail = safeStr(detailRecord(detail)?.location_id);
    return {
      sort_at: created_at || "1970-01-01T00:00:00Z",
      source_kind: "audit" as const,
      source_label_nb: "Logg",
      title_nb: title,
      body_nb: bodyParts.join(" · ") || "Hendelse registrert i audit_events.",
      operative_date_iso: opDate,
      location_label_nb: locFromDetail ? locName.get(locFromDetail) ?? locFromDetail : null,
      slot_label_nb: slotFromDetail ? normKitchenSlot(slotFromDetail) : null,
      actor_hint_nb: actorHintNb(x.actor_role != null ? safeStr(x.actor_role) : null, x.actor_email != null ? safeStr(x.actor_email) : null),
    };
  });

  const orderItems: CompanyOperativeHistoryItem[] = orderRows.map((x: Record<string, unknown>) => {
    const updated_at = safeStr(x.updated_at);
    const created_at = safeStr(x.created_at);
    const sortAt = updated_at || created_at || "1970-01-01T00:00:00Z";
    const dateIso = safeStr(x.date);
    const status = safeStr(x.status).toUpperCase() || "—";
    const slot = normKitchenSlot(x.slot);
    const lid = safeStr(x.location_id);
    const uid = safeStr(x.user_id);
    const locLabel = lid ? locName.get(lid) ?? lid : null;
    const em = uid ? emailByUserId.get(uid) : null;
    const who = em ? `Bestiller: ${em}` : uid ? `Bruker-ID: ${uid.slice(0, 8)}…` : null;
    return {
      sort_at: sortAt,
      source_kind: "order" as const,
      source_label_nb: "Ordre",
      title_nb: `Ordre ${status}`,
      body_nb: [who, `Ordre-ID: ${safeStr(x.id)}`].filter(Boolean).join(" · "),
      operative_date_iso: isIsoDateish(dateIso) ? dateIso : null,
      location_label_nb: locLabel,
      slot_label_nb: slot || null,
      actor_hint_nb: who,
    };
  });

  const items = mergeAndSort(auditItems, orderItems, 40);

  return {
    ok: true,
    company_id: companyId,
    items,
    warning_nb: warnings.length ? warnings.join(" ") : null,
  };
}

export function formatCompanyOperativeHistoryWhenNb(isoDatetime: string): string {
  const d = safeStr(isoDatetime);
  if (!d) return "—";
  const datePart = d.length >= 10 ? d.slice(0, 10) : d;
  const timePart = formatTimeNO(d.includes("T") ? d : `${datePart}T12:00:00Z`);
  return `${formatDateNO(datePart)} kl. ${timePart}`;
}
