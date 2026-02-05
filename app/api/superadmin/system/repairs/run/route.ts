export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, readJson } from "@/lib/http/routeGuard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { opsLog } from "@/lib/ops/log";
import { processOutboxBatch } from "@/lib/orderBackup/outbox";

type OpsEventInput = {
  level: "info" | "warn" | "error";
  event: string;
  scope_company_id?: string | null;
  scope_user_id?: string | null;
  data?: Record<string, any>;
  rid?: string | null;
};

type RepairJobRow = {
  id: string;
  job_type: string;
  payload: Record<string, any>;
  state: "pending" | "running" | "done" | "failed" | string;
  attempts: number;
  next_run_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  rid: string | null;
};

type MotorResult = {
  ran: true;
  queued: number;
  claimed: number;
  done: number;
  failed: number;
  source: "manual" | "cron" | string;
};

type OrderRow = {
  id: string;
  user_id: string | null;
  date: string | null;
  status: string | null;
  company_id: string | null;
  location_id: string | null;
  slot: string | null;
  created_at: string | null;
  integrity_status?: string | null;
};

const JOB_PROFILE = "repair.profile.missing";
const JOB_OUTBOX = "repair.outbox.retry";
const JOB_ORDER_DEDUPE = "order.dedupe";
const JOB_ORDER_NORMALIZE = "order.normalize_status";
const JOB_ORDER_QUARANTINE = "order.quarantine";

const OUTBOX_TABLE = "order_email_outbox";
const ORDER_CANONICAL = new Set(["ACTIVE", "CANCELED", "DELIVERED"]);

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function clampInt(v: any, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function errMessage(err: any) {
  return safeStr(err?.message || err?.details || err?.hint || err?.code || "");
}

function isMissingRelation(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42P01" || msg.includes("does not exist") || msg.includes("relation");
}

function isMissingColumn(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42703" || msg.includes("column") || msg.includes("schema cache");
}

function isMissingFunction(err: any) {
  const msg = errMessage(err).toLowerCase();
  return err?.code === "42883" || (msg.includes("function") && msg.includes("does not exist"));
}

function isISODate(d: any) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

function daysAgoISO(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function normalizeOrderStatus(raw: any): { normalized: string | null } {
  const s = safeStr(raw);
  if (!s) return { normalized: null };
  const upper = s.toUpperCase();
  if (upper === "ACTIVE") return { normalized: "ACTIVE" };
  if (upper === "CANCELED" || upper === "CANCELLED") return { normalized: "CANCELED" };
  if (upper === "DELIVERED") return { normalized: "DELIVERED" };
  return { normalized: null };
}

function isQuarantined(v: any) {
  return safeStr(v).toLowerCase() === "quarantined";
}

async function writeOpsEvent(admin: any, input: OpsEventInput) {
  try {
    const { error } = await admin.from("ops_events").insert({
      level: input.level,
      event: input.event,
      scope_company_id: input.scope_company_id ?? null,
      scope_user_id: input.scope_user_id ?? null,
      data: input.data ?? {},
      rid: input.rid ?? null,
    });
    if (error) throw error;
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      opsLog("ops_events.missing", { rid: input.rid ?? null, event: input.event });
      return;
    }
    opsLog("ops_events.insert_failed", {
      rid: input.rid ?? null,
      message: String(e?.message ?? e),
      event: input.event,
    });
  }
}

async function findIncident(admin: any, type: string, scopeUserId: string | null, repairKey: string | null) {
  const res = await admin
    .from("system_incidents")
    .select("id,count,details,status")
    .eq("type", type)
    .in("status", ["open", "repairing"])
    .limit(50);

  if (res.error) throw res.error;
  const rows = Array.isArray(res.data) ? res.data : [];

  let filtered = rows;
  if (scopeUserId) filtered = filtered.filter((row: any) => safeStr(row?.scope_user_id) === scopeUserId);
  if (repairKey) filtered = filtered.filter((row: any) => row?.details?.repair_key === repairKey);
  return filtered[0] ?? null;
}

async function openOrRepairIncident(admin: any, input: {
  rid: string;
  type: string;
  severity: "info" | "warn" | "crit";
  status: "open" | "repairing";
  message: string;
  scope_user_id?: string | null;
  repair_key?: string | null;
  data?: Record<string, any>;
}) {
  try {
    const now = nowIso();
    const scopeUserId = safeStr(input.scope_user_id ?? "") || null;
    const repairKey = safeStr(input.repair_key ?? "") || null;

    const existing = await findIncident(admin, input.type, scopeUserId, repairKey);
    const details = {
      ...(existing?.details ?? {}),
      ...(input.data ?? {}),
      repair_key: repairKey,
      last_message: input.message,
      last_status: input.status,
    };

    if (existing) {
      const count = Number(existing.count ?? 0) + 1;
      const { error } = await admin
        .from("system_incidents")
        .update({
          severity: input.severity,
          status: input.status,
          last_seen: now,
          count,
          details,
          rid: input.rid,
        })
        .eq("id", existing.id);

      if (error) throw error;
      return;
    }

    const { error } = await admin.from("system_incidents").insert({
      severity: input.severity,
      type: input.type,
      scope_company_id: null,
      scope_user_id: scopeUserId,
      scope_order_id: null,
      first_seen: now,
      last_seen: now,
      count: 1,
      status: input.status,
      details,
      rid: input.rid,
    });

    if (error) throw error;
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      opsLog("system_incidents.missing", { rid: input.rid, type: input.type });
      return;
    }
    opsLog("system_incident.open_failed", { rid: input.rid, message: String(e?.message ?? e), type: input.type });
  }
}

async function resolveIncident(admin: any, input: {
  rid: string;
  type: string;
  message: string;
  scope_user_id?: string | null;
  repair_key?: string | null;
}) {
  try {
    const now = nowIso();
    const scopeUserId = safeStr(input.scope_user_id ?? "") || null;
    const repairKey = safeStr(input.repair_key ?? "") || null;

    const existing = await findIncident(admin, input.type, scopeUserId, repairKey);
    if (!existing) return;

    const details = {
      ...(existing.details ?? {}),
      repair_key: repairKey,
      resolved_at: now,
      last_message: input.message,
      last_status: "resolved",
    };

    const { error } = await admin
      .from("system_incidents")
      .update({
        severity: "info",
        status: "resolved",
        last_seen: now,
        details,
        rid: input.rid,
      })
      .eq("id", existing.id);

    if (error) throw error;
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      opsLog("system_incidents.missing", { rid: input.rid, type: input.type });
      return;
    }
    opsLog("system_incident.resolve_failed", { rid: input.rid, message: String(e?.message ?? e), type: input.type });
  }
}

async function outboxTableExists(admin: any, rid: string) {
  try {
    const { error } = await admin
      .from(OUTBOX_TABLE)
      .select("event_key", { head: true, count: "exact" })
      .limit(1);

    if (error) throw error;
    return true;
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      await openOrRepairIncident(admin, {
        rid,
        type: "OUTBOX_MISSING",
        severity: "warn",
        status: "open",
        message: "Outbox-tabell mangler. Reparasjon stoppet.",
      });
      await writeOpsEvent(admin, {
        level: "warn",
        event: "repair.outbox.missing",
        data: { table: OUTBOX_TABLE },
        rid,
      });
      return false;
    }
    opsLog("repair.outbox.check_failed", { rid, message: String(e?.message ?? e) });
    return false;
  }
}

async function enqueueJob(admin: any, input: {
  rid: string;
  job_type: string;
  payload: Record<string, any>;
  dedupe_key?: string | null;
}) {
  const dedupeKey = safeStr(input.dedupe_key ?? "") || null;

  try {
    if (dedupeKey) {
      const { data, error } = await admin
        .from("repair_jobs")
        .select("id")
        .eq("job_type", input.job_type)
        .in("state", ["pending", "running"])
        .contains("payload", { dedupe_key: dedupeKey })
        .limit(1);

      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        return { queued: false, id: data[0].id as string };
      }
    }

    const payload = { ...(input.payload ?? {}) };
    if (dedupeKey) payload.dedupe_key = dedupeKey;

    const { data, error } = await admin
      .from("repair_jobs")
      .insert({
        job_type: input.job_type,
        payload,
        state: "pending",
        attempts: 0,
        next_run_at: nowIso(),
        updated_at: nowIso(),
        rid: input.rid,
      })
      .select("id")
      .single();

    if (error) throw error;
    return { queued: true, id: data?.id as string };
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      opsLog("repair_jobs.missing", { rid: input.rid, job_type: input.job_type });
      return { queued: false, id: null };
    }
    opsLog("repair_jobs.enqueue_failed", { rid: input.rid, job_type: input.job_type, message: String(e?.message ?? e) });
    return { queued: false, id: null };
  }
}

async function detectMissingProfileCandidates(admin: any, rid: string) {
  const ids = new Set<string>();

  try {
    const { data, error } = await admin
      .from("orders")
      .select("user_id")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;
    for (const row of data ?? []) {
      const id = safeStr((row as any)?.user_id);
      if (id) ids.add(id);
    }
  } catch (e: any) {
    if (!isMissingRelation(e) && !isMissingColumn(e)) {
      opsLog("repair.profile.detect.orders_failed", { rid, message: String(e?.message ?? e) });
    }
  }

  try {
    const { data, error } = await admin
      .from("system_incidents")
      .select("scope_user_id")
      .not("scope_user_id", "is", null)
      .order("last_seen", { ascending: false })
      .limit(200);

    if (error) throw error;
    for (const row of data ?? []) {
      const id = safeStr((row as any)?.scope_user_id);
      if (id) ids.add(id);
    }
  } catch (e: any) {
    if (!isMissingRelation(e) && !isMissingColumn(e)) {
      opsLog("repair.profile.detect.incidents_failed", { rid, message: String(e?.message ?? e) });
    }
  }

  return Array.from(ids);
}

async function findMissingProfiles(admin: any, rid: string) {
  const candidates = await detectMissingProfileCandidates(admin, rid);
  if (!candidates.length) return [];

  try {
    const { data, error } = await admin
      .from("profiles")
      .select("user_id")
      .in("user_id", candidates);

    if (error) throw error;
    const existing = new Set<string>();
    for (const row of data ?? []) {
      const id = safeStr((row as any)?.user_id);
      if (id) existing.add(id);
    }

    return candidates.filter((id) => !existing.has(id));
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      await openOrRepairIncident(admin, {
        rid,
        type: "PROFILE_MISSING",
        severity: "warn",
        status: "open",
        message: "Profiler-tabell mangler. Reparasjon stoppet.",
      });
      return [];
    }
    opsLog("repair.profile.detect.failed", { rid, message: String(e?.message ?? e) });
    return [];
  }
}

async function fetchOrderIntegrityCandidates(admin: any, rid: string, fromDate: string) {
  const orders: OrderRow[] = [];
  const select = "id,user_id,date,status,company_id,location_id,slot,created_at,integrity_status";

  try {
    const { data, error } = await admin
      .from("orders")
      .select(select)
      .gte("date", fromDate)
      .limit(5000);

    if (error) throw error;
    orders.push(...((data ?? []) as OrderRow[]));
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      await writeOpsEvent(admin, {
        level: "warn",
        event: "order.integrity.missing",
        data: { message: "orders-tabell eller kolonner mangler" },
        rid,
      });
      return [] as OrderRow[];
    }
    opsLog("order.integrity.fetch_failed", { rid, message: String(e?.message ?? e) });
    return [] as OrderRow[];
  }

  try {
    const { data, error } = await admin
      .from("orders")
      .select(select)
      .is("date", null)
      .limit(200);

    if (error) throw error;
    orders.push(...((data ?? []) as OrderRow[]));
  } catch (e: any) {
    if (!isMissingRelation(e) && !isMissingColumn(e)) {
      opsLog("order.integrity.fetch_null_date_failed", { rid, message: String(e?.message ?? e) });
    }
  }

  const deduped = new Map<string, OrderRow>();
  for (const row of orders) {
    const id = safeStr(row?.id);
    if (!id) continue;
    if (!deduped.has(id)) deduped.set(id, row);
  }

  return Array.from(deduped.values());
}

async function loadDeliveryConfirmations(admin: any, rid: string, fromDate: string) {
  const map = new Map<string, { at: string | null; by: string | null }>();
  try {
    const { data, error } = await admin
      .from("delivery_confirmations")
      .select("delivery_date,slot,company_id,location_id,confirmed_at,confirmed_by")
      .gte("delivery_date", fromDate)
      .limit(5000);

    if (error) throw error;

    for (const row of data ?? []) {
      const date = safeStr((row as any)?.delivery_date);
      const slot = safeStr((row as any)?.slot);
      const companyId = safeStr((row as any)?.company_id);
      const locationId = safeStr((row as any)?.location_id);
      if (!date || !slot || !companyId || !locationId) continue;
      const key = `${date}|${slot}|${companyId}|${locationId}`;
      map.set(key, {
        at: safeStr((row as any)?.confirmed_at) || null,
        by: safeStr((row as any)?.confirmed_by) || null,
      });
    }

    return { map, ok: true };
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      await writeOpsEvent(admin, {
        level: "warn",
        event: "order.integrity.delivery_confirmations_missing",
        data: { message: "delivery_confirmations mangler" },
        rid,
      });
      return { map, ok: false };
    }
    opsLog("order.integrity.delivery_confirmations_failed", { rid, message: String(e?.message ?? e) });
    return { map, ok: false };
  }
}

function chunkIds(ids: string[], size: number) {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

async function enqueueOrderIntegrityRepairs(admin: any, rid: string, fromDate: string) {
  const orders = await fetchOrderIntegrityCandidates(admin, rid, fromDate);
  if (!orders.length) return { queued: 0, stats: null as any };

  const quarantineBuckets = new Map<string, string[]>();
  const normalizeBuckets = new Map<string, string[]>();
  const dupeGroups = new Map<string, string[]>();
  const quarantined = new Set<string>();

  const addQuarantine = (id: string, reason: string) => {
    if (quarantined.has(id)) return;
    quarantined.add(id);
    const list = quarantineBuckets.get(reason) ?? [];
    list.push(id);
    quarantineBuckets.set(reason, list);
  };

  for (const o of orders) {
    const id = safeStr(o.id);
    if (!id) continue;
    if (isQuarantined(o.integrity_status)) continue;

    const companyId = safeStr(o.company_id);
    const locationId = safeStr(o.location_id);
    const date = safeStr(o.date);

    if (!companyId || !locationId || !date || !isISODate(date)) {
      addQuarantine(id, "MISSING_SCOPE");
      continue;
    }

    if (!safeStr(o.slot)) {
      addQuarantine(id, "SLOT_MISSING");
      continue;
    }

    const statusInfo = normalizeOrderStatus(o.status);
    if (!statusInfo.normalized || !ORDER_CANONICAL.has(statusInfo.normalized)) {
      addQuarantine(id, "INVALID_STATUS");
      continue;
    }

    const rawStatus = safeStr(o.status);
    if (statusInfo.normalized !== rawStatus) {
      const list = normalizeBuckets.get(statusInfo.normalized) ?? [];
      list.push(id);
      normalizeBuckets.set(statusInfo.normalized, list);
    }

    const userId = safeStr(o.user_id);
    if (userId && date) {
      const key = `${userId}|${date}`;
      const list = dupeGroups.get(key) ?? [];
      list.push(id);
      dupeGroups.set(key, list);
    }
  }

  const deliveryCheck = await loadDeliveryConfirmations(admin, rid, fromDate);
  if (deliveryCheck.ok) {
    for (const o of orders) {
      const id = safeStr(o.id);
      if (!id || quarantined.has(id) || isQuarantined(o.integrity_status)) continue;
      const statusInfo = normalizeOrderStatus(o.status);
      if (statusInfo.normalized !== "DELIVERED") continue;

      const date = safeStr(o.date);
      const slot = safeStr(o.slot);
      const companyId = safeStr(o.company_id);
      const locationId = safeStr(o.location_id);
      if (!date || !slot || !companyId || !locationId) continue;

      const key = `${date}|${slot}|${companyId}|${locationId}`;
      const conf = deliveryCheck.map.get(key);
      if (!conf || !conf.at || !conf.by) {
        addQuarantine(id, "DELIVERY_INCONSISTENT");
      }
    }
  }

  let queued = 0;

  const stats = {
    dedupe_groups: 0,
    normalize_ids: 0,
    quarantine_ids: 0,
    missing_scope_ids: quarantineBuckets.get("MISSING_SCOPE")?.length ?? 0,
    slot_missing_ids: quarantineBuckets.get("SLOT_MISSING")?.length ?? 0,
    invalid_status_ids: quarantineBuckets.get("INVALID_STATUS")?.length ?? 0,
    delivery_inconsistent_ids: quarantineBuckets.get("DELIVERY_INCONSISTENT")?.length ?? 0,
  };

  for (const [reason, ids] of quarantineBuckets.entries()) {
    if (!ids.length) continue;
    stats.quarantine_ids += ids.length;

    await openOrRepairIncident(admin, {
      rid,
      type: `ORDER_${reason}`,
      severity: "crit",
      status: "open",
      message: `Ordre må karanteneres (${reason}).`,
      repair_key: `order_quarantine_${reason.toLowerCase()}`,
      data: { reason, count: ids.length, order_ids: ids.slice(0, 10) },
    });

    const chunks = chunkIds(ids, 100);
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const res = await enqueueJob(admin, {
        rid,
        job_type: JOB_ORDER_QUARANTINE,
        payload: { order_ids: chunk, reason },
        dedupe_key: `order_quarantine:${reason}:${fromDate}:${i}`,
      });
      if (res.queued) queued += 1;
    }
  }

  for (const [target, ids] of normalizeBuckets.entries()) {
    if (!ids.length) continue;
    stats.normalize_ids += ids.length;

    await openOrRepairIncident(admin, {
      rid,
      type: "ORDER_INVALID_STATUS",
      severity: "warn",
      status: "open",
      message: "Ordrestatus må normaliseres.",
      repair_key: "invalid_status.normalize",
      data: { target_status: target, count: ids.length, order_ids: ids.slice(0, 10) },
    });

    const chunks = chunkIds(ids, 200);
    for (let i = 0; i < chunks.length; i += 1) {
      const chunk = chunks[i];
      const res = await enqueueJob(admin, {
        rid,
        job_type: JOB_ORDER_NORMALIZE,
        payload: { order_ids: chunk, target_status: target },
        dedupe_key: `order_normalize:${target}:${fromDate}:${i}`,
      });
      if (res.queued) queued += 1;
    }
  }

  const dupeEntries = Array.from(dupeGroups.entries()).filter(([, ids]) => ids.length > 1);
  stats.dedupe_groups = dupeEntries.length;

  for (const [key, ids] of dupeEntries) {
    const [userId, date] = key.split("|");
    if (!userId || !date) continue;

    await openOrRepairIncident(admin, {
      rid,
      type: "ORDER_DUPLICATE",
      severity: "warn",
      status: "open",
      message: "Duplikate ordre per bruker/dato.",
      repair_key: `dedupe:${userId}:${date}`,
      data: { user_id: userId, date, order_ids: ids.slice(0, 10) },
    });

    const res = await enqueueJob(admin, {
      rid,
      job_type: JOB_ORDER_DEDUPE,
      payload: { user_id: userId, date },
      dedupe_key: `dedupe:${userId}:${date}`,
    });
    if (res.queued) queued += 1;
  }

  await writeOpsEvent(admin, {
    level: "info",
    event: "order.integrity.run",
    data: { window_start: fromDate, queued, ...stats },
    rid,
  });

  return { queued, stats };
}

async function enqueueRepairs(admin: any, rid: string, limit: number, includeOrderIntegrity: boolean) {
  let queued = 0;

  const missingProfiles = await findMissingProfiles(admin, rid);
  const maxProfiles = missingProfiles.slice(0, limit);

  for (const userId of maxProfiles) {
    const repairKey = `profile:${userId}`;

    await openOrRepairIncident(admin, {
      rid,
      type: "PROFILE_MISSING",
      severity: "warn",
      status: "open",
      message: "Manglende profil oppdaget.",
      scope_user_id: userId,
      repair_key: repairKey,
      data: { user_id: userId },
    });

    const res = await enqueueJob(admin, {
      rid,
      job_type: JOB_PROFILE,
      payload: { user_id: userId },
      dedupe_key: repairKey,
    });

    if (res.queued) queued += 1;
  }

  const outboxOk = await outboxTableExists(admin, rid);
  if (outboxOk) {
    await openOrRepairIncident(admin, {
      rid,
      type: "OUTBOX_RETRY",
      severity: "info",
      status: "open",
      message: "Outbox-retry planlagt.",
    });

    const res = await enqueueJob(admin, {
      rid,
      job_type: JOB_OUTBOX,
      payload: { reason: "retry_failed_or_pending" },
      dedupe_key: "outbox_retry",
    });

    if (res.queued) queued += 1;
  }

  if (includeOrderIntegrity) {
    await writeOpsEvent(admin, {
      level: "info",
      event: "order.integrity.start",
      data: { window_days: 30 },
      rid,
    });
    const fromDate = daysAgoISO(29);
    const orderRes = await enqueueOrderIntegrityRepairs(admin, rid, fromDate);
    queued += orderRes.queued;
  }

  return { queued };
}

async function claimNextJobs(admin: any, rid: string, limit: number): Promise<RepairJobRow[]> {
  const take = clampInt(limit, 1, 25, 10);

  try {
    const { data, error } = await admin.rpc("claim_repair_jobs", { p_limit: take });
    if (error) throw error;

    return Array.isArray(data) ? (data as RepairJobRow[]) : [];
  } catch (e: any) {
    if (isMissingFunction(e) || isMissingRelation(e)) {
      opsLog("repair_jobs.claim_missing", { rid, message: String(e?.message ?? e) });
      return [];
    }
    opsLog("repair_jobs.claim_failed", { rid, message: String(e?.message ?? e) });
    return [];
  }
}

async function markJobDone(admin: any, job: RepairJobRow) {
  try {
    const { error } = await admin
      .from("repair_jobs")
      .update({
        state: "done",
        last_error: null,
        updated_at: nowIso(),
      })
      .eq("id", job.id);

    if (error) throw error;
  } catch (e: any) {
    opsLog("repair_jobs.mark_done_failed", { jobId: job.id, message: String(e?.message ?? e) });
  }
}

async function markJobFailed(admin: any, job: RepairJobRow, err: any) {
  const attempts = Number(job.attempts ?? 0) + 1;
  const backoffSeconds = Math.min(3600, Math.pow(2, attempts) * 30);
  const nextRun = new Date(Date.now() + backoffSeconds * 1000).toISOString();
  const message = safeStr(err?.message ?? err) || "repair_failed";

  try {
    const { error } = await admin
      .from("repair_jobs")
      .update({
        state: "failed",
        attempts,
        next_run_at: nextRun,
        last_error: message,
        updated_at: nowIso(),
      })
      .eq("id", job.id);

    if (error) throw error;
  } catch (e: any) {
    opsLog("repair_jobs.mark_failed_failed", { jobId: job.id, message: String(e?.message ?? e) });
  }
}

async function runProfileRepair(admin: any, job: RepairJobRow, rid: string) {
  const userId = safeStr(job?.payload?.user_id);
  if (!userId) throw new Error("missing_user_id");

  const repairKey = `profile:${userId}`;

  await openOrRepairIncident(admin, {
    rid,
    type: "PROFILE_MISSING",
    severity: "warn",
    status: "repairing",
    message: "Oppretter manglende profil.",
    scope_user_id: userId,
    repair_key: repairKey,
    data: { job_id: job.id },
  });

  const { error } = await admin
    .from("profiles")
    .insert(
      {
        user_id: userId,
        role: "employee",
        is_active: false,
        company_id: null,
      },
      { onConflict: "user_id", ignoreDuplicates: true }
    );

  if (error) throw error;

  await resolveIncident(admin, {
    rid,
    type: "PROFILE_MISSING",
    message: "Manglende profil opprettet.",
    scope_user_id: userId,
    repair_key: repairKey,
  });
}

async function runOutboxRepair(admin: any, job: RepairJobRow, rid: string) {
  await openOrRepairIncident(admin, {
    rid,
    type: "OUTBOX_RETRY",
    severity: "warn",
    status: "repairing",
    message: "Kjører outbox-retry.",
    data: { job_id: job.id },
  });

  try {
    const res = await processOutboxBatch(25);

    await writeOpsEvent(admin, {
      level: res.failed > 0 ? "warn" : "info",
      event: "repair.outbox.batch",
      data: { processed: res.processed, sent: res.sent, failed: res.failed },
      rid,
    });

    if (res.failed > 0) {
      await openOrRepairIncident(admin, {
        rid,
        type: "OUTBOX_RETRY",
        severity: "warn",
        status: "open",
        message: `Outbox-retry fullført med feil (${res.failed}).`,
        data: { failed: res.failed },
      });
    } else {
      await resolveIncident(admin, {
        rid,
        type: "OUTBOX_RETRY",
        message: "Outbox-retry fullført uten feil.",
      });
    }

    return res;
  } catch (e: any) {
    if (isMissingRelation(e) || isMissingColumn(e)) {
      await openOrRepairIncident(admin, {
        rid,
        type: "OUTBOX_MISSING",
        severity: "warn",
        status: "open",
        message: "Outbox-tabell mangler. Reparasjon stoppet.",
      });
    }
    throw e;
  }
}

function sortByCreatedAtThenId(a: any, b: any) {
  const aDate = a?.created_at ? new Date(a.created_at).getTime() : Number.MAX_SAFE_INTEGER;
  const bDate = b?.created_at ? new Date(b.created_at).getTime() : Number.MAX_SAFE_INTEGER;
  if (aDate !== bDate) return aDate - bDate;
  return String(a?.id ?? "").localeCompare(String(b?.id ?? ""), "nb");
}

async function runOrderDedupe(admin: any, job: RepairJobRow, rid: string) {
  const userId = safeStr(job?.payload?.user_id);
  const date = safeStr(job?.payload?.date);
  if (!userId || !date) throw new Error("missing_dedupe_params");

  const { data, error } = await admin
    .from("orders")
    .select("id,created_at,status,integrity_status")
    .eq("user_id", userId)
    .eq("date", date)
    .eq("integrity_status", "ok")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as any[];
  if (rows.length <= 1) return;

  rows.sort(sortByCreatedAtThenId);
  const winner = rows[0];
  const losers = rows.slice(1).map((r) => r.id).filter(Boolean);

  if (losers.length) {
    const { error: updErr } = await admin
      .from("orders")
      .update({ status: "CANCELED", integrity_status: "ok", integrity_reason: null, integrity_rid: null, updated_at: nowIso() })
      .in("id", losers);

    if (updErr) throw updErr;
  }

  await writeOpsEvent(admin, {
    level: "info",
    event: "order.integrity.dedupe",
    data: { user_id: userId, date, winner: winner?.id ?? null, canceled: losers.length, order_ids: losers.slice(0, 10) },
    rid,
  });

  await resolveIncident(admin, {
    rid,
    type: "ORDER_DUPLICATE",
    message: "Duplikate ordre ble kansellert deterministisk.",
    repair_key: `dedupe:${userId}:${date}`,
  });
}

async function runOrderNormalizeStatus(admin: any, job: RepairJobRow, rid: string) {
  const target = safeStr(job?.payload?.target_status).toUpperCase();
  const orderIds = Array.isArray(job?.payload?.order_ids) ? job.payload.order_ids.map((x: any) => safeStr(x)).filter(Boolean) : [];
  if (!target || !ORDER_CANONICAL.has(target) || orderIds.length === 0) throw new Error("missing_normalize_params");

  const { error } = await admin
    .from("orders")
    .update({ status: target, integrity_status: "ok", integrity_reason: null, integrity_rid: null, updated_at: nowIso() })
    .in("id", orderIds);

  if (error) throw error;

  await writeOpsEvent(admin, {
    level: "info",
    event: "order.integrity.normalize",
    data: { target_status: target, updated: orderIds.length, order_ids: orderIds.slice(0, 10) },
    rid,
  });

  await resolveIncident(admin, {
    rid,
    type: "ORDER_INVALID_STATUS",
    message: "Ordrestatus normalisert deterministisk.",
    repair_key: "invalid_status.normalize",
  });
}

async function runOrderQuarantine(admin: any, job: RepairJobRow, rid: string) {
  const reason = safeStr(job?.payload?.reason).toUpperCase();
  const orderIds = Array.isArray(job?.payload?.order_ids) ? job.payload.order_ids.map((x: any) => safeStr(x)).filter(Boolean) : [];
  if (!reason || orderIds.length === 0) throw new Error("missing_quarantine_params");

  const { error } = await admin
    .from("orders")
    .update({ integrity_status: "quarantined", integrity_reason: reason, integrity_rid: rid, updated_at: nowIso() })
    .in("id", orderIds);

  if (error) throw error;

  await writeOpsEvent(admin, {
    level: "warn",
    event: "order.integrity.quarantine",
    data: { reason, quarantined: orderIds.length, order_ids: orderIds.slice(0, 10) },
    rid,
  });
}

async function runJob(admin: any, job: RepairJobRow, rid: string) {
  if (job.job_type === JOB_PROFILE) return runProfileRepair(admin, job, rid);
  if (job.job_type === JOB_OUTBOX) return runOutboxRepair(admin, job, rid);
  if (job.job_type === JOB_ORDER_DEDUPE) return runOrderDedupe(admin, job, rid);
  if (job.job_type === JOB_ORDER_NORMALIZE) return runOrderNormalizeStatus(admin, job, rid);
  if (job.job_type === JOB_ORDER_QUARANTINE) return runOrderQuarantine(admin, job, rid);
  throw new Error(`unknown_job_type:${job.job_type}`);
}

export async function runSystemMotor(input: {
  rid: string;
  source: "manual" | "cron" | string;
  jobLimit?: number;
  enqueueLimit?: number;
  includeOrderIntegrity?: boolean;
}): Promise<MotorResult> {
  const admin = supabaseAdmin();
  const jobLimit = clampInt(input.jobLimit ?? 10, 1, 25, 10);
  const enqueueLimit = clampInt(input.enqueueLimit ?? 50, 1, 200, 50);
  const includeOrderIntegrity = Boolean(input.includeOrderIntegrity);

  await writeOpsEvent(admin, {
    level: "info",
    event: "system.motor.start",
    data: { source: input.source, job_limit: jobLimit, enqueue_limit: enqueueLimit, include_order_integrity: includeOrderIntegrity },
    rid: input.rid,
  });

  const enqueueRes = await enqueueRepairs(admin, input.rid, enqueueLimit, includeOrderIntegrity);
  const jobs = await claimNextJobs(admin, input.rid, jobLimit);

  let done = 0;
  let failed = 0;

  for (const job of jobs) {
    await writeOpsEvent(admin, {
      level: "info",
      event: "repair.job.start",
      data: { job_id: job.id, job_type: job.job_type },
      rid: input.rid,
      scope_user_id: safeStr(job.payload?.user_id) || null,
    });

    try {
      await runJob(admin, job, input.rid);
      await markJobDone(admin, job);
      done += 1;

      await writeOpsEvent(admin, {
        level: "info",
        event: "repair.job.done",
        data: { job_id: job.id, job_type: job.job_type },
        rid: input.rid,
        scope_user_id: safeStr(job.payload?.user_id) || null,
      });
    } catch (e: any) {
      failed += 1;
      await markJobFailed(admin, job, e);

      await writeOpsEvent(admin, {
        level: "error",
        event: "repair.job.failed",
        data: { job_id: job.id, job_type: job.job_type, message: String(e?.message ?? e) },
        rid: input.rid,
        scope_user_id: safeStr(job.payload?.user_id) || null,
      });
    }
  }

  await writeOpsEvent(admin, {
    level: failed > 0 ? "warn" : "info",
    event: "system.motor.run",
    data: {
      queued: enqueueRes.queued,
      claimed: jobs.length,
      done,
      failed,
      source: input.source,
    },
    rid: input.rid,
  });

  return {
    ran: true,
    queued: enqueueRes.queued,
    claimed: jobs.length,
    done,
    failed,
    source: input.source,
  };
}

export async function POST(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.system.repairs.run.POST", ["superadmin"]);
  if (deny) return deny;

  try {
    const body = (await readJson(req)) ?? {};
    const includeOrderIntegrity = body?.includeOrderIntegrity === true;

    const result = await runSystemMotor({
      rid: ctx.rid,
      source: "manual",
      jobLimit: 10,
      enqueueLimit: 50,
      includeOrderIntegrity,
    });

    return jsonOk(
      ctx.rid,
      {
        ran: result.ran,
        queued: result.queued,
        claimed: result.claimed,
        done: result.done,
        failed: result.failed,
      },
      200
    );
  } catch (e: any) {
    opsLog("superadmin.system.repairs.run_failed", { rid: ctx.rid, message: String(e?.message ?? e) });
    return jsonErr(ctx.rid, "Kunne ikke kjøre trygg reparasjon.", 500, {
      code: "REPAIR_RUN_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}


