// lib/observability/sli.ts
// SLI calculators from real runtime/persisted signals. No fake metrics.
import "server-only";

import type { SliResult, SliStatus } from "./types";
import type { SloId } from "./types";
import { SLO_REGISTRY } from "./sloRegistry";

type AdminClient = {
  from: (table: string) => {
    select: (cols: string, opts?: { count: "exact" }) => any;
    gte: (col: string, val: string) => any;
    in: (col: string, vals: string[]) => any;
    eq: (col: string, val: string) => any;
  };
};

function toIsoMinutesAgo(minutes: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutes);
  return d.toISOString();
}

function rateToStatus(
  ratePercent: number | null,
  criticalThreshold: number,
  warnThreshold: number
): SliStatus {
  if (ratePercent === null) return "unknown";
  if (ratePercent < criticalThreshold) return "breach";
  if (ratePercent < warnThreshold) return "warn";
  return "ok";
}

/** System health SLI from system_health_snapshots (last N minutes). */
export async function computeSliSystemHealth(
  admin: AdminClient,
  windowMinutes: number
): Promise<SliResult> {
  const def = SLO_REGISTRY.system_health;
  const since = toIsoMinutesAgo(windowMinutes);
  const nowIso = new Date().toISOString();

  try {
    const res = await admin
      .from("system_health_snapshots")
      .select("ts,status")
      .gte("ts", since);

    if (res.error) {
      return {
        sloId: "system_health",
        sliKey: def.sliKey,
        serviceId: def.serviceId,
        good: 0,
        total: 0,
        ratePercent: null,
        status: "unknown",
        message: "Kunne ikke hente snapshots.",
        evidence: { error: res.error?.message ?? "unknown" },
      };
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const total = rows.length;
    const good = rows.filter((r: any) => String(r?.status ?? "") === "normal").length;
    const ratePercent = total > 0 ? (good / total) * 100 : null;
    const status = rateToStatus(ratePercent, def.criticalThresholdPercent, def.warnThresholdPercent);

    return {
      sloId: "system_health",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good,
      total,
      ratePercent,
      status,
      windowMinutes,
      windowStart: since,
      windowEnd: nowIso,
      message:
        total === 0
          ? "Ingen snapshots i vinduet."
          : `${good}/${total} normal (${ratePercent != null ? ratePercent.toFixed(1) : "—"} %)`,
      evidence: total > 0 ? { last_ts: (rows[0] as any)?.ts } : undefined,
    };
  } catch (e: any) {
    return {
      sloId: "system_health",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good: 0,
      total: 0,
      ratePercent: null,
      status: "unknown",
      message: "SLI-beregning feilet.",
      evidence: { error: e?.message ?? String(e) },
    };
  }
}

const CRITICAL_CRON_JOBS = ["forecast", "preprod", "week-visibility"];

/** Cron critical jobs SLI from cron_runs. */
export async function computeSliCronCritical(
  admin: AdminClient,
  windowMinutes: number
): Promise<SliResult> {
  const def = SLO_REGISTRY.cron_critical;
  const since = toIsoMinutesAgo(windowMinutes);
  const nowIso = new Date().toISOString();

  try {
    const res = await admin
      .from("cron_runs")
      .select("job,status,ran_at")
      .gte("ran_at", since)
      .in("job", CRITICAL_CRON_JOBS);

    if (res.error) {
      return {
        sloId: "cron_critical",
        sliKey: def.sliKey,
        serviceId: def.serviceId,
        good: 0,
        total: 0,
        ratePercent: null,
        status: "unknown",
        message: "Kunne ikke hente cron_runs.",
        evidence: { error: res.error?.message ?? "unknown" },
      };
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const total = rows.length;
    const good = rows.filter((r: any) => String(r?.status ?? "") === "ok").length;
    const ratePercent = total > 0 ? (good / total) * 100 : null;
    const status = rateToStatus(ratePercent, def.criticalThresholdPercent, def.warnThresholdPercent);

    return {
      sloId: "cron_critical",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good,
      total,
      ratePercent,
      status,
      windowMinutes,
      windowStart: since,
      windowEnd: nowIso,
      message:
        total === 0
          ? "Ingen cron-kjøringer i vinduet."
          : `${good}/${total} ok (${ratePercent != null ? ratePercent.toFixed(1) : "—"} %)`,
      evidence: total > 0 ? { jobs: CRITICAL_CRON_JOBS } : undefined,
    };
  } catch (e: any) {
    return {
      sloId: "cron_critical",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good: 0,
      total: 0,
      ratePercent: null,
      status: "unknown",
      message: "SLI-beregning feilet.",
      evidence: { error: e?.message ?? String(e) },
    };
  }
}

/** Outbox SLI: from cron_runs where job=outbox when persisted; else unknown with note. */
export async function computeSliCronOutbox(
  admin: AdminClient,
  windowMinutes: number
): Promise<SliResult> {
  const def = SLO_REGISTRY.cron_outbox;
  const since = toIsoMinutesAgo(windowMinutes);
  const nowIso = new Date().toISOString();

  try {
    const res = await admin
      .from("cron_runs")
      .select("job,status,ran_at")
      .gte("ran_at", since)
      .in("job", ["outbox"]);

    if (res.error) {
      return {
        sloId: "cron_outbox",
        sliKey: def.sliKey,
        serviceId: def.serviceId,
        good: 0,
        total: 0,
        ratePercent: null,
        status: "unknown",
        message: "Kunne ikke lese cron_runs for outbox (database/RLS).",
        evidence: {
          note: "Outbox POST /api/cron/outbox persisterer til cron_runs ved suksess/feil når tabellen er tilgjengelig.",
          error: res.error.message,
        },
      };
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const total = rows.length;
    if (total === 0) {
      return {
        sloId: "cron_outbox",
        sliKey: def.sliKey,
        serviceId: def.serviceId,
        good: 0,
        total: 0,
        ratePercent: null,
        status: "unknown",
        message: "Ingen outbox-kjøringer i vinduet (ingen rader i cron_runs for job=outbox).",
        evidence: { note: "Verifiser at Vercel cron treffer /api/cron/outbox og at CRON_SECRET er satt." },
      };
    }

    const good = rows.filter((r: any) => String(r?.status ?? "") === "ok").length;
    const ratePercent = (good / total) * 100;
    const status = rateToStatus(ratePercent, def.criticalThresholdPercent, def.warnThresholdPercent);

    return {
      sloId: "cron_outbox",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good,
      total,
      ratePercent,
      status,
      windowMinutes,
      windowStart: since,
      windowEnd: nowIso,
      message: `${good}/${total} ok (${ratePercent.toFixed(1)} %)`,
      evidence: { last_ts: (rows[0] as any)?.ran_at },
    };
  } catch (e: any) {
    return {
      sloId: "cron_outbox",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good: 0,
      total: 0,
      ratePercent: null,
      status: "unknown",
      message: "SLI-beregning feilet.",
      evidence: { error: e?.message ?? String(e) },
    };
  }
}

/** Order write SLI: inferred from open ORDER system_incidents. 100% if none, else breach. */
export async function computeSliOrderWrite(admin: AdminClient): Promise<SliResult> {
  const def = SLO_REGISTRY.order_write;

  try {
    const res = await admin
      .from("system_incidents")
      .select("id,type,status")
      .eq("type", "ORDER")
      .eq("status", "open");

    if (res.error) {
      return {
        sloId: "order_write",
        sliKey: def.sliKey,
        serviceId: def.serviceId,
        good: 0,
        total: 1,
        ratePercent: null,
        status: "unknown",
        message: "Kunne ikke hente ORDER-incidents.",
        evidence: { error: res.error?.message ?? "unknown" },
      };
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const openCount = rows.length;
    const good = openCount === 0 ? 1 : 0;
    const total = 1;
    const ratePercent = good * 100;
    const status: SliStatus = openCount === 0 ? "ok" : openCount >= 1 ? "breach" : "ok";

    return {
      sloId: "order_write",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good,
      total,
      ratePercent,
      status,
      windowMinutes: def.windowMinutes,
      message: openCount === 0 ? "Ingen åpne ORDER-incidents." : `${openCount} åpne ORDER-incident(s).`,
      evidence: { open_order_incidents: openCount },
    };
  } catch (e: any) {
    return {
      sloId: "order_write",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good: 0,
      total: 1,
      ratePercent: null,
      status: "unknown",
      message: "SLI-beregning feilet.",
      evidence: { error: e?.message ?? String(e) },
    };
  }
}

/** Auth SLI: inferred from open AUTH system_incidents. */
export async function computeSliAuth(admin: AdminClient): Promise<SliResult> {
  const def = SLO_REGISTRY.auth_protected_route;

  try {
    const res = await admin
      .from("system_incidents")
      .select("id,type,status")
      .eq("type", "AUTH")
      .eq("status", "open");

    if (res.error) {
      return {
        sloId: "auth_protected_route",
        sliKey: def.sliKey,
        serviceId: def.serviceId,
        good: 0,
        total: 1,
        ratePercent: null,
        status: "unknown",
        message: "Kunne ikke hente AUTH-incidents.",
        evidence: { error: res.error?.message ?? "unknown" },
      };
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const openCount = rows.length;
    const good = openCount === 0 ? 1 : 0;
    const ratePercent = good * 100;
    const status: SliStatus = openCount === 0 ? "ok" : "breach";

    return {
      sloId: "auth_protected_route",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good,
      total: 1,
      ratePercent,
      status,
      windowMinutes: def.windowMinutes,
      message: openCount === 0 ? "Ingen åpne AUTH-incidents." : `${openCount} åpne AUTH-incident(s).`,
      evidence: { open_auth_incidents: openCount },
    };
  } catch (e: any) {
    return {
      sloId: "auth_protected_route",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good: 0,
      total: 1,
      ratePercent: null,
      status: "unknown",
      message: "SLI-beregning feilet.",
      evidence: { error: e?.message ?? String(e) },
    };
  }
}

/** Content/CMS SLI: from open SANITY/INTEGRATION incidents (content-related). */
export async function computeSliContentPublish(admin: AdminClient): Promise<SliResult> {
  const def = SLO_REGISTRY.content_publish;

  try {
    const res = await admin
      .from("system_incidents")
      .select("id,type,status")
      .in("type", ["SANITY", "INTEGRATION"])
      .eq("status", "open");

    if (res.error) {
      return {
        sloId: "content_publish",
        sliKey: def.sliKey,
        serviceId: def.serviceId,
        good: 0,
        total: 1,
        ratePercent: null,
        status: "unknown",
        message: "Kunne ikke hente content-relaterte incidents.",
        evidence: { error: res.error?.message ?? "unknown" },
      };
    }

    const rows = Array.isArray(res.data) ? res.data : [];
    const openCount = rows.length;
    const good = openCount === 0 ? 1 : 0;
    const ratePercent = good * 100;
    const status: SliStatus = openCount === 0 ? "ok" : openCount >= 2 ? "breach" : "warn";

    return {
      sloId: "content_publish",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good,
      total: 1,
      ratePercent,
      status,
      windowMinutes: def.windowMinutes,
      message:
        openCount === 0
          ? "Ingen åpne SANITY/INTEGRATION-incidents."
          : `${openCount} åpne incident(s) (SANITY/INTEGRATION).`,
      evidence: { open_content_incidents: openCount },
    };
  } catch (e: any) {
    return {
      sloId: "content_publish",
      sliKey: def.sliKey,
      serviceId: def.serviceId,
      good: 0,
      total: 1,
      ratePercent: null,
      status: "unknown",
      message: "SLI-beregning feilet.",
      evidence: { error: e?.message ?? String(e) },
    };
  }
}

/** Run all SLI calculators and return results keyed by SloId. */
export async function computeAllSlis(
  admin: AdminClient,
  windowMinutes: number = 60
): Promise<SliResult[]> {
  const [systemHealth, cronCritical, cronOutbox, orderWrite, auth, content] = await Promise.all([
    computeSliSystemHealth(admin, windowMinutes),
    computeSliCronCritical(admin, Math.min(windowMinutes, 1440)),
    computeSliCronOutbox(admin, 1440),
    computeSliOrderWrite(admin),
    computeSliAuth(admin),
    computeSliContentPublish(admin),
  ]);

  return [systemHealth, cronCritical, cronOutbox, orderWrite, auth, content];
}
