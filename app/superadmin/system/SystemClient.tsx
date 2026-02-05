// app/superadmin/system/SystemClient.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";
import { deriveReasons, deriveSystemStatus } from "@/lib/system/healthStatus";
import { Button } from "@/components/ui/button";
import StatusPill from "@/components/admin/StatusPill";

type CheckStatus = "OK" | "WARN" | "FAIL";
type SystemStatus = "normal" | "degraded";

type HealthCheck = { key: string; status: CheckStatus; message: string };
type RuntimeDetails = { ok: boolean; missing?: string[]; node_env?: string; runtime?: string };
type HealthDetails = { runtime?: RuntimeDetails };

type HealthData = {
  status: SystemStatus;
  reasons: string[];
  checks: { items: HealthCheck[] };
  details?: HealthDetails;
  ts: string;
};

type HealthOk = { ok: true; rid: string; data: HealthData };
type HealthErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type HealthResp = HealthOk | HealthErr;

type Incident = {
  id: string;
  severity: "info" | "warn" | "crit" | string;
  type: string;
  status: "open" | "repairing" | "resolved" | "suppressed" | string;
  count: number;
  first_seen: string | null;
  last_seen: string | null;
  details?: any;
  rid?: string | null;
};

type IncidentsData = { items: Incident[]; total: number };
type IncidentsOk = { ok: true; rid: string; data: IncidentsData };
type IncidentsErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type IncidentsResp = IncidentsOk | IncidentsErr;

type RepairJob = {
  id: string;
  job_type: string;
  payload: any;
  state: "pending" | "running" | "done" | "failed" | string;
  attempts: number;
  next_run_at: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
  rid?: string | null;
};

type RepairJobsData = { items: RepairJob[]; total: number };
type RepairJobsOk = { ok: true; rid: string; data: RepairJobsData };
type RepairJobsErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type RepairJobsResp = RepairJobsOk | RepairJobsErr;

type RepairSummary = {
  counts: { pending: number; running: number; failed: number; done: number };
  last_run:
    | {
        ts: string | null;
        rid: string | null;
        queued: number;
        done: number;
        failed: number;
        source: string | null;
      }
    | null;
};

type RepairSummaryOk = { ok: true; rid: string; data: RepairSummary };
type RepairSummaryErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type RepairSummaryResp = RepairSummaryOk | RepairSummaryErr;

type RepairRunData = { ran?: boolean; queued?: number; claimed?: number; done?: number; failed?: number };
type RepairRunOk = { ok: true; rid: string; data: RepairRunData };
type RepairRunErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type RepairRunResp = RepairRunOk | RepairRunErr;

type OpsEvent = {
  ts: string;
  level: "info" | "warn" | "error" | string;
  event: string;
  scope_company_id?: string | null;
  scope_user_id?: string | null;
  rid?: string | null;
  data?: any;
};

type OpsEventsData = { items: OpsEvent[]; total: number };
type OpsEventsOk = { ok: true; rid: string; data: OpsEventsData };
type OpsEventsErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type OpsEventsResp = OpsEventsOk | OpsEventsErr;

type FlowCheck = {
  key: string;
  status: CheckStatus;
  message: string;
  evidence: Record<string, any>;
  suggested_action: string;
};

type FlowDiagnostics = { status: SystemStatus; checks: FlowCheck[] };
type FlowDiagOk = { ok: true; rid: string; data: FlowDiagnostics };
type FlowDiagErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type FlowDiagResp = FlowDiagOk | FlowDiagErr;

type IntegritySummary = {
  window_days: number;
  counts: { ok: number; quarantined: number };
  incidents: { items: Incident[]; total: number };
  last_run:
    | {
        ts: string | null;
        rid: string | null;
        queued: number;
        dedupe_groups: number;
        normalize_ids: number;
        quarantine_ids: number;
      }
    | null;
};

type IntegritySummaryOk = { ok: true; rid: string; data: IntegritySummary };
type IntegritySummaryErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type IntegritySummaryResp = IntegritySummaryOk | IntegritySummaryErr;
type CodexPromptData = {
  ts: string;
  prompt: string;
  itemsCount: number;
  openIncidentsCount: number;
  failedJobsCount: number;
  flowFailsCount: number;
};

function statusTone(s: CheckStatus) {
  if (s === "OK") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (s === "WARN") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-rose-50 text-rose-900 ring-rose-200";
}

function severityTone(s: Incident["severity"]) {
  if (s === "crit") return "bg-rose-50 text-rose-900 ring-rose-200";
  if (s === "warn") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-emerald-50 text-emerald-900 ring-emerald-200";
}

function jobTone(s: RepairJob["state"]) {
  if (s === "failed") return "bg-rose-50 text-rose-900 ring-rose-200";
  if (s === "running") return "bg-amber-50 text-amber-900 ring-amber-200";
  if (s === "done") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  return "bg-neutral-100 text-neutral-800 ring-neutral-200";
}

function opsTone(level: OpsEvent["level"]) {
  if (level === "error") return "bg-rose-50 text-rose-900 ring-rose-200";
  if (level === "warn") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-emerald-50 text-emerald-900 ring-emerald-200";
}

function jobLabel(jobType: string) {
  if (jobType === "repair.profile.missing") return "Manglende profil";
  if (jobType === "repair.outbox.retry") return "Outbox-retry";
  if (jobType === "order.dedupe") return "Ordre-dedupe";
  if (jobType === "order.normalize_status") return "Ordre-normalisering";
  if (jobType === "order.quarantine") return "Ordre-karantene";
  return jobType || "Ukjent";
}

function formatISO(iso?: string | null) {
  try {
    if (!iso) return "—";
    return formatDateTimeNO(iso);
  } catch {
    return "—";
  }
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

type PromptBuildInput = { rid: string | null; data: HealthData | null };
type PromptBuildOutput = { prompt: string; itemsCount: number; missingEvidence: string[] };

function buildCodexPrompt(input: PromptBuildInput): PromptBuildOutput {
  const rid = input.rid ?? "rid_missing";
  const checks = Array.isArray(input.data?.checks?.items) ? input.data!.checks.items : [];
  const failing = checks.filter((c) => c.status !== "OK");

  if (!failing.length) {
    return { prompt: "NO-ACTION: all checks OK.", itemsCount: 0, missingEvidence: [] };
  }

  const runtimeDetails = input.data?.details?.runtime;
  const runtimeMissing = Array.isArray(runtimeDetails?.missing) ? runtimeDetails!.missing : [];
  const runtimeNodeEnv = safeStr(runtimeDetails?.node_env);
  const runtimeRuntime = safeStr(runtimeDetails?.runtime);

  const evidenceLines: string[] = [];
  const missingEvidence: string[] = [];
  const runtimeIsFailing = failing.some((c) => c.key === "runtime");

  for (const check of failing) {
    evidenceLines.push(`- ${check.key}: ${check.status} - ${check.message}`);
    if (check.key === "runtime") {
      if (!runtimeMissing.length) missingEvidence.push("runtime.missing (env key names)");
      if (!runtimeNodeEnv) missingEvidence.push("runtime.node_env");
      if (!runtimeRuntime) missingEvidence.push("runtime.runtime");
      evidenceLines.push(
        `- runtime.evidence: missing keys: ${runtimeMissing.join(", ") || "-"}; node_env: ${runtimeNodeEnv || "-"}; runtime: ${runtimeRuntime || "-"}`
      );
    }
  }

  if (missingEvidence.length) {
    const lines = [
      "NO-GO: missing evidence",
      "",
      `RID: ${rid}`,
      "",
      "MISSING EVIDENCE",
      ...missingEvidence.map((m) => `- ${m}`),
    ];
    return { prompt: lines.join("\n"), itemsCount: failing.length, missingEvidence };
  }

  const lines = [
    "FIX EVIDENCE PACK",
    "",
    `RID: ${rid}`,
    "",
    "EVIDENCE",
    ...evidenceLines,
    "",
    "FIX",
  ];

  if (runtimeIsFailing) {
    lines.push("- Local dev: add missing keys to .env.local (do NOT commit secrets), restart dev server.");
    lines.push("- Vercel: add missing keys in project environment variables.");
  } else {
    lines.push("- Investigate each failing check using the message above and attach concrete evidence.");
  }

  lines.push("");
  lines.push("ACCEPTANCE CRITERIA");
  lines.push("- Runtime check becomes OK.");
  lines.push("- System status becomes NORMAL.");
  lines.push("- Provide proof (health response or screenshot).");

  return { prompt: lines.join("\n"), itemsCount: failing.length, missingEvidence: [] };
}

type UiAction = { kind: "ok" | "err"; message: string; rid?: string | null };

export default function SystemClient() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [incidents, setIncidents] = useState<IncidentsData | null>(null);
  const [repairJobs, setRepairJobs] = useState<RepairJobsData | null>(null);
  const [repairSummary, setRepairSummary] = useState<RepairSummary | null>(null);
  const [opsEvents, setOpsEvents] = useState<OpsEventsData | null>(null);
  const [flowDiagnostics, setFlowDiagnostics] = useState<FlowDiagnostics | null>(null);
  const [integritySummary, setIntegritySummary] = useState<IntegritySummary | null>(null);
  const [codexPrompt, setCodexPrompt] = useState<CodexPromptData | null>(null);
  const [codexRid, setCodexRid] = useState<string | null>(null);
  const [codexErr, setCodexErr] = useState<string | null>(null);

  const codexTimerRef = useRef<number | null>(null);

  const [flowRid, setFlowRid] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [repairing, setRepairing] = useState(false);
  const [checkingFlow, setCheckingFlow] = useState(false);
  const [runningIntegrity, setRunningIntegrity] = useState(false);

  const [includeOrderIntegrity, setIncludeOrderIntegrity] = useState(false);

  const [repairAction, setRepairAction] = useState<UiAction | null>(null);
  const [flowAction, setFlowAction] = useState<UiAction | null>(null);
  const [integrityAction, setIntegrityAction] = useState<UiAction | null>(null);

  const incidentItems = useMemo(() => (Array.isArray(incidents?.items) ? incidents!.items : []), [incidents]);
  const jobItems = useMemo(() => (Array.isArray(repairJobs?.items) ? repairJobs!.items : []), [repairJobs]);
  const flowChecks = useMemo(() => (Array.isArray(flowDiagnostics?.checks) ? flowDiagnostics!.checks : []), [flowDiagnostics]);

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const [healthRes, incidentsRes, jobsRes, summaryRes, opsRes, integrityRes] = await Promise.all([
        fetch("/api/superadmin/system/health", { cache: "no-store" }),
        fetch("/api/superadmin/system/incidents?page=1&pageSize=25", { cache: "no-store" }),
        fetch("/api/superadmin/system/repairs/jobs?page=1&limit=25", { cache: "no-store" }),
        fetch("/api/superadmin/system/repairs/summary", { cache: "no-store" }),
        fetch("/api/superadmin/system/repairs/ops?page=1&limit=25", { cache: "no-store" }),
        fetch("/api/superadmin/system/orders/integrity/summary", { cache: "no-store" }),
      ]);

      const healthJson = (await healthRes.json().catch(() => null)) as HealthResp | null;
      const incidentsJson = (await incidentsRes.json().catch(() => null)) as IncidentsResp | null;
      const jobsJson = (await jobsRes.json().catch(() => null)) as RepairJobsResp | null;
      const summaryJson = (await summaryRes.json().catch(() => null)) as RepairSummaryResp | null;
      const opsJson = (await opsRes.json().catch(() => null)) as OpsEventsResp | null;
      const integrityJson = (await integrityRes.json().catch(() => null)) as IntegritySummaryResp | null;

      const errors: string[] = [];
      let nextRid: string | null = null;

      // HEALTH
      if (!healthRes.ok || !healthJson || (healthJson as any).ok !== true) {
        const e = healthJson as HealthErr | null;
        errors.push(e?.message || e?.error || `HTTP ${healthRes.status}`);
        setHealth(null);
        nextRid = e?.rid || nextRid;
      } else {
        const ok = healthJson as HealthOk;
        const data = ok.data ?? null;
        const normalized: HealthData | null = data
          ? {
              status: data.status ?? "degraded",
              reasons: Array.isArray(data.reasons) ? data.reasons : [],
              checks: { items: Array.isArray(data.checks?.items) ? data.checks.items : [] },
              details: {
                runtime: data.details?.runtime
                  ? {
                      ok: Boolean(data.details.runtime.ok),
                      missing: Array.isArray(data.details.runtime.missing) ? data.details.runtime.missing : [],
                      node_env: data.details.runtime.node_env ?? undefined,
                      runtime: data.details.runtime.runtime ?? undefined,
                    }
                  : undefined,
              },
              ts: data.ts ?? "",
            }
          : null;
        setHealth(normalized);
        nextRid = ok.rid;
      }

      // INCIDENTS
      if (!incidentsRes.ok || !incidentsJson || (incidentsJson as any).ok !== true) {
        const e = incidentsJson as IncidentsErr | null;
        errors.push(e?.message || e?.error || `HTTP ${incidentsRes.status}`);
        setIncidents(null);
        if (!nextRid) nextRid = e?.rid || null;
      } else {
        const ok = incidentsJson as IncidentsOk;
        const data = ok.data ?? null;
        const normalized: IncidentsData | null = data
          ? { items: Array.isArray(data.items) ? data.items : [], total: Number(data.total ?? 0) }
          : null;
        setIncidents(normalized);
        if (!nextRid) nextRid = ok.rid;
      }

      // REPAIR JOBS
      if (!jobsRes.ok || !jobsJson || (jobsJson as any).ok !== true) {
        const e = jobsJson as RepairJobsErr | null;
        errors.push(e?.message || e?.error || `HTTP ${jobsRes.status}`);
        setRepairJobs(null);
        if (!nextRid) nextRid = e?.rid || null;
      } else {
        const ok = jobsJson as RepairJobsOk;
        const data = ok.data ?? null;
        const normalized: RepairJobsData | null = data
          ? { items: Array.isArray(data.items) ? data.items : [], total: Number(data.total ?? 0) }
          : null;
        setRepairJobs(normalized);
        if (!nextRid) nextRid = ok.rid;
      }

      // REPAIR SUMMARY
      if (!summaryRes.ok || !summaryJson || (summaryJson as any).ok !== true) {
        const e = summaryJson as RepairSummaryErr | null;
        errors.push(e?.message || e?.error || `HTTP ${summaryRes.status}`);
        setRepairSummary(null);
        if (!nextRid) nextRid = e?.rid || null;
      } else {
        const ok = summaryJson as RepairSummaryOk;
        const data = ok.data ?? null;
        const normalized: RepairSummary | null = data
          ? {
              counts: {
                pending: Number(data.counts?.pending ?? 0),
                running: Number(data.counts?.running ?? 0),
                failed: Number(data.counts?.failed ?? 0),
                done: Number(data.counts?.done ?? 0),
              },
              last_run: data.last_run
                ? {
                    ts: data.last_run.ts ?? null,
                    rid: data.last_run.rid ?? null,
                    queued: Number(data.last_run.queued ?? 0),
                    done: Number(data.last_run.done ?? 0),
                    failed: Number(data.last_run.failed ?? 0),
                    source: data.last_run.source ?? null,
                  }
                : null,
            }
          : null;
        setRepairSummary(normalized);
        if (!nextRid) nextRid = ok.rid;
      }

      // OPS
      if (!opsRes.ok || !opsJson || (opsJson as any).ok !== true) {
        const e = opsJson as OpsEventsErr | null;
        errors.push(e?.message || e?.error || `HTTP ${opsRes.status}`);
        setOpsEvents(null);
        if (!nextRid) nextRid = e?.rid || null;
      } else {
        const ok = opsJson as OpsEventsOk;
        const data = ok.data ?? null;
        const normalized: OpsEventsData | null = data
          ? { items: Array.isArray(data.items) ? data.items : [], total: Number(data.total ?? 0) }
          : null;
        setOpsEvents(normalized);
        if (!nextRid) nextRid = ok.rid;
      }

      // ORDER INTEGRITY SUMMARY
      if (!integrityRes.ok || !integrityJson || (integrityJson as any).ok !== true) {
        const e = integrityJson as IntegritySummaryErr | null;
        errors.push(e?.message || e?.error || `HTTP ${integrityRes.status}`);
        setIntegritySummary(null);
        if (!nextRid) nextRid = e?.rid || null;
      } else {
        const ok = integrityJson as IntegritySummaryOk;
        const data = ok.data ?? null;
        const normalized: IntegritySummary | null = data
          ? {
              window_days: Number(data.window_days ?? 30),
              counts: {
                ok: Number(data.counts?.ok ?? 0),
                quarantined: Number(data.counts?.quarantined ?? 0),
              },
              incidents: {
                items: Array.isArray(data.incidents?.items) ? data.incidents.items : [],
                total: Number(data.incidents?.total ?? 0),
              },
              last_run: data.last_run
                ? {
                    ts: data.last_run.ts ?? null,
                    rid: data.last_run.rid ?? null,
                    queued: Number(data.last_run.queued ?? 0),
                    dedupe_groups: Number(data.last_run.dedupe_groups ?? 0),
                    normalize_ids: Number(data.last_run.normalize_ids ?? 0),
                    quarantine_ids: Number(data.last_run.quarantine_ids ?? 0),
                  }
                : null,
            }
          : null;
        setIntegritySummary(normalized);
        if (!nextRid) nextRid = ok.rid;
      }

      setRid(nextRid ?? null);
      if (errors.length) setErr(errors.join(" | "));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kunne ikke hente systemstatus.";
      setErr(String(msg));
      setHealth(null);
      setIncidents(null);
      setRepairJobs(null);
      setRepairSummary(null);
      setOpsEvents(null);
      setIntegritySummary(null);
    } finally {
      setLoading(false);
    }
  }


  const loadCodexPrompt = useCallback(async () => {
    const built = buildCodexPrompt({ rid, data: health });
    const prompt: CodexPromptData = {
      ts: new Date().toISOString(),
      prompt: built.prompt,
      itemsCount: built.itemsCount,
      openIncidentsCount: incidentItems.length,
      failedJobsCount: jobItems.filter((j) => j.state === "failed" || j.state === "pending").length,
      flowFailsCount: flowChecks.filter((c) => c.status !== "OK").length,
    };
    setCodexPrompt(prompt);
    setCodexRid(rid ?? null);
    setCodexErr(null);
  }, [flowChecks, health, incidentItems, jobItems, rid]);
  async function runRepairs() {
    setRepairing(true);
    setRepairAction(null);

    try {
      const res = await fetch("/api/superadmin/system/repairs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeOrderIntegrity }),
      });
      const json = (await res.json().catch(() => null)) as RepairRunResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const e = json as RepairRunErr | null;
        setRepairAction({ kind: "err", message: e?.message || e?.error || `HTTP ${res.status}`, rid: e?.rid ?? null });
      } else {
        const ok = json as RepairRunOk;
        setRepairAction({
          kind: "ok",
          message: includeOrderIntegrity ? "Trygg reparasjon + ordre-integritet startet." : "Trygg reparasjon startet.",
          rid: ok.rid,
        });
      }

      await loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kunne ikke starte reparasjon.";
      setRepairAction({ kind: "err", message: String(msg) });
    } finally {
      setRepairing(false);
    }
  }

  async function runFlowDiagnostics() {
    setCheckingFlow(true);
    setFlowAction(null);

    try {
      const res = await fetch("/api/superadmin/system/flow/diagnostics", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as FlowDiagResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const e = json as FlowDiagErr | null;
        setFlowAction({ kind: "err", message: e?.message || e?.error || `HTTP ${res.status}`, rid: e?.rid ?? null });
        setFlowDiagnostics(null);
        setFlowRid(e?.rid ?? null);
      } else {
        const ok = json as FlowDiagOk;
        setFlowDiagnostics(ok.data ?? null);
        setFlowRid(ok.rid ?? null);
        setFlowAction({ kind: "ok", message: "Flytsjekk fullført.", rid: ok.rid });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kunne ikke kjøre flytsjekk.";
      setFlowAction({ kind: "err", message: String(msg) });
    } finally {
      setCheckingFlow(false);
    }
  }

  async function runOrderIntegrity() {
    setRunningIntegrity(true);
    setIntegrityAction(null);

    try {
      const res = await fetch("/api/superadmin/system/repairs/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeOrderIntegrity: true }),
      });
      const json = (await res.json().catch(() => null)) as RepairRunResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const e = json as RepairRunErr | null;
        setIntegrityAction({ kind: "err", message: e?.message || e?.error || `HTTP ${res.status}`, rid: e?.rid ?? null });
      } else {
        const ok = json as RepairRunOk;
        setIntegrityAction({ kind: "ok", message: "Ordre-integritet startet.", rid: ok.rid });
      }

      await loadAll();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Kunne ikke starte ordre-integritet.";
      setIntegrityAction({ kind: "err", message: String(msg) });
    } finally {
      setRunningIntegrity(false);
    }
  }

  useEffect(() => {
    loadAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    loadCodexPrompt().catch(() => {});
  }, [loadCodexPrompt]);
  useEffect(() => {
    codexTimerRef.current = window.setInterval(() => {
      loadCodexPrompt().catch(() => {});
    }, 60000);

    return () => {
      if (codexTimerRef.current) window.clearInterval(codexTimerRef.current);
    };
  }, [loadCodexPrompt]);

  const checks: HealthCheck[] = Array.isArray(health?.checks?.items) ? health!.checks.items : [];
  const derivedStatus = checks.length ? deriveSystemStatus(checks) : "degraded";
  const effectiveStatus = health?.status ?? derivedStatus;
  const systemStatusUi = effectiveStatus === "normal" ? "NORMAL" : "DEGRADED";
  const reasons = Array.isArray(health?.reasons) ? health!.reasons : [];
  const derivedReasons = deriveReasons(checks);
  const effectiveReasons = reasons.length ? reasons : derivedReasons;
  const runtimeDetails = health?.details?.runtime ?? null;
  const runtimeMissing = Array.isArray(runtimeDetails?.missing) ? runtimeDetails!.missing : [];
  const incidentTotal = Number(incidents?.total ?? 0);
  const jobTotal = Number(repairJobs?.total ?? 0);
  const counts = repairSummary?.counts ?? { pending: 0, running: 0, failed: 0, done: 0 };
  const lastRun = repairSummary?.last_run ?? null;
  const opsItems = Array.isArray(opsEvents?.items) ? opsEvents!.items : [];
  const opsTotal = Number(opsEvents?.total ?? 0);

  const flowStatus = flowDiagnostics?.status ?? null;

  const integrityCounts = integritySummary?.counts ?? { ok: 0, quarantined: 0 };
  const integrityIncidents = Array.isArray(integritySummary?.incidents?.items) ? integritySummary!.incidents.items : [];
  const integrityTotal = Number(integritySummary?.incidents?.total ?? 0);
  const integrityLastRun = integritySummary?.last_run ?? null;

  const flowIdsByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const check of flowChecks) {
      const ids = Array.isArray(check?.evidence?.ids)
        ? (check.evidence.ids as any[]).map((x) => safeStr(x)).filter(Boolean)
        : [];
      map.set(check.key, ids);
    }
    return map;
  }, [flowChecks]);

  const copyText = async (text: string) => {
    const t = safeStr(text);
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      {/* SYSTEMSTATUS */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
        <div className="text-xs font-extrabold tracking-wide text-neutral-600">SYSTEMSTATUS</div>
        <h1 className="mt-1 text-lg font-extrabold text-neutral-900">Systemstatus</h1>
        <div className="mt-3 flex items-center gap-2">
          <StatusPill state={systemStatusUi} />
          <div className="text-xs text-neutral-600">Oppdatert: {formatISO(health?.ts)}</div>
        </div>
        <div className="mt-1 text-xs text-neutral-600">RID: {rid ?? "—"}</div>

        <div className="mt-4">
          <Button disabled={loading} variant="secondary" onClick={loadAll}>
            {loading ? "Oppdaterer…" : "Oppdater status"}
          </Button>
        </div>

        <div className="mt-5">
          <div className="text-sm font-semibold text-neutral-900">Sjekker</div>
          <div className="mt-3 space-y-2">
            {checks.length ? (
              checks.map((c) => (
                <div key={c.key} className="rounded-xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-neutral-900">{c.message}</div>
                    <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", statusTone(c.status)].join(" ")}>
                      {c.status}
                    </span>
                  </div>
                  {c.status !== "OK" && c.key === "runtime" && runtimeDetails ? (
                    <div className="mt-2 rounded-lg bg-[rgb(var(--lp-surface-2))] p-3 text-xs text-neutral-700 ring-1 ring-[rgb(var(--lp-border))]">
                      <div className="font-semibold text-neutral-900">Detaljer</div>
                      <div className="mt-1">Mangler env: {runtimeMissing.length ? runtimeMissing.join(", ") : "—"}</div>
                      <div className="mt-1">
                        NODE_ENV: {runtimeDetails.node_env ?? "—"} • runtime: {runtimeDetails.runtime ?? "—"}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] p-3 text-sm text-neutral-600 ring-1 ring-[rgb(var(--lp-border))]">
                Ingen sjekker tilgjengelig ennå.
              </div>
            )}
          </div>

          <div className="mt-4 text-sm text-neutral-600">
            {effectiveReasons.length ? `Årsaker: ${effectiveReasons.join(", ")}` : "Ingen degraderingsårsaker."}
          </div>
        </div>
      </div>

      {/* FEIL */}
      {err ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 shadow-[var(--lp-shadow-soft)]">
          {err}
          {rid ? <div className="mt-1 text-xs font-mono text-rose-800">RID: {rid}</div> : null}
        </div>
      ) : null}

      {/* LOADING */}
      {loading ? (
        <div className="rounded-2xl bg-[rgb(var(--lp-surface-2))] p-4 text-sm text-neutral-600 ring-1 ring-[rgb(var(--lp-border))]">
          Laster systemstatus…
        </div>
      ) : null}

      {/* REPARASJONER */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Reparasjoner</div>
            <div className="mt-1 text-xs text-neutral-600">Kø: {jobTotal}</div>
          </div>
          <Button disabled={repairing} onClick={runRepairs} className="lp-neon-focus lp-neon-glow-hover">
            {repairing ? "Kjører…" : "Kjør trygg reparasjon"}
          </Button>
        </div>

        <div className="mt-2 text-xs text-neutral-600">Cron krever env: SYSTEM_MOTOR_SECRET</div>

        <label className="mt-3 flex items-center gap-2 text-xs text-neutral-700">
          <input
            type="checkbox"
            checked={includeOrderIntegrity}
            onChange={(e) => setIncludeOrderIntegrity(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          Inkluder ordre-integritet (Phase 3)
        </label>

        {repairAction ? (
          <div
            className={[
              "mt-3 rounded-xl border p-3 text-sm",
              repairAction.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900",
            ].join(" ")}
          >
            {repairAction.message}
            {repairAction.rid ? <div className="mt-1 text-xs font-mono">RID: {repairAction.rid}</div> : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2">
          <div>Pending: {counts.pending}</div>
          <div>Running: {counts.running}</div>
          <div>Feil: {counts.failed}</div>
          <div>Ferdig: {counts.done}</div>
        </div>

        <div className="mt-2 text-xs text-neutral-600">
          Sist kjørt: {lastRun?.ts ? formatISO(lastRun.ts) : "—"}
          {lastRun?.rid ? ` • RID: ${lastRun.rid}` : ""}
          {lastRun?.source ? ` • Kilde: ${lastRun.source}` : ""}
        </div>

        <div className="mt-3 space-y-2">
          {jobItems.length ? (
            jobItems.map((job) => (
              <div key={job.id} className="rounded-xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-neutral-900">{jobLabel(job.job_type)}</div>
                  <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", jobTone(job.state)].join(" ")}>
                    {job.state}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">
                  Neste forsøk: {formatISO(job.next_run_at)} • Forsøk: {job.attempts}
                </div>
                {job.payload?.user_id ? <div className="mt-1 text-xs text-neutral-600">User: {job.payload.user_id}</div> : null}
                {job.last_error ? <div className="mt-1 text-xs text-rose-700">Feil: {job.last_error}</div> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] p-3 text-sm text-neutral-600 ring-1 ring-[rgb(var(--lp-border))]">
              Ingen jobber i køen.
            </div>
          )}
        </div>
      </div>

      {/* ORDRE-INTEGRITET */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Ordre-integritet</div>
            <div className="mt-1 text-xs text-neutral-600">Siste {integritySummary?.window_days ?? 30} dager</div>
          </div>
          <Button variant="secondary" disabled={runningIntegrity} onClick={runOrderIntegrity}>
            {runningIntegrity ? "Kjører…" : "Kjør ordre-integritet nå"}
          </Button>
        </div>

        {integrityAction ? (
          <div
            className={[
              "mt-3 rounded-xl border p-3 text-sm",
              integrityAction.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900",
            ].join(" ")}
          >
            {integrityAction.message}
            {integrityAction.rid ? <div className="mt-1 text-xs font-mono">RID: {integrityAction.rid}</div> : null}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2">
          <div>OK: {integrityCounts.ok}</div>
          <div>Karantene: {integrityCounts.quarantined}</div>
        </div>

        <div className="mt-2 text-xs text-neutral-600">
          Sist kjørt: {integrityLastRun?.ts ? formatISO(integrityLastRun.ts) : "—"}
          {integrityLastRun?.rid ? ` • RID: ${integrityLastRun.rid}` : ""}
        </div>

        {integrityLastRun ? (
          <div className="mt-2 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2">
            <div>Dedupe-grupper: {integrityLastRun.dedupe_groups}</div>
            <div>Normalisert: {integrityLastRun.normalize_ids}</div>
            <div>Karantene: {integrityLastRun.quarantine_ids}</div>
            <div>Køet: {integrityLastRun.queued}</div>
          </div>
        ) : null}

        <div className="mt-4">
          <div className="text-sm font-semibold text-neutral-900">Siste hendelser</div>
          <div className="mt-1 text-xs text-neutral-600">Totalt: {integrityTotal}</div>

          <div className="mt-3 space-y-2">
            {integrityIncidents.length ? (
              integrityIncidents.map((i) => {
                const ids = Array.isArray(i.details?.order_ids)
                  ? i.details.order_ids.map((x: any) => safeStr(x)).filter(Boolean)
                  : Array.isArray(i.details?.evidence?.order_ids)
                  ? i.details.evidence.order_ids.map((x: any) => safeStr(x)).filter(Boolean)
                  : [];
                const idsText = ids.join(", ");

                return (
                  <div key={i.id} className="rounded-xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-neutral-900">
                        {i.type} • {i.status}
                      </div>
                      <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", severityTone(i.severity)].join(" ")}>
                        {i.severity}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-neutral-600">{i.details?.last_message || i.details?.message || "—"}</div>
                    <div className="mt-1 text-xs text-neutral-600">Sist sett: {formatISO(i.last_seen)} • Antall: {i.count}</div>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Button size="sm" variant="secondary" onClick={() => copyText(i.rid ?? "")} disabled={!i.rid}>
                        Kopier RID
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => copyText(idsText)} disabled={!idsText}>
                        Kopier ID-er
                      </Button>
                    </div>

                    {idsText ? <div className="mt-2 text-xs text-neutral-600">ID-er: {idsText}</div> : null}
                  </div>
                );
              })
            ) : (
              <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] p-3 text-sm text-neutral-600 ring-1 ring-[rgb(var(--lp-border))]">
                Ingen ordre-integritet hendelser.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FLYTDIAGNOSTIKK */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Flytdiagnostikk</div>
            <div className="mt-1 text-xs text-neutral-600">Status: {flowStatus ? flowStatus.toUpperCase() : "—"}</div>
          </div>
          <Button variant="secondary" disabled={checkingFlow} onClick={runFlowDiagnostics}>
            {checkingFlow ? "Kjører…" : "Kjør flytsjekk"}
          </Button>
        </div>

        {flowAction ? (
          <div
            className={[
              "mt-3 rounded-xl border p-3 text-sm",
              flowAction.kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900",
            ].join(" ")}
          >
            {flowAction.message}
            {flowAction.rid ? <div className="mt-1 text-xs font-mono">RID: {flowAction.rid}</div> : null}
          </div>
        ) : null}

        <div className="mt-3 space-y-2">
          {flowChecks.length ? (
            flowChecks.map((c) => {
              const ids = flowIdsByKey.get(c.key) ?? [];
              const idsText = ids.join(", ");

              return (
              <div key={c.key} className="rounded-xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-neutral-900">{c.message}</div>
                    <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", statusTone(c.status)].join(" ")}>
                      {c.status}
                    </span>
                  </div>

                  <div className="mt-1 text-xs text-neutral-600">{c.suggested_action}</div>

                  {c.status === "FAIL" ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Button size="sm" variant="secondary" onClick={() => copyText(flowRid ?? "")} disabled={!flowRid}>
                        Kopier RID
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => copyText(idsText)} disabled={!idsText}>
                        Kopier ID-er
                      </Button>
                    </div>
                  ) : null}

                  {c.status === "FAIL" && ids.length ? <div className="mt-2 text-xs text-neutral-600">ID-er: {idsText}</div> : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] p-3 text-sm text-neutral-600 ring-1 ring-[rgb(var(--lp-border))]">
              Ingen flytsjekk kjørt ennå.
            </div>
          )}
        </div>
      </div>

      {/* OPS-LOGG */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
        <div className="text-sm font-semibold text-neutral-900">Ops-logg</div>
        <div className="mt-1 text-xs text-neutral-600">Totalt: {opsTotal}</div>

        <div className="mt-3 space-y-2">
          {opsItems.length ? (
            opsItems.map((o, idx) => (
              <div key={`${o.event}_${idx}`} className="rounded-xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-neutral-900">{o.event}</div>
                  <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", opsTone(o.level)].join(" ")}>
                    {o.level}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-600">{formatISO(o.ts)}</div>
                {o.rid ? <div className="mt-1 text-xs font-mono text-neutral-600">RID: {o.rid}</div> : null}
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] p-3 text-sm text-neutral-600 ring-1 ring-[rgb(var(--lp-border))]">
              Ingen ops-hendelser.
            </div>
          )}
        </div>
      </div>

      {/* HENDELSER */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
        <div className="text-sm font-semibold text-neutral-900">Hendelser</div>
        <div className="mt-1 text-xs text-neutral-600">Totalt: {incidentTotal}</div>

        <div className="mt-3 space-y-2">
          {incidentItems.length ? (
            incidentItems.map((i) => (
              <div key={i.id} className="rounded-xl bg-[rgb(var(--lp-surface))] p-4 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-neutral-900">
                    {i.type} • {i.status}
                  </div>
                  <span className={["rounded-full px-3 py-1 text-xs font-semibold ring-1", severityTone(i.severity)].join(" ")}>
                    {i.severity}
                  </span>
                </div>

                <div className="mt-1 text-xs text-neutral-600">{i.details?.last_message || i.details?.check_key || "—"}</div>
                <div className="mt-1 text-xs text-neutral-600">
                  Sett: {formatISO(i.first_seen)} • Sist sett: {formatISO(i.last_seen)} • Antall: {i.count}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl bg-[rgb(var(--lp-surface-2))] p-3 text-sm text-neutral-600 ring-1 ring-[rgb(var(--lp-border))]">
              Ingen åpne hendelser.
            </div>
          )}
        </div>
      </div>
      {/* CODEX PROMPT (LIVE) */}
      <div className="rounded-2xl bg-[rgb(var(--lp-surface))] p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-[var(--lp-shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-neutral-900">Codex Prompt (Live)</div>
            <div className="mt-1 text-xs text-neutral-600">
              Sist generert: {codexPrompt?.ts ? formatISO(codexPrompt.ts) : "—"}
            </div>
            <div className="mt-1 text-xs text-neutral-600">RID: {codexRid ?? "—"}</div>
            <div className="mt-1 text-xs text-neutral-600">
              Scope: Health + åpne hendelser + reparasjonsjobber (pending/failed) + flytdiagnostikk (FAIL/WARN)
            </div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => copyText(codexPrompt?.prompt ?? "")} disabled={!codexPrompt?.prompt}>
            Kopier prompt
          </Button>
        </div>

        <div className="mt-2 grid gap-2 text-xs text-neutral-600 sm:grid-cols-2">
          <div>Items: {codexPrompt?.itemsCount ?? 0}</div>
          <div>Åpne hendelser: {codexPrompt?.openIncidentsCount ?? 0}</div>
          <div>Jobber (pending/failed): {codexPrompt?.failedJobsCount ?? 0}</div>
          <div>Flyt FAIL/WARN: {codexPrompt?.flowFailsCount ?? 0}</div>
        </div>

        {codexErr ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
            Kunne ikke generere prompt.
            {codexRid ? <div className="mt-1 font-mono">RID: {codexRid}</div> : null}
          </div>
        ) : null}

        <div className="mt-3 rounded-xl bg-[rgb(var(--lp-surface-2))] p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <pre className="whitespace-pre-wrap text-xs font-mono text-neutral-900">
            {codexPrompt?.prompt || "Ingen prompt generert ennå."}
          </pre>
        </div>

        <div className="mt-2 text-xs text-neutral-500">Oppdateres hvert 60. sekund.</div>
      </div>
    </div>
  );
}


