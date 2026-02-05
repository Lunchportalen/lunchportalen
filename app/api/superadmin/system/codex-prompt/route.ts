export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403 } from "@/lib/http/routeGuard";

type CheckStatus = "OK" | "WARN" | "FAIL";
type SystemStatus = "normal" | "degraded";

type HealthCheck = { key: string; status: CheckStatus; message: string };

type HealthData = {
  status: SystemStatus;
  reasons: string[];
  checks: { items: HealthCheck[] };
  ts: string;
};

type HealthOk = { ok: true; rid: string; data: HealthData };
type HealthErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type HealthResp = HealthOk | HealthErr;

type Incident = {
  id: string;
  severity?: string;
  type: string;
  status: string;
  count: number;
  first_seen?: string | null;
  last_seen?: string | null;
  scope_company_id?: string | null;
  scope_user_id?: string | null;
  scope_order_id?: string | null;
  details?: Record<string, any> | null;
  rid?: string | null;
};

type IncidentsData = { items: Incident[]; total: number };
type IncidentsOk = { ok: true; rid: string; data: IncidentsData };
type IncidentsErr = { ok: false; rid?: string; error: string; message?: string; status?: number };
type IncidentsResp = IncidentsOk | IncidentsErr;

type RepairJob = {
  id: string;
  job_type: string;
  payload: Record<string, any> | null;
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

type PromptItem = {
  source: "incident" | "repair_job" | "flow_check";
  type: string;
  promptType: "AUTO-REPAIR" | "RUNBOOK" | "CODE FIX";
  scope_company_id?: string | null;
  scope_user_id?: string | null;
  scope_order_id?: string | null;
  check_key?: string | null;
  rid?: string | null;
  message: string;
  repro: string;
  expected: string;
  actual: string;
  rootCause: string;
  fix: string;
  verification: string;
  suggestedAction?: string | null;
  sampleIds?: string[];
  evidence?: Record<string, any> | null;
};

type PromptItemDeduped = PromptItem & { count: number };

type PromptCounts = {
  itemsCount: number;
  openIncidentsCount: number;
  failedJobsCount: number;
  flowFailsCount: number;
};

function denyResponse(s: any): Response {
  if (s?.response) return s.response as Response;
  if (s?.res) return s.res as Response;
  const rid = String(s?.ctx?.rid ?? "rid_missing");
  return jsonErr(rid, "Du må være innlogget.", 401, "UNAUTHENTICATED");
}

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const ID_KEYS = ["order_ids", "user_ids", "company_ids", "location_ids", "ids", "evidence_ids"];
const MOJIBAKE_MARKERS = ["Ã", "Â", "â", "ï¿½", "Ãƒ"];

function hasMojibake(text: string) {
  return MOJIBAKE_MARKERS.some((m) => text.includes(m));
}

function sanitizeText(text: string, fallback: string) {
  const t = safeStr(text);
  if (!t) return fallback;
  if (hasMojibake(t)) return fallback;
  return t;
}

function sanitizeEvidenceStrings(value: any): any {
  if (typeof value === "string") {
    return hasMojibake(value) ? "tegnfeil (encoding)" : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeEvidenceStrings(v));
  }
  if (value && typeof value === "object") {
    const next: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      next[k] = sanitizeEvidenceStrings(v);
    }
    return next;
  }
  return value;
}

function formatScope(item: PromptItem) {
  const company = safeStr(item.scope_company_id) || "—";
  const user = safeStr(item.scope_user_id) || "—";
  const order = safeStr(item.scope_order_id) || "—";
  return `company_id=${company}, user_id=${user}, order_id=${order}`;
}

function trimIdList(list: any, max = 10) {
  if (!Array.isArray(list)) return list;
  const trimmed = list.map((id) => safeStr(id)).filter(Boolean).slice(0, max);
  return trimmed;
}

function trimEvidence(evidence?: Record<string, any> | null, maxIds = 10) {
  if (!evidence) return null;
  const trimmed: Record<string, any> = sanitizeEvidenceStrings({ ...evidence });
  for (const key of ID_KEYS) {
    if (key in trimmed) trimmed[key] = trimIdList(trimmed[key], maxIds);
  }
  if (trimmed.evidence && typeof trimmed.evidence === "object") {
    const nested = sanitizeEvidenceStrings({ ...(trimmed.evidence as Record<string, any>) });
    for (const key of ID_KEYS) {
      if (key in nested) nested[key] = trimIdList(nested[key], maxIds);
    }
    trimmed.evidence = nested;
  }
  return trimmed;
}

function compactEvidence(evidence?: Record<string, any> | null) {
  if (!evidence || Object.keys(evidence).length === 0) return "";
  const json = JSON.stringify(evidence);
  if (json.length <= 900) return json;
  return json.slice(0, 900) + "…";
}

function extractSampleIds(evidence?: Record<string, any> | null, max = 10) {
  if (!evidence) return [];
  const ids: string[] = [];
  for (const key of ID_KEYS) {
    const list = evidence[key];
    if (Array.isArray(list)) {
      for (const id of list) {
        const v = safeStr(id);
        if (v && !ids.includes(v)) ids.push(v);
        if (ids.length >= max) return ids;
      }
    }
  }
  const nested = evidence.evidence && typeof evidence.evidence === "object" ? (evidence.evidence as Record<string, any>) : null;
  if (nested) {
    for (const key of ID_KEYS) {
      const list = nested[key];
      if (Array.isArray(list)) {
        for (const id of list) {
          const v = safeStr(id);
          if (v && !ids.includes(v)) ids.push(v);
          if (ids.length >= max) return ids;
        }
      }
    }
  }
  return ids;
}

function mergeSampleIds(existing: string[] | undefined, incoming: string[] | undefined, max = 10) {
  const merged: string[] = [];
  const add = (list?: string[]) => {
    if (!list) return;
    for (const id of list) {
      const v = safeStr(id);
      if (v && !merged.includes(v)) merged.push(v);
      if (merged.length >= max) return;
    }
  };
  add(existing);
  add(incoming);
  return merged;
}

function verificationChecklist(source: PromptItem["source"]) {
  return `1) Reproduser ${source} og verifiser riktig scope. 2) Kjør relevant endpoint på nytt og bekreft at item forsvinner. 3) build:enterprise, typecheck, lint, sanity:live.`;
}

function incidentToItem(i: Incident): PromptItem {
  const details = i.details ?? {};
  const checkKey = safeStr((details as any)?.check_key) || null;
  const rawMessage = safeStr((details as any)?.last_message) || safeStr((details as any)?.message);
  const lastMessage = sanitizeText(rawMessage, "Hendelse med tegnfeil i melding. Se evidence.");
  const suggested = sanitizeText((details as any)?.suggested_action, "");
  const evidence: Record<string, any> = {};

  if ((details as any)?.evidence) evidence.evidence = (details as any).evidence;
  if ((details as any)?.order_ids) evidence.order_ids = (details as any).order_ids;
  if (checkKey) evidence.check_key = checkKey;
  if (safeStr((details as any)?.repair_key)) evidence.repair_key = safeStr((details as any)?.repair_key);

  return {
    source: "incident",
    type: safeStr(i.type) || "INCIDENT",
    promptType: "RUNBOOK",
    scope_company_id: safeStr(i.scope_company_id) || null,
    scope_user_id: safeStr(i.scope_user_id) || null,
    scope_order_id: safeStr(i.scope_order_id) || null,
    check_key: checkKey,
    rid: safeStr(i.rid) || null,
    message: lastMessage || `Hendelse: ${safeStr(i.type)}`,
    repro: `Repro: Kjør /api/superadmin/system/incidents?status=open og finn type=${safeStr(i.type) || "UNKNOWN"}${checkKey ? `, check_key=${checkKey}` : ""}.`,
    expected: `Ingen åpne hendelser for type ${safeStr(i.type) || "UNKNOWN"}.`,
    actual: `Hendelse er ${safeStr(i.status) || "open"} (count=${safeNum(i.count, 1)}).`,
    rootCause: lastMessage || `Åpen hendelse av type ${safeStr(i.type) || "UNKNOWN"}.`,
    fix: suggested || "Fiks rotårsaken og marker hendelsen som resolved.",
    verification: verificationChecklist("incident"),
    suggestedAction: suggested || null,
    sampleIds: extractSampleIds(evidence),
    evidence: Object.keys(evidence).length ? trimEvidence(evidence) : null,
  };
}

function repairJobToItem(j: RepairJob): PromptItem {
  const payload = (j.payload ?? {}) as Record<string, any>;
  const lastError = sanitizeText(safeStr(j.last_error), "");
  const dedupeKey = safeStr(payload?.dedupe_key);
  const evidence: Record<string, any> = {
    attempts: safeNum(j.attempts, 0),
    next_run_at: j.next_run_at ?? null,
  };

  if (lastError) evidence.last_error = lastError;
  if (dedupeKey) evidence.dedupe_key = dedupeKey;
  if (safeStr(payload?.order_ids)) evidence.order_ids = payload.order_ids;

  return {
    source: "repair_job",
    type: safeStr(j.job_type) || "REPAIR_JOB",
    promptType: "AUTO-REPAIR",
    scope_company_id: safeStr(payload?.company_id) || null,
    scope_user_id: safeStr(payload?.user_id) || null,
    scope_order_id: safeStr(payload?.order_id) || null,
    check_key: dedupeKey || null,
    rid: safeStr(j.rid) || null,
    message: lastError || `Reparasjonsjobb ${safeStr(j.job_type) || "UNKNOWN"} er ${safeStr(j.state) || "pending"}.`,
    repro: `Repro: Kjør /api/superadmin/system/repairs/jobs og finn job_type=${safeStr(j.job_type) || "UNKNOWN"} i state=${safeStr(j.state) || "pending"}.`,
    expected: "Reparasjonsjobber skal fullføre (state=done).",
    actual: `Jobb er ${safeStr(j.state) || "pending"}${lastError ? ` med feil: ${lastError}` : ""}.`,
    rootCause: lastError || "Reparasjonsjobb i kø/feil.",
    fix: "Fiks underliggende feil, rydd/juster jobben og re-kjør system motor om nødvendig.",
    verification: verificationChecklist("repair_job"),
    sampleIds: extractSampleIds(evidence),
    evidence: trimEvidence(evidence),
  };
}

function flowCheckToItem(c: FlowCheck): PromptItem {
  const evidence = (c.evidence ?? {}) as Record<string, any>;
  const suggested = sanitizeText(c.suggested_action, "");
  const message = sanitizeText(c.message, "Flytsjekk feilet (tegnfeil i melding). Se evidence.");
  const rootCause =
    sanitizeText(c.message, "") || sanitizeText((evidence as any)?.error, "") || "Flytsjekk feilet. Se evidence.";

  return {
    source: "flow_check",
    type: safeStr(c.key) || "FLOW_CHECK",
    promptType: "RUNBOOK",
    scope_company_id: safeStr((evidence as any)?.company_id) || null,
    scope_user_id: safeStr((evidence as any)?.user_id) || null,
    scope_order_id: safeStr((evidence as any)?.order_id) || null,
    check_key: safeStr(c.key) || null,
    rid: null,
    message,
    repro: `Repro: Kjør /api/superadmin/system/flow/diagnostics og finn check.key=${safeStr(c.key) || "UNKNOWN"}.`,
    expected: "Flytsjekk skal være OK.",
    actual: `Flytsjekk er ${safeStr(c.status) || "FAIL"}.`,
    rootCause,
    fix: suggested || "Fiks underliggende datafeil som flytsjekken peker på.",
    verification: verificationChecklist("flow_check"),
    suggestedAction: suggested || null,
    sampleIds: extractSampleIds(evidence),
    evidence: Object.keys(evidence).length ? trimEvidence(evidence) : null,
  };
}

function normalizeKey(v: any) {
  return safeStr(v).toLowerCase();
}

function hasExplicitInstruction(text?: string | null) {
  const t = safeStr(text).toLowerCase();
  if (!t) return false;
  if (t.includes("→") || t.includes("ui path") || t.includes("ui:") || t.includes("sql")) return true;
  if (t.includes("select ") || t.includes("update ") || t.includes("insert ") || t.includes("delete ")) return true;
  if (t.includes("/admin") || t.includes("/superadmin")) return true;
  return false;
}

function buildPrompt(counts: PromptCounts, health: HealthData, items: PromptItemDeduped[]) {
  const lines: string[] = [];

  lines.push("CODEX PROMPT (LIVE) — RC LOCK");
  lines.push("- Ikke rør middleware.ts, /login, /api/auth/post-login.");
  lines.push("- Ingen regresjoner i frosne flyter.");
  lines.push("- Én fiks per change-set.");
  lines.push("- API-kontrakt låst: {ok:true,rid,data} / {ok:false,rid,error,message,status}.");
  lines.push("- UTF-8 kun.");
  lines.push("- Fail-closed. Ingen gjetting. Ingen schema-endringer uten eksplisitt SCHEMA.");
  lines.push("");

  lines.push("STATE HEADER");
  lines.push(`itemsCount: ${counts.itemsCount}`);
  lines.push(`openIncidentsCount: ${counts.openIncidentsCount}`);
  lines.push(`failedJobsCount: ${counts.failedJobsCount}`);
  lines.push(`flowFailsCount: ${counts.flowFailsCount}`);
  lines.push(`healthStatus: ${safeStr(health.status) || "unknown"}`);
  lines.push(`healthTs: ${safeStr(health.ts) || ""}`);
  lines.push("");

  lines.push("GJELDENDE FEIL (kun uløste)");
  lines.push("Generer nøyaktig én change-set per item. Hver change-set må starte med header-blokken under.");
  lines.push("Header-blokk:");
  lines.push("- Title:");
  lines.push("- Scope:");
  lines.push("- Repro:");
  lines.push("- Expected:");
  lines.push("- Actual:");
  lines.push("- Root cause:");
  lines.push("- Fix:");
  lines.push("- Verification:");
  lines.push("");

  if (items.length === 0) {
    lines.push("Ingen uløste items. Ikke opprett oppgaver.");
    return lines.join("\n");
  }

  const autoRepair: PromptItemDeduped[] = [];
  const runbook: PromptItemDeduped[] = [];
  const codeFix: PromptItemDeduped[] = [];
  const noAction: PromptItemDeduped[] = [];

  for (const item of items) {
    const key = normalizeKey(item.check_key || item.type);
    if (item.promptType === "AUTO-REPAIR") {
      autoRepair.push(item);
      continue;
    }
    if (item.promptType === "CODE FIX") {
      if (key === "driver_inconsistent_delivery_flags") {
        codeFix.push(item);
      } else {
        noAction.push(item);
      }
      continue;
    }
    if (item.promptType === "RUNBOOK") {
      if (key === "employees_no_active_for_active_agreement" || hasExplicitInstruction(item.suggestedAction)) {
        runbook.push(item);
      } else {
        noAction.push(item);
      }
    }
  }

  const pushHeader = (item: PromptItemDeduped, title: string, fixLabel: string, verificationLabel: string) => {
    lines.push(title);
    lines.push("- Title: Codex remediation");
    lines.push(`- Scope: ${formatScope(item)}`);
    lines.push(`- Repro: ${item.repro}`);
    lines.push(`- Expected: ${item.expected}`);
    lines.push(`- Actual: ${item.actual}`);
    lines.push(`- Root cause: ${item.rootCause}`);
    lines.push(`- Fix: ${fixLabel}`);
    lines.push(`- Verification: ${verificationLabel}`);
    lines.push(`Type: ${item.promptType}`);
    if (item.check_key) lines.push(`Check key: ${item.check_key}`);
    lines.push(`RID: ${safeStr(item.rid) || "—"}`);
    const evidenceText = compactEvidence(item.evidence ?? null);
    lines.push(`Evidence (max 10 ids): ${evidenceText || "—"}`);
    const sampleIds = Array.isArray(item.sampleIds) ? item.sampleIds : [];
    lines.push(`Sample IDs (max 10): ${sampleIds.length ? sampleIds.join(", ") : "—"}`);
    if (item.count > 1) lines.push(`Evidence count: ${item.count}`);
    lines.push("");
  };

  if (autoRepair.length) {
    lines.push("AUTO-REPAIR (IDEMPOTENT)");
    autoRepair.forEach((item, idx) => {
      pushHeader(
        item,
        `${idx + 1}. ${item.type} (${item.source})`,
        "AUTO-REPAIR: Kjør reparasjonsmotoren under.",
        "Etter kjøring skal item forsvinne fra /superadmin/system."
      );
      lines.push("AUTO-REPAIR RUN:");
      lines.push("Forutsetninger: Superadmin, item er fortsatt åpen/pending/failed.");
      lines.push("Endpoint: POST /api/superadmin/system/repairs/run");
      lines.push("Body: { \"includeOrderIntegrity\": false }");
      lines.push("Forventet resultat: Jobb går til state=done eller failed med last_error, tilknyttet incident/flow forsvinner.");
      lines.push("Idempotens: Trygg å kjøre på nytt; dedupe/state beskytter mot dobbel effekt.");
      lines.push("Verifikasjon:");
      lines.push("1) /api/superadmin/system/repairs/jobs viser jobben som done/failed.");
      lines.push("2) /api/superadmin/system/incidents?status=open viser ikke item.");
      lines.push("3) /api/superadmin/system/flow/diagnostics viser OK/WARN der relevant.");
      lines.push("Audit: ops_events inkluderer system.motor.start + repair.job.done/failed.");
      lines.push("");
    });
  }

  if (runbook.length) {
    lines.push("RUNBOOK (A/B)");
    runbook.forEach((item, idx) => {
      const key = normalizeKey(item.check_key || item.type);
      pushHeader(
        item,
        `${idx + 1}. ${item.type} (${item.source})`,
        "RUNBOOK A/B under.",
        "Se RUNBOOK A/B under."
      );

      if (key === "employees_no_active_for_active_agreement") {
        const ids = item.sampleIds?.length ? item.sampleIds.join(", ") : "—";
        lines.push("RUNBOOK A (firma-admin):");
        lines.push("Forutsetninger: Avtalen er aktiv og firma-admin har tilgang.");
        lines.push("UI path: Firma-admin → Firma → Ansatte.");
        lines.push(`Steg: Legg til/aktiver minst én ansatt (is_active=true) for company_id i scope. Evidence IDs: ${ids}.`);
        lines.push("Idempotens: Hvis aktiv ansatt allerede finnes, ingen endring.");
        lines.push("Verifikasjon:");
        lines.push("1) Flytsjekk går til OK/WARN.");
        lines.push("2) Hendelser for denne sjekken forsvinner.");
        lines.push("Audit: Endring logges i ansatt/avtalehistorikk.");
        lines.push("");
        lines.push("RUNBOOK B (superadmin):");
        lines.push("Forutsetninger: Ingen aktiv ansatt kan opprettes nå.");
        lines.push("UI path: Superadmin → Firma → Avtale.");
        lines.push("Steg: Paus eller deaktiver avtalen for selskapet i scope.");
        lines.push("Idempotens: Gjenta kun hvis avtalen fortsatt er aktiv.");
        lines.push("Verifikasjon:");
        lines.push("1) Flytsjekk går til OK/WARN.");
        lines.push("2) Hendelser for denne sjekken forsvinner.");
        lines.push("Audit: Avtalestatus endres med superadmin-audit.");
        lines.push("");
      } else {
        lines.push("RUNBOOK A (eksplisitt instruksjon fra evidens):");
        lines.push("Forutsetninger: Instruksjonen er godkjent og innenfor riktig scope.");
        lines.push(`Instruksjon: ${safeStr(item.suggestedAction)}`);
        lines.push("Idempotens: Kjør kun én gang per scope; re-run skal være no-op hvis allerede korrekt.");
        lines.push("Verifikasjon:");
        lines.push("1) Item forsvinner fra incident/flow.");
        lines.push("2) Systemstatus beveger seg mot OK.");
        lines.push("Audit: ops_events viser resolusjon eller oppdatert last_seen.");
        lines.push("");
        lines.push("RUNBOOK B (trygg avklaring + eskalering):");
        lines.push("Forutsetninger: RUNBOOK A er ikke mulig uten å bryte scope.");
        lines.push("UI path: Superadmin → System → Hendelser/Flytdiagnostikk → åpne item → kopier evidence IDs.");
        lines.push("Steg: Opprett CODE FIX-oppgave med nøyaktig scope + repro + evidence IDs (max 10).");
        lines.push("Idempotens: Read-only; ingen dataendringer.");
        lines.push("Verifikasjon:");
        lines.push("1) Evidence IDs matcher scope.");
        lines.push("2) CODE FIX-oppgaven inneholder eksakt filsti og minimal endring.");
        lines.push("Audit: ops_events viser undersøkelse eller incident-oppdatering.");
        lines.push("");
      }
    });
  }

  if (codeFix.length) {
    lines.push("CODE FIX (MINIMALE ENDRINGER)");
    codeFix.forEach((item, idx) => {
      const key = normalizeKey(item.check_key || item.type);
      pushHeader(
        item,
        `${idx + 1}. ${item.type} (${item.source})`,
        "CODE FIX under.",
        "Etter fiks skal sjekken forsvinne fra flow diagnostics."
      );
      if (key === "driver_inconsistent_delivery_flags") {
        lines.push("CODE FIX:");
        lines.push("Fil: app/api/superadmin/system/flow/diagnostics/route.ts");
        lines.push("Fjern: deliveries.id fra select-listen og all bruk av r.id som evidence/sample.");
        lines.push("Legg til: bruk orders.id som evidence for inkonsistente delivery-flagg (via order-join eller order_id).");
        lines.push("Tester: build:enterprise, typecheck, lint, sanity:live, og re-kjør flow diagnostics.");
        lines.push("Verifikasjon: Sjekk key=driver_inconsistent_delivery_flags forsvinner.");
        lines.push("");
      }
    });
  }

  if (noAction.length) {
    lines.push("NO-ACTION (info)");
    lines.push("Disse itemene mangler godkjent runbook/kodefiks. Ingen tiltak kjøres før avklaring.");
    noAction.forEach((item, idx) => {
      pushHeader(
        item,
        `${idx + 1}. ${item.type} (${item.source})`,
        "NO-ACTION: Krever godkjent runbook eller eksplisitt instruksjon.",
        "Ingen endring utført. Avklares før tiltak."
      );
    });
  }

  return lines.join("\n");
}

export async function GET(req: NextRequest): Promise<Response> {
  const s: any = await scopeOr401(req);
  if (!s?.ok) return denyResponse(s);

  const ctx = s.ctx;
  const deny = requireRoleOr403(ctx, "api.superadmin.system.codex-prompt.GET", ["superadmin"]);
  if (deny) return deny;

  const baseUrl = new URL(req.url);
  const origin = `${baseUrl.protocol}//${baseUrl.host}`;
  const cookie = req.headers.get("cookie") ?? "";
  const headers = cookie ? { cookie } : {};

  try {
    const [healthRes, incidentsRes, jobsRes, flowRes] = await Promise.all([
      fetch(`${origin}/api/superadmin/system/health`, { cache: "no-store", headers }),
      fetch(`${origin}/api/superadmin/system/incidents?status=open`, { cache: "no-store", headers }),
      fetch(`${origin}/api/superadmin/system/repairs/jobs`, { cache: "no-store", headers }),
      fetch(`${origin}/api/superadmin/system/flow/diagnostics`, { cache: "no-store", headers }),
    ]);

    const healthJson = (await healthRes.json().catch(() => null)) as HealthResp | null;
    const incidentsJson = (await incidentsRes.json().catch(() => null)) as IncidentsResp | null;
    const jobsJson = (await jobsRes.json().catch(() => null)) as RepairJobsResp | null;
    const flowJson = (await flowRes.json().catch(() => null)) as FlowDiagResp | null;

    const errors: string[] = [];

    if (!healthRes.ok || !healthJson || (healthJson as any).ok !== true) {
      const e = healthJson as HealthErr | null;
      errors.push(e?.message || e?.error || `HEALTH_HTTP_${healthRes.status}`);
    }

    if (!incidentsRes.ok || !incidentsJson || (incidentsJson as any).ok !== true) {
      const e = incidentsJson as IncidentsErr | null;
      errors.push(e?.message || e?.error || `INCIDENTS_HTTP_${incidentsRes.status}`);
    }

    if (!jobsRes.ok || !jobsJson || (jobsJson as any).ok !== true) {
      const e = jobsJson as RepairJobsErr | null;
      errors.push(e?.message || e?.error || `REPAIRS_HTTP_${jobsRes.status}`);
    }

    if (!flowRes.ok || !flowJson || (flowJson as any).ok !== true) {
      const e = flowJson as FlowDiagErr | null;
      errors.push(e?.message || e?.error || `FLOW_HTTP_${flowRes.status}`);
    }

    if (errors.length) {
      return jsonErr(ctx.rid, "Kunne ikke generere Codex-prompt.", 500, { code: "CODEX_PROMPT_FAILED", detail: errors });
    }

    const health = (healthJson as HealthOk).data ?? {
      status: "degraded",
      reasons: [],
      checks: { items: [] },
      ts: new Date().toISOString(),
    };

    const incidentItems = Array.isArray((incidentsJson as IncidentsOk).data?.items)
      ? (incidentsJson as IncidentsOk).data.items
      : [];
    const openIncidents = incidentItems.filter((i) => safeStr(i.status) === "open");

    const jobItems = Array.isArray((jobsJson as RepairJobsOk).data?.items)
      ? (jobsJson as RepairJobsOk).data.items
      : [];
    const repairJobs = jobItems.filter((j) => ["failed", "pending"].includes(safeStr(j.state)));

    const flowChecks = Array.isArray((flowJson as FlowDiagOk).data?.checks)
      ? (flowJson as FlowDiagOk).data.checks
      : [];
    const flowFailures = flowChecks.filter((c) => ["FAIL", "WARN"].includes(safeStr(c.status)));

    const rawItems: PromptItem[] = [];
    for (const inc of openIncidents) rawItems.push(incidentToItem(inc));
    for (const job of repairJobs) rawItems.push(repairJobToItem(job));
    for (const check of flowFailures) rawItems.push(flowCheckToItem(check));

    const deduped: PromptItemDeduped[] = [];
    const seen = new Map<string, PromptItemDeduped>();

    for (const item of rawItems) {
      const key = [
        safeStr(item.type),
        safeStr(item.scope_company_id),
        safeStr(item.scope_user_id),
        safeStr(item.scope_order_id),
        safeStr(item.check_key),
      ].join("|");

      const existing = seen.get(key);
      if (existing) {
        existing.count += 1;
        existing.evidence = { ...(existing.evidence ?? {}), count: existing.count };
        existing.sampleIds = mergeSampleIds(existing.sampleIds, item.sampleIds);
        continue;
      }

      const first: PromptItemDeduped = {
        ...item,
        count: 1,
        evidence: item.evidence ? { ...item.evidence, count: 1 } : { count: 1 },
        sampleIds: mergeSampleIds([], item.sampleIds),
      };
      seen.set(key, first);
      deduped.push(first);
    }

    const jobsByDedupeKey = new Map<string, RepairJob>();
    for (const job of repairJobs) {
      const payload = (job.payload ?? {}) as Record<string, any>;
      const dedupeKey = safeStr(payload?.dedupe_key);
      if (dedupeKey) jobsByDedupeKey.set(dedupeKey, job);
    }

    const classify = (item: PromptItemDeduped): PromptItemDeduped => {
      const key = normalizeKey(item.check_key || item.type);
      if (key === "employees_no_active_for_active_agreement") {
        item.promptType = "RUNBOOK";
        item.fix = "RUNBOOK REQUIRED: A) Legg til én aktiv ansatt via Firma-admin. B) Paus/deaktiver avtale via Superadmin.";
        return item;
      }

      if (key === "driver_inconsistent_delivery_flags") {
        item.promptType = "CODE FIX";
        item.fix = "Kodeendring: Fjern referanse til deliveries.id; bruk orders.id som evidence i flow-check.";
        return item;
      }

      const repairKey =
        safeStr((item.evidence as any)?.repair_key) ||
        safeStr((item.evidence as any)?.evidence?.repair_key) ||
        safeStr((item.evidence as any)?.dedupe_key) ||
        safeStr(item.check_key);

      const hasJob = repairKey ? jobsByDedupeKey.has(repairKey) : false;

      if (item.source === "repair_job" || hasJob) {
        item.promptType = "AUTO-REPAIR";
        item.fix = "AUTO-REPAIR: Kjør system motor for å fullføre eksisterende reparasjonsjobb.";
        if (hasJob) {
          const job = jobsByDedupeKey.get(repairKey);
          if (job) {
            item.evidence = trimEvidence({
              ...(item.evidence ?? {}),
              repair_job_id: job.id,
              repair_job_type: job.job_type,
              repair_job_state: job.state,
            });
            item.sampleIds = mergeSampleIds(item.sampleIds, extractSampleIds({ repair_job_id: job.id, ...item.evidence }));
          }
        }
        return item;
      }

      item.promptType = "RUNBOOK";
      item.fix = "RUNBOOK REQUIRED: Følg A/B alternativ med kontrollert dataretting eller eskalering til kodefiks.";
      return item;
    };

    for (const item of deduped) classify(item);

    const counts: PromptCounts = {
      itemsCount: deduped.length,
      openIncidentsCount: openIncidents.length,
      failedJobsCount: repairJobs.length,
      flowFailsCount: flowFailures.length,
    };

    const prompt = buildPrompt(counts, health, deduped);

    return jsonOk(
      ctx.rid,
      {
        ts: new Date().toISOString(),
        prompt,
        itemsCount: counts.itemsCount,
        openIncidentsCount: counts.openIncidentsCount,
        failedJobsCount: counts.failedJobsCount,
        flowFailsCount: counts.flowFailsCount,
      },
      200
    );
  } catch (e: any) {
    return jsonErr(ctx.rid, "Kunne ikke generere Codex-prompt.", 500, {
      code: "CODEX_PROMPT_FAILED",
      detail: { message: safeStr(e?.message ?? e) },
    });
  }
}
