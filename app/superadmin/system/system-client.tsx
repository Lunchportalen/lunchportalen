// app/superadmin/system/system-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

/* =========================================================
   Types: Common
========================================================= */
type ApiErr = { ok: false; error: string; message?: string; detail?: any };

function safeStr(v: any) {
  return String(v ?? "").trim();
}
function formatISO(iso?: string | null) {
  try {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
async function readJsonSafe<T = any>(res: Response): Promise<T | null> {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}
function apiErrorMessage(res: Response, json: any, fallback: string) {
  const server =
    (json?.message ? String(json.message) : "") || (json?.error ? String(json.error) : "") || "";
  const statusHint =
    res.status === 401
      ? "Ikke innlogget (401)."
      : res.status === 403
        ? "Ingen tilgang (403). Krever superadmin."
        : `HTTP ${res.status}.`;
  const detail =
    json?.detail !== undefined
      ? ` Detail: ${typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail)}`
      : "";
  return server ? `${fallback} ${statusHint} ${server}${detail}` : `${fallback} ${statusHint}${detail}`;
}
function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  const i = Math.trunc(n);
  return Math.max(min, Math.min(max, i));
}
function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

/* =========================================================
   Types: System settings
========================================================= */
type SystemToggles = {
  enforce_cutoff: boolean;
  require_active_agreement: boolean;
  employee_self_service: boolean;
  company_admin_can_order: boolean;
  strict_mode: boolean;
  esg_engine: boolean;
  email_backup: boolean;
};

type KillSwitch = {
  orders: boolean;
  cancellations: boolean;
  emails: boolean;
  kitchen_feed: boolean;
};

type Retention = {
  orders_months: number; // 1..60
  audit_years: number; // 1..15
};

type SystemSettings = {
  toggles: SystemToggles;
  killswitch: KillSwitch;
  retention: Retention;
  updated_at: string | null;
  updated_by: string | null;
};

type SystemOk = { ok: true; rid?: string; settings: SystemSettings };
type SystemResp = SystemOk | ApiErr;

/* =========================================================
   Types: Break-glass
========================================================= */
type BreakGlassPurpose = "DRIFT" | "SUPPORT" | "SECURITY" | "OFFBOARDING" | "LEGAL";

type BreakGlassSession = {
  id: string;
  purpose: BreakGlassPurpose | string;
  note: string | null;
  started_at: string;
  expires_at: string;
  ended_at: string | null;
};

type BgOk = { ok: true; rid?: string; active: BreakGlassSession | null; alreadyActive?: boolean; ended?: boolean };
type BgResp = BgOk | ApiErr;

function isBgActive(s: BreakGlassSession | null) {
  if (!s) return false;
  if (s.ended_at) return false;
  return new Date(s.expires_at).getTime() > Date.now();
}

/* =========================================================
   Types: Recent actions (audit_meta_events)
========================================================= */
type MetaEvent = {
  id: string;
  created_at: string;
  actor_email: string | null;
  action: string;
  purpose: string | null;
  entity_type: string | null;
  entity_id: string | null;
  rid: string | null;
  detail: any | null;
};

type RecentOk = { ok: true; rid?: string; items: MetaEvent[] };
type RecentResp = RecentOk | ApiErr;

/* =========================================================
   Types: Companies / Purge
========================================================= */
type ListRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: "pending" | "active" | "paused" | "closed" | "PENDING" | "ACTIVE" | "PAUSED" | "CLOSED";
  updated_at?: string | null;
};

type CompaniesListOk = { ok: true; items: ListRow[]; nextCursor: string | null; rid?: string };
type CompaniesListResp = CompaniesListOk | ApiErr;

type PurgeOk = {
  ok: true;
  rid?: string;
  purged?: { id: string; name?: string | null; orgnr?: string | null };
  report?: Record<string, number>;
  audit?: any;
};

/* =========================================================
   Enterprise: Plan / Preview
========================================================= */
type PlanItem = {
  id: string;
  area: "TOGGLE" | "KILL" | "RETENTION";
  key: string;
  from: string;
  to: string;
  severity: "normal" | "warn" | "danger";
};

function yn(v: any) {
  return v ? "ON" : "OFF";
}
function buildPlan(prev: SystemSettings | null, next: SystemSettings | null): PlanItem[] {
  if (!prev || !next) return [];
  const out: PlanItem[] = [];

  // toggles
  (Object.keys(prev.toggles) as (keyof SystemToggles)[]).forEach((k) => {
    const a = prev.toggles[k];
    const b = next.toggles[k];
    if (a === b) return;
    out.push({
      id: `toggle:${String(k)}`,
      area: "TOGGLE",
      key: String(k),
      from: yn(a),
      to: yn(b),
      severity: k === "strict_mode" ? "warn" : "normal",
    });
  });

  // killswitch
  (Object.keys(prev.killswitch) as (keyof KillSwitch)[]).forEach((k) => {
    const a = prev.killswitch[k];
    const b = next.killswitch[k];
    if (a === b) return;
    const sev: PlanItem["severity"] =
      k === "orders" || k === "cancellations" ? "danger" : "warn";
    out.push({
      id: `kill:${String(k)}`,
      area: "KILL",
      key: String(k),
      from: yn(a),
      to: yn(b),
      severity: sev,
    });
  });

  // retention
  (Object.keys(prev.retention) as (keyof Retention)[]).forEach((k) => {
    const a = prev.retention[k];
    const b = next.retention[k];
    if (a === b) return;
    out.push({
      id: `ret:${String(k)}`,
      area: "RETENTION",
      key: String(k),
      from: String(a),
      to: String(b),
      severity: "warn",
    });
  });

  // sort: danger → warn → normal
  const rank = (s: PlanItem["severity"]) => (s === "danger" ? 0 : s === "warn" ? 1 : 2);
  out.sort((x, y) => rank(x.severity) - rank(y.severity) || x.area.localeCompare(y.area));
  return out;
}

function humanKey(k: string) {
  const map: Record<string, string> = {
    enforce_cutoff: "Håndhev cut-off (08:00)",
    require_active_agreement: "Krev aktiv avtale",
    employee_self_service: "Ansatt-selvbetjening",
    company_admin_can_order: "Company admin kan bestille",
    strict_mode: "Strict mode",
    esg_engine: "ESG-motor",
    email_backup: "E-post backup av ordre",

    orders: "Blokker bestillinger",
    cancellations: "Blokker avbestillinger",
    emails: "Blokker e-post",
    kitchen_feed: "Blokker kjøkken-feed",

    orders_months: "Retention: ordre (mnd)",
    audit_years: "Retention: audit (år)",
  };
  return map[k] ?? k;
}

/* =========================================================
   UI primitives
========================================================= */
function Chip(props: { label: string; tone?: "neutral" | "good" | "warn" | "bad"; mono?: boolean }) {
  const tone = props.tone ?? "neutral";
  const cls =
    tone === "good"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : tone === "warn"
        ? "bg-yellow-50 text-yellow-900 ring-yellow-200"
        : tone === "bad"
          ? "bg-rose-50 text-rose-900 ring-rose-200"
          : "bg-white text-neutral-900 ring-[rgb(var(--lp-border))]";
  return (
    <span
      className={[
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-extrabold ring-1",
        cls,
        props.mono ? "font-mono" : "",
      ].join(" ")}
    >
      {props.label}
    </span>
  );
}

function TabButton(props: { active: boolean; label: string; onClick: () => void; hint?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={[
        "rounded-xl px-3 py-2 text-xs font-extrabold ring-1 transition",
        props.active
          ? "bg-neutral-900 text-white ring-neutral-900"
          : "bg-white text-neutral-900 ring-[rgb(var(--lp-border))] hover:bg-neutral-50",
      ].join(" ")}
      title={props.hint}
    >
      {props.label}
    </button>
  );
}

function ToggleRow(props: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const disabled = !!props.disabled;
  return (
    <label
      className={[
        "flex items-start gap-3 rounded-2xl p-3 ring-1 transition",
        props.danger
          ? "bg-rose-50 ring-rose-200 hover:bg-rose-50/80"
          : "bg-white ring-[rgb(var(--lp-border))] hover:bg-neutral-50",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className="mt-1 h-5 w-5"
        checked={props.checked}
        disabled={disabled}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span className="flex-1">
        <span className="block text-sm font-extrabold text-neutral-950">{props.title}</span>
        <span className="mt-0.5 block text-xs font-semibold text-[rgb(var(--lp-muted))]">{props.desc}</span>
      </span>
    </label>
  );
}

function SectionTitle(props: { overline: string; title: string; desc?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        <div className="text-xs font-extrabold tracking-wide text-neutral-600">{props.overline}</div>
        <div className="mt-1 text-lg font-black tracking-tight text-neutral-950">{props.title}</div>
        {props.desc ? <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">{props.desc}</div> : null}
      </div>
      {props.right ? <div className="flex flex-wrap items-center gap-2">{props.right}</div> : null}
    </div>
  );
}

function EmptyState(props: { title: string; desc?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-sm font-black text-neutral-950">{props.title}</div>
      {props.desc ? <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">{props.desc}</div> : null}
    </div>
  );
}

function EventRow({ e }: { e: MetaEvent }) {
  const tone: "neutral" | "good" | "warn" | "bad" =
    e.action.includes("FAIL") || e.action.includes("ERROR")
      ? "bad"
      : e.action.includes("KILL") || e.action.includes("PURGE")
        ? "warn"
        : e.action.includes("BREAK_GLASS")
          ? "warn"
          : "neutral";

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Chip label={e.action} tone={tone} mono />
          {e.purpose ? <Chip label={`PURPOSE: ${e.purpose}`} tone="neutral" mono /> : null}
        </div>
        <div className="text-xs font-semibold text-neutral-600">{formatISO(e.created_at)}</div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[rgb(var(--lp-muted))]">
        <span>{e.actor_email ?? "—"}</span>
        <span>·</span>
        <span>{e.entity_type ?? "—"}</span>
        <span>·</span>
        <span className="font-mono">{e.entity_id ?? "—"}</span>
        {e.rid ? (
          <>
            <span>·</span>
            <span className="font-mono">rid:{e.rid}</span>
          </>
        ) : null}
      </div>
      {e.detail ? (
        <details className="rounded-xl bg-neutral-50 p-2 ring-1 ring-neutral-200">
          <summary className="cursor-pointer text-xs font-extrabold text-neutral-700">Detail</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[11px] font-mono text-neutral-700">
            {typeof e.detail === "string" ? e.detail : JSON.stringify(e.detail, null, 2)}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

/* =========================================================
   Main
========================================================= */
const PAGE_LIMIT = 50;
type TabKey = "overview" | "controls" | "simulation" | "forensics";

export default function SystemClient() {
  const [tab, setTab] = useState<TabKey>("overview");

  /* -------------------------
     Toast
  ------------------------- */
  const [toast, setToast] = useState<{ type: "ok" | "error"; msg: string } | null>(null);
  function toastOk(msg: string) {
    setToast({ type: "ok", msg });
    window.setTimeout(() => setToast(null), 3000);
  }
  function toastErr(msg: string) {
    setToast({ type: "error", msg });
    window.setTimeout(() => setToast(null), 5200);
  }

  /* -------------------------
     System settings
  ------------------------- */
  const [sysLoading, setSysLoading] = useState(false);
  const [sysErr, setSysErr] = useState<string | null>(null);
  const [sys, setSys] = useState<SystemSettings | null>(null);
  const [sysDraft, setSysDraft] = useState<SystemSettings | null>(null);
  const [isSavingSettings, startSavingSettings] = useTransition();

  // Enterprise: Read-only default, explicit unlock
  const [editMode, setEditMode] = useState(false);

  const sysDirty = useMemo(() => {
    if (!sys || !sysDraft) return false;
    return JSON.stringify(sys) !== JSON.stringify(sysDraft);
  }, [sys, sysDraft]);

  const plan = useMemo(() => buildPlan(sys, sysDraft), [sys, sysDraft]);
  const planDangerCount = useMemo(() => plan.filter((p) => p.severity === "danger").length, [plan]);
  const planWarnCount = useMemo(() => plan.filter((p) => p.severity === "warn").length, [plan]);

  async function loadSystemSettings() {
    setSysLoading(true);
    setSysErr(null);
    try {
      const res = await fetch("/api/superadmin/system", { cache: "no-store" });
      const json = await readJsonSafe<SystemResp>(res);
      if (!res.ok || !json || (json as any).ok !== true) {
        setSysErr(apiErrorMessage(res, json, "Kunne ikke hente systeminnstillinger."));
        setSysLoading(false);
        return;
      }
      const ok = json as SystemOk;
      setSys(ok.settings);
      setSysDraft(ok.settings);
      setSysLoading(false);
    } catch (e: any) {
      setSysErr(`Kunne ikke hente systeminnstillinger. ${safeStr(e?.message) || ""}`.trim());
      setSysLoading(false);
    }
  }

  function setToggle<K extends keyof SystemToggles>(k: K, v: boolean) {
    if (!sysDraft) return;
    setSysDraft({ ...sysDraft, toggles: { ...sysDraft.toggles, [k]: v } });
  }
  function setKill<K extends keyof KillSwitch>(k: K, v: boolean) {
    if (!sysDraft) return;
    setSysDraft({ ...sysDraft, killswitch: { ...sysDraft.killswitch, [k]: v } });
  }
  function setRetention<K extends keyof Retention>(k: K, v: number) {
    if (!sysDraft) return;
    const next = { ...sysDraft, retention: { ...sysDraft.retention } };
    if (k === "orders_months") next.retention.orders_months = clampInt(Number(v), 1, 60);
    if (k === "audit_years") next.retention.audit_years = clampInt(Number(v), 1, 15);
    setSysDraft(next);
  }

  function discardChanges() {
    if (!sys) return;
    setSysDraft(sys);
    toastOk("Endringer forkastet.");
  }

  function lockControls() {
    if (sysDirty) {
      const ok = window.confirm("Du har ulagrede endringer. Vil du låse kontrollene og forkaste endringene?");
      if (!ok) return;
      discardChanges();
    }
    setEditMode(false);
  }

  function unlockControls() {
    setEditMode(true);
    toastOk("Kontroller låst opp (Edit mode).");
  }

  async function saveSystemSettings() {
    if (!sysDraft) return;

    // send only the mutable parts
    const payload = {
      toggles: sysDraft.toggles,
      killswitch: sysDraft.killswitch,
      retention: sysDraft.retention,
    };

    startSavingSettings(async () => {
      setSysErr(null);
      try {
        const res = await fetch("/api/superadmin/system", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(payload),
        });
        const json = await readJsonSafe<SystemResp>(res);
        if (!res.ok || !json || (json as any).ok !== true) {
          toastErr(apiErrorMessage(res, json, "Kunne ikke lagre systeminnstillinger."));
          return;
        }
        const ok = json as SystemOk;
        setSys(ok.settings);
        setSysDraft(ok.settings);
        toastOk("Systeminnstillinger lagret.");
        setEditMode(false);
        loadRecent().catch(() => {});
      } catch (e: any) {
        toastErr(`Kunne ikke lagre systeminnstillinger. ${safeStr(e?.message) || ""}`.trim());
      }
    });
  }

  /* -------------------------
     Settings preview modal
  ------------------------- */
  const [settingsPreviewOpen, setSettingsPreviewOpen] = useState(false);
  const [applyAcknowledge, setApplyAcknowledge] = useState(false);

  function openSettingsPreview() {
    setApplyAcknowledge(false);
    setSettingsPreviewOpen(true);
  }

  function canApply() {
    if (!editMode) return false;
    if (!sysDraft || !sysDirty) return false;
    // if we have danger items, require ack
    if (planDangerCount > 0 && !applyAcknowledge) return false;
    return true;
  }

  /* -------------------------
     Break-glass
  ------------------------- */
  const [bgLoading, setBgLoading] = useState(false);
  const [bgErr, setBgErr] = useState<string | null>(null);
  const [bg, setBg] = useState<BreakGlassSession | null>(null);
  const [bgPurpose, setBgPurpose] = useState<BreakGlassPurpose>("DRIFT");
  const [bgNote, setBgNote] = useState("");
  const [bgTick, setBgTick] = useState(0);

  async function loadBreakGlass() {
    setBgLoading(true);
    setBgErr(null);
    try {
      const res = await fetch("/api/superadmin/break-glass", { cache: "no-store" });
      const json = await readJsonSafe<BgResp>(res);
      if (!res.ok || !json || (json as any).ok !== true) {
        setBgErr(apiErrorMessage(res, json, "Kunne ikke hente break-glass status."));
        setBgLoading(false);
        return;
      }
      setBg((json as BgOk).active ?? null);
      setBgLoading(false);
    } catch (e: any) {
      setBgErr(`Kunne ikke hente break-glass status. ${safeStr(e?.message) || ""}`.trim());
      setBgLoading(false);
    }
  }

  async function startBreakGlass() {
    setBgErr(null);
    setBgLoading(true);
    try {
      const res = await fetch("/api/superadmin/break-glass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ purpose: bgPurpose, note: bgNote.trim() || null }),
      });
      const json = await readJsonSafe<BgResp>(res);
      if (!res.ok || !json || (json as any).ok !== true) {
        toastErr(apiErrorMessage(res, json, "Kunne ikke starte break-glass."));
        setBgLoading(false);
        return;
      }
      setBg((json as BgOk).active ?? null);
      toastOk("Root-modus aktivert (15 min).");
      setBgLoading(false);
      loadRecent().catch(() => {});
    } catch (e: any) {
      toastErr(`Kunne ikke starte break-glass. ${safeStr(e?.message) || ""}`.trim());
      setBgLoading(false);
    }
  }

  async function endBreakGlass() {
    setBgErr(null);
    setBgLoading(true);
    try {
      const res = await fetch("/api/superadmin/break-glass", { method: "DELETE", cache: "no-store" });
      const json = await readJsonSafe<BgResp>(res);
      if (!res.ok || !json || (json as any).ok !== true) {
        toastErr(apiErrorMessage(res, json, "Kunne ikke avslutte break-glass."));
        setBgLoading(false);
        return;
      }
      setBg(null);
      toastOk("Root-modus avsluttet.");
      setBgLoading(false);
      loadRecent().catch(() => {});
    } catch (e: any) {
      toastErr(`Kunne ikke avslutte break-glass. ${safeStr(e?.message) || ""}`.trim());
      setBgLoading(false);
    }
  }

  const rootActive = isBgActive(bg);

  // countdown tick (eslint-safe)
  const rootRemainingMs = useMemo(() => {
    if (!rootActive || !bg?.expires_at) return 0;
    void bgTick;
    return new Date(bg.expires_at).getTime() - Date.now();
  }, [rootActive, bg?.expires_at, bgTick]);

  useEffect(() => {
    if (!rootActive) return;
    const t = window.setInterval(() => setBgTick((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [rootActive]);

  /* -------------------------
     Recent critical actions feed
  ------------------------- */
  const [recentLoading, setRecentLoading] = useState(false);
  const [recentErr, setRecentErr] = useState<string | null>(null);
  const [recent, setRecent] = useState<MetaEvent[]>([]);

  async function loadRecent() {
    setRecentLoading(true);
    setRecentErr(null);
    try {
      const res = await fetch("/api/superadmin/audit-meta/recent?limit=10", { cache: "no-store" });
      const json = await readJsonSafe<RecentResp>(res);
      if (!res.ok || !json || (json as any).ok !== true) {
        setRecentErr(apiErrorMessage(res, json, "Kunne ikke hente recent actions."));
        setRecentLoading(false);
        return;
      }
      setRecent((json as RecentOk).items ?? []);
      setRecentLoading(false);
    } catch (e: any) {
      setRecentErr(`Kunne ikke hente recent actions. ${safeStr(e?.message) || ""}`.trim());
      setRecentLoading(false);
    }
  }

  /* -------------------------
     Companies list (for purge only)
  ------------------------- */
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const [items, setItems] = useState<ListRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [companiesErr, setCompaniesErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<ListRow | null>(null);

  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  async function loadFirstCompanies() {
    const reqId = ++reqIdRef.current;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoadingCompanies(true);
    setCompaniesErr(null);
    setItems([]);
    setCursor(null);

    const usp = new URLSearchParams();
    const qq = qDebounced.trim();
    if (qq) usp.set("q", qq);
    usp.set("limit", String(PAGE_LIMIT));

    try {
      const res = await fetch(`/api/superadmin/companies?${usp.toString()}`, { cache: "no-store", signal: ctrl.signal });
      const json = await readJsonSafe<CompaniesListResp>(res);
      if (reqId !== reqIdRef.current) return;

      if (!res.ok || !json || (json as any).ok !== true) {
        setCompaniesErr(apiErrorMessage(res, json, "Kunne ikke hente firmaliste."));
        setLoadingCompanies(false);
        return;
      }

      const ok = json as CompaniesListOk;
      setItems(ok.items || []);
      setCursor(ok.nextCursor ?? null);
      setLoadingCompanies(false);
    } catch (e: any) {
      if (reqId !== reqIdRef.current) return;
      if (e?.name === "AbortError") return;
      setCompaniesErr(`Kunne ikke hente firmaliste. ${safeStr(e?.message) || ""}`.trim());
      setLoadingCompanies(false);
    }
  }

  async function loadMoreCompanies() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    setCompaniesErr(null);

    const usp = new URLSearchParams();
    const qq = qDebounced.trim();
    if (qq) usp.set("q", qq);
    usp.set("limit", String(PAGE_LIMIT));
    usp.set("cursor", cursor);

    try {
      const res = await fetch(`/api/superadmin/companies?${usp.toString()}`, { cache: "no-store" });
      const json = await readJsonSafe<CompaniesListResp>(res);

      if (!res.ok || !json || (json as any).ok !== true) {
        setCompaniesErr(apiErrorMessage(res, json, "Kunne ikke hente flere firma."));
        setLoadingMore(false);
        return;
      }

      const ok = json as CompaniesListOk;
      const incoming = ok.items || [];
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        const add = incoming.filter((x) => !seen.has(x.id));
        return prev.concat(add);
      });
      setCursor(ok.nextCursor ?? null);
      setLoadingMore(false);
    } catch (e: any) {
      setCompaniesErr(`Kunne ikke hente flere firma. ${safeStr(e?.message) || ""}`.trim());
      setLoadingMore(false);
    }
  }

  /* -------------------------
     Purge
  ------------------------- */
  const [confirmWord, setConfirmWord] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [reason, setReason] = useState("");

  const [purgePreviewOpen, setPurgePreviewOpen] = useState(false);
  const [purgePreviewLoading, setPurgePreviewLoading] = useState(false);
  const [purgePreviewErr, setPurgePreviewErr] = useState<string | null>(null);
  const [purgePreview, setPurgePreview] = useState<any | null>(null);

  const [dangerOpen, setDangerOpen] = useState(false);
  const [dangerAcknowledge, setDangerAcknowledge] = useState(false);

  const [isPendingPurge, startTransitionPurge] = useTransition();

  const canPurge = useMemo(() => {
    if (!selected) return false;
    if (confirmWord.trim().toUpperCase() !== "PURGE") return false;
    if (confirmId.trim() !== selected.id) return false;
    if (reason.trim().length < 8) return false;
    return true;
  }, [selected, confirmWord, confirmId, reason]);

  const purgeAllowed = rootActive && dangerOpen && dangerAcknowledge && canPurge;

  function resetDangerForm() {
    setConfirmWord("");
    setConfirmId("");
    setReason("");
    setPurgePreviewOpen(false);
    setPurgePreview(null);
    setPurgePreviewErr(null);
  }

  async function loadPurgePreview(companyId: string) {
    setPurgePreviewOpen(true);
    setPurgePreviewLoading(true);
    setPurgePreviewErr(null);
    setPurgePreview(null);

    try {
      const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}/purge?dryRun=1`, {
        cache: "no-store",
      });
      const json = await readJsonSafe<any>(res);

      if (!res.ok || !json?.ok) {
        setPurgePreviewErr(apiErrorMessage(res, json, "Kunne ikke hente dry-run rapport."));
        setPurgePreviewLoading(false);
        return;
      }

      setPurgePreview(json);
      setPurgePreviewLoading(false);
    } catch (e: any) {
      setPurgePreviewErr(`Kunne ikke hente dry-run rapport. ${safeStr(e?.message) || ""}`.trim());
      setPurgePreviewLoading(false);
    }
  }

  async function doPurge() {
    if (!selected || !purgeAllowed) return;

    startTransitionPurge(async () => {
      setToast(null);

      try {
        const res = await fetch(`/api/superadmin/companies/${encodeURIComponent(selected.id)}/purge`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ confirm: true, reason: reason.trim() }),
        });

        const json = await readJsonSafe<PurgeOk | ApiErr>(res);

        if (!res.ok || !json || (json as any).ok !== true) {
          toastErr(apiErrorMessage(res, json, "PURGE feilet."));
          return;
        }

        toastOk(`Purge fullført: ${selected.name}`);

        setSelected(null);
        resetDangerForm();
        setDangerOpen(false);
        setDangerAcknowledge(false);

        loadRecent().catch(() => {});
      } catch (e: any) {
        toastErr(`PURGE feilet. ${safeStr(e?.message) || ""}`.trim());
      }
    });
  }

  /* =========================================================
     Derived: system state + chips
  ========================================================= */
  const kills = sysDraft?.killswitch ?? null;
  const killsActiveCount = useMemo(() => {
    if (!kills) return 0;
    return [kills.orders, kills.cancellations, kills.emails, kills.kitchen_feed].filter(Boolean).length;
  }, [kills]);

  const systemState = useMemo<"NORMAL" | "DEGRADED" | "EMERGENCY">(() => {
    if (!kills) return "NORMAL";
    if (kills.orders || kills.cancellations) return "EMERGENCY";
    if (killsActiveCount > 0) return "DEGRADED";
    return "NORMAL";
  }, [kills, killsActiveCount]);

  const stateTone: "good" | "warn" | "bad" =
    systemState === "NORMAL" ? "good" : systemState === "DEGRADED" ? "warn" : "bad";

  const lastEvent = recent?.[0] ?? null;

  /* =========================================================
     Global refresh
  ========================================================= */
  async function refreshAll() {
    await Promise.allSettled([loadSystemSettings(), loadBreakGlass(), loadRecent()]);
  }

  /* =========================================================
     Initial load
  ========================================================= */
  useEffect(() => {
    refreshAll().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================================================
     When danger opens: load companies
  ========================================================= */
  useEffect(() => {
    if (!dangerOpen) return;
    loadFirstCompanies().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dangerOpen, qDebounced]);

  const controlsDisabled = !editMode || sysLoading || isSavingSettings;

  /* =========================================================
     Render
  ========================================================= */
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-5 md:pt-6">
      {/* Header row */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-extrabold tracking-wide text-neutral-600">SUPERADMIN • CONTROL ROOM</div>
          <div className="mt-1 text-xl md:text-2xl font-black tracking-tight text-neutral-950">System Control</div>
          <div className="mt-1 text-sm font-semibold text-[rgb(var(--lp-muted))]">
            Situational awareness → policy controls → simulation → forensics.
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <Link
            href="/superadmin"
            className="w-full md:w-auto rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
          >
            Tilbake
          </Link>
          <Link
            href="/superadmin/audit"
            className="w-full md:w-auto rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
          >
            Audit
          </Link>
          <button
            type="button"
            onClick={() => refreshAll()}
            className="w-full md:w-auto rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-neutral-800"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          aria-live="polite"
          className={[
            "mt-4 rounded-xl px-4 py-3 text-sm font-semibold ring-1",
            toast.type === "ok"
              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
              : "bg-rose-50 text-rose-900 ring-rose-200",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      {/* =====================================================
          STICKY CONTROL BAR
      ====================================================== */}
      <div className="sticky top-2 z-30 mt-5">
        <div
          className={[
            "rounded-3xl bg-white/90 backdrop-blur ring-1 px-3 py-2 md:px-4 md:py-3",
            rootActive ? "ring-rose-200" : "ring-[rgb(var(--lp-border))]",
          ].join(" ")}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* chips: mobile scroll, desktop wrap */}
            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible md:pb-0">
              <div className="flex min-w-max flex-wrap items-center gap-2 md:min-w-0">
                <Chip label={`STATE: ${systemState}`} tone={stateTone} />
                <Chip
                  label={rootActive ? `ROOT: ACTIVE (${msToClock(rootRemainingMs)})` : "ROOT: OFF"}
                  tone={rootActive ? "bad" : "neutral"}
                />
                <Chip label={`KILL: ${killsActiveCount} active`} tone={killsActiveCount ? "warn" : "good"} />
                {sysDraft ? (
                  <Chip label={`RETENTION: ${sysDraft.retention.orders_months}m / ${sysDraft.retention.audit_years}y`} tone="neutral" mono />
                ) : (
                  <Chip label="RETENTION: —" tone="neutral" mono />
                )}
                <Chip label={editMode ? "MODE: EDIT" : "MODE: READ"} tone={editMode ? "warn" : "neutral"} />
                {sysDirty ? <Chip label="UNSAVED CHANGES" tone="warn" /> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TabButton active={tab === "overview"} label="Overview" onClick={() => setTab("overview")} />
              <TabButton active={tab === "controls"} label="Controls" onClick={() => setTab("controls")} />
              <TabButton active={tab === "simulation"} label="Simulation" onClick={() => setTab("simulation")} />
              <TabButton active={tab === "forensics"} label="Forensics" onClick={() => setTab("forensics")} />
            </div>
          </div>

          {/* Root mode banner */}
          {rootActive ? (
            <div className="mt-3 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-200">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-extrabold tracking-wide text-rose-800">ROOT MODE ACTIVE</div>
                  <div className="mt-0.5 text-xs font-semibold text-rose-900">
                    Purpose: <span className="font-extrabold">{String(bg?.purpose ?? "—")}</span>
                    {" · "}Expires in <span className="font-extrabold">{msToClock(rootRemainingMs)}</span>
                  </div>
                  {bg?.note ? (
                    <div className="mt-1 text-[11px] font-semibold text-rose-900">
                      Note: <span className="font-extrabold">{bg.note}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => endBreakGlass()}
                    disabled={bgLoading}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    End now
                  </button>
                  <button
                    type="button"
                    onClick={() => loadBreakGlass()}
                    disabled={bgLoading}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50 disabled:opacity-60"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Last critical change */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">
            <div>
              Last critical change:{" "}
              <span className="font-extrabold text-neutral-900">
                {lastEvent ? `${lastEvent.action} · ${formatISO(lastEvent.created_at)}` : "—"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-neutral-600">Cache: no-store • Runtime: nodejs</span>
            </div>
          </div>
        </div>
      </div>

      {/* =====================================================
          TAB: OVERVIEW
      ====================================================== */}
      {tab === "overview" && (
        <div className="mt-5 space-y-4">
          <div className="rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))] p-4">
            <SectionTitle
              overline="OVERVIEW"
              title="Situational awareness"
              desc="Dette er operatør-utsikten: hva som er sant akkurat nå, og hva som krever handling."
              right={
                <>
                  <button
                    type="button"
                    onClick={() => setTab("controls")}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                  >
                    Go to Controls
                  </button>
                  {!editMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setTab("controls");
                        unlockControls();
                      }}
                      className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-neutral-800"
                      title="Kontroller låses opp under Controls"
                    >
                      Unlock Controls
                    </button>
                  ) : null}
                </>
              }
            />

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">SYSTEM</div>
                <div className="mt-1 text-xl font-black text-neutral-950">{systemState}</div>
                <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
                  {systemState === "NORMAL"
                    ? "All systems green."
                    : systemState === "DEGRADED"
                      ? "Degraded: non-critical emergency toggles active."
                      : "Emergency: ordering/cancellation blocked."}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">CONTROL MODE</div>
                <div className="mt-1 text-xl font-black text-neutral-950">{editMode ? "EDIT" : "READ"}</div>
                <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
                  {editMode ? "Changes enabled." : "Read-only by default."}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">KILL SWITCHES</div>
                <div className="mt-1 text-xl font-black text-neutral-950">{killsActiveCount}</div>
                <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
                  {killsActiveCount ? "Emergency controls are active." : "None active."}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">INTEGRITY</div>
                <div className="mt-1 text-xl font-black text-neutral-950">PASS</div>
                <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
                  UI placeholder (kobles til integrity checks senere).
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs font-extrabold tracking-wide text-neutral-600">SIGNALS</div>
                <div className="mt-2 space-y-2 text-sm font-semibold text-neutral-900">
                  {killsActiveCount ? (
                    <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
                      <div className="text-xs font-extrabold text-rose-800">Emergency controls active</div>
                      <div className="mt-1 text-xs font-semibold text-rose-900">
                        Systemet kjører i “safe state”. Dette er synlig og sporbar drift.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl bg-emerald-50 p-3 ring-1 ring-emerald-200">
                      <div className="text-xs font-extrabold text-emerald-800">No active incidents</div>
                      <div className="mt-1 text-xs font-semibold text-emerald-900">
                        Normal drift uten emergency toggles.
                      </div>
                    </div>
                  )}

                  {!rootActive ? (
                    <div className="rounded-xl bg-yellow-50 p-3 ring-1 ring-yellow-200">
                      <div className="text-xs font-extrabold text-yellow-800">Root mode is OFF</div>
                      <div className="mt-1 text-xs font-semibold text-yellow-900">Irreversible actions krever break-glass.</div>
                    </div>
                  ) : null}

                  {sysDirty ? (
                    <div className="rounded-xl bg-yellow-50 p-3 ring-1 ring-yellow-200">
                      <div className="text-xs font-extrabold text-yellow-800">Unsaved changes</div>
                      <div className="mt-1 text-xs font-semibold text-yellow-900">
                        Du har endringer som ikke er lagret. Bruk Preview → Apply.
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-extrabold tracking-wide text-neutral-600">RECENT CRITICAL ACTIONS</div>
                    <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">De siste hendelsene som betyr noe.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => loadRecent()}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                  >
                    Refresh
                  </button>
                </div>

                {recentErr ? (
                  <div className="mt-3 text-sm font-semibold text-rose-700">{recentErr}</div>
                ) : recentLoading ? (
                  <div className="mt-3 text-sm font-semibold text-neutral-700">Laster…</div>
                ) : recent.length === 0 ? (
                  <div className="mt-3 text-sm font-semibold text-neutral-700">Ingen hendelser.</div>
                ) : (
                  <div className="mt-3 space-y-2">
                    {recent.slice(0, 5).map((e) => (
                      <div key={e.id} className="rounded-xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-extrabold text-neutral-900">{e.action}</div>
                          <div className="text-[11px] font-semibold text-neutral-600">{formatISO(e.created_at)}</div>
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-[rgb(var(--lp-muted))]">
                          {e.actor_email ?? "—"} {e.purpose ? `· purpose: ${e.purpose}` : ""} {e.rid ? `· rid:${e.rid}` : ""}
                        </div>
                      </div>
                    ))}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setTab("forensics")}
                        className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-neutral-800"
                      >
                        Open Forensics
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))] p-4">
            <SectionTitle
              overline="IRREVERSIBLE"
              title="Danger zone is intentionally hidden"
              desc="Enterprise handler om å gjøre feil vanskelig, men handling mulig."
              right={
                <button
                  type="button"
                  onClick={() => {
                    setTab("controls");
                    setDangerOpen(true);
                    setDangerAcknowledge(false);
                  }}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                >
                  Open Danger Zone
                </button>
              }
            />
          </div>
        </div>
      )}

      {/* =====================================================
          TAB: CONTROLS
      ====================================================== */}
      {tab === "controls" && (
        <div className="mt-5 space-y-4">
          {/* Controls: System settings */}
          <div className="rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))] p-4">
            <SectionTitle
              overline="CONTROLS"
              title="Platform policy controls"
              desc="Read-only som standard. Lås opp bevisst → Preview → Apply."
              right={
                <>
                  {sysDirty ? <Chip label="UNSAVED" tone="warn" /> : null}
                  {planDangerCount ? <Chip label={`DANGER: ${planDangerCount}`} tone="bad" /> : null}
                  {planWarnCount ? <Chip label={`WARN: ${planWarnCount}`} tone="warn" /> : null}

                  <button
                    type="button"
                    onClick={() => loadSystemSettings()}
                    disabled={sysLoading || isSavingSettings}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50 disabled:opacity-60"
                  >
                    {sysLoading ? "Laster…" : "Reload"}
                  </button>

                  {!editMode ? (
                    <button
                      type="button"
                      onClick={() => unlockControls()}
                      className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-neutral-800"
                    >
                      Unlock controls
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => lockControls()}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                      >
                        Lock
                      </button>
                      <button
                        type="button"
                        onClick={() => discardChanges()}
                        disabled={!sysDirty}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50 disabled:opacity-60"
                      >
                        Discard
                      </button>
                      <button
                        type="button"
                        onClick={() => openSettingsPreview()}
                        disabled={!sysDirty}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50 disabled:opacity-60"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => saveSystemSettings()}
                        disabled={!canApply() || isSavingSettings}
                        className={[
                          "rounded-xl px-4 py-2 text-xs font-extrabold ring-1 transition",
                          !canApply() || isSavingSettings
                            ? "bg-neutral-200 text-neutral-700 ring-neutral-200"
                            : "bg-neutral-900 text-white ring-neutral-900 hover:bg-neutral-800",
                        ].join(" ")}
                      >
                        {isSavingSettings ? "Applying…" : "Apply"}
                      </button>
                    </>
                  )}
                </>
              }
            />

            {sysErr ? <div className="mt-3 text-sm font-semibold text-rose-700">{sysErr}</div> : null}
            {!sysDraft ? (
              <div className="mt-3 text-sm font-semibold text-neutral-700">Laster systeminnstillinger…</div>
            ) : (
              <>
                {/* Mode banner */}
                <div className={["mt-4 rounded-2xl p-3 ring-1", editMode ? "bg-yellow-50 ring-yellow-200" : "bg-neutral-50 ring-neutral-200"].join(" ")}>
                  <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-xs font-extrabold tracking-wide text-neutral-700">
                        {editMode ? "EDIT MODE" : "READ MODE"}
                      </div>
                      <div className="mt-0.5 text-xs font-semibold text-neutral-700">
                        {editMode
                          ? "Endringer er aktivert. Bruk Preview → Apply for å gjøre endringer sporbare."
                          : "Kontroller er låst. Dette reduserer risiko for uhell."}
                      </div>
                    </div>
                    {editMode && sysDirty ? (
                      <div className="mt-2 md:mt-0 flex flex-wrap items-center gap-2">
                        <Chip label={`${plan.length} changes`} tone={planDangerCount ? "bad" : planWarnCount ? "warn" : "neutral"} />
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <ToggleRow
                    title="Håndhev cut-off (08:00)"
                    desc="Stopper bestilling/avbestilling etter cut-off når aktiv."
                    checked={sysDraft.toggles.enforce_cutoff}
                    disabled={controlsDisabled}
                    onChange={(v) => setToggle("enforce_cutoff", v)}
                  />
                  <ToggleRow
                    title="Krev aktiv avtale"
                    desc="Hvis aktiv: ingen bestilling uten avtale."
                    checked={sysDraft.toggles.require_active_agreement}
                    disabled={controlsDisabled}
                    onChange={(v) => setToggle("require_active_agreement", v)}
                  />
                  <ToggleRow
                    title="Ansatt-selvbetjening"
                    desc="Hvis aktiv: ansatte kan bestille/avbestille selv."
                    checked={sysDraft.toggles.employee_self_service}
                    disabled={controlsDisabled}
                    onChange={(v) => setToggle("employee_self_service", v)}
                  />
                  <ToggleRow
                    title="Company admin kan bestille"
                    desc="Hvis aktiv: company_admin kan også bestille lunsj."
                    checked={sysDraft.toggles.company_admin_can_order}
                    disabled={controlsDisabled}
                    onChange={(v) => setToggle("company_admin_can_order", v)}
                  />
                  <ToggleRow
                    title="Strict mode"
                    desc="Hvis aktiv: ingen unntak i normal drift (overstyring krever root)."
                    checked={sysDraft.toggles.strict_mode}
                    disabled={controlsDisabled}
                    onChange={(v) => setToggle("strict_mode", v)}
                  />
                  <ToggleRow
                    title="ESG-motor"
                    desc="Aktiver intern ESG-/matsvinnmotor (ikke synlig for ansatte)."
                    checked={sysDraft.toggles.esg_engine}
                    disabled={controlsDisabled}
                    onChange={(v) => setToggle("esg_engine", v)}
                  />
                  <ToggleRow
                    title="E-post backup av ordre"
                    desc="Aktiver outbox/retry til ordre@lunchportalen.no."
                    checked={sysDraft.toggles.email_backup}
                    disabled={controlsDisabled}
                    onChange={(v) => setToggle("email_backup", v)}
                  />
                </div>

                {/* Emergency panel */}
                <div className="mt-6 rounded-3xl bg-rose-50 p-4 ring-1 ring-rose-200">
                  <SectionTitle
                    overline="EMERGENCY"
                    title="Kill switches"
                    desc="Nødknapper. Slår inn umiddelbart. Brukes kun ved driftshendelser."
                    right={
                      planDangerCount ? <Chip label="HIGH RISK" tone="bad" /> : <Chip label="SAFE" tone="neutral" />
                    }
                  />
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <ToggleRow
                      danger
                      title="Blokker bestillinger"
                      desc="Stopp alle nye bestillinger system-wide."
                      checked={sysDraft.killswitch.orders}
                      disabled={controlsDisabled}
                      onChange={(v) => setKill("orders", v)}
                    />
                    <ToggleRow
                      danger
                      title="Blokker avbestillinger"
                      desc="Stopp alle avbestillinger system-wide."
                      checked={sysDraft.killswitch.cancellations}
                      disabled={controlsDisabled}
                      onChange={(v) => setKill("cancellations", v)}
                    />
                    <ToggleRow
                      danger
                      title="Blokker e-post"
                      desc="Stopp alle e-postutsendelser (backup/kvittering)."
                      checked={sysDraft.killswitch.emails}
                      disabled={controlsDisabled}
                      onChange={(v) => setKill("emails", v)}
                    />
                    <ToggleRow
                      danger
                      title="Blokker kjøkken-feed"
                      desc="Stopp generering/visning av kjøkkenoversikt ved behov."
                      checked={sysDraft.killswitch.kitchen_feed}
                      disabled={controlsDisabled}
                      onChange={(v) => setKill("kitchen_feed", v)}
                    />
                  </div>

                  {editMode ? (
                    <div className="mt-3 text-[11px] font-semibold text-rose-900">
                      Tips: Bruk Preview før Apply. Kill switches medfører øyeblikkelig effekt og tydelig spor i audit.
                    </div>
                  ) : null}
                </div>

                {/* Retention */}
                <div className="mt-6 rounded-3xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
                  <SectionTitle
                    overline="PRIVACY"
                    title="Retention policy"
                    desc="Orders eldre enn X mnd slettes/anonymiseres. Audit beholdes i Y år (compliance)."
                  />
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                      <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">ORDRE (MÅNEDER)</div>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        max={60}
                        disabled={controlsDisabled}
                        value={sysDraft.retention.orders_months}
                        onChange={(e) => setRetention("orders_months", Number(e.target.value))}
                        className="mt-2 w-full rounded-2xl bg-white px-4 py-3.5 md:py-3 text-sm font-semibold text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-60"
                      />
                      <div className="mt-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">Anbefalt: 12–24 mnd.</div>
                    </div>
                    <div className="rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                      <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">AUDIT (ÅR)</div>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={1}
                        max={15}
                        disabled={controlsDisabled}
                        value={sysDraft.retention.audit_years}
                        onChange={(e) => setRetention("audit_years", Number(e.target.value))}
                        className="mt-2 w-full rounded-2xl bg-white px-4 py-3.5 md:py-3 text-sm font-semibold text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-neutral-900 disabled:opacity-60"
                      />
                      <div className="mt-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">Anbefalt: 3–7 år.</div>
                    </div>
                  </div>
                  <div className="mt-3 text-[11px] font-semibold text-neutral-600">
                    Sist oppdatert: <span className="font-extrabold text-neutral-900">{formatISO(sysDraft.updated_at)}</span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Break-glass control */}
          <div className="rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))] p-4">
            <SectionTitle
              overline="ROOT"
              title="Break-glass"
              desc="Root-modus gir full kontroll i et tidsvindu. Krever formål."
              right={
                <button
                  type="button"
                  onClick={() => loadBreakGlass()}
                  disabled={bgLoading}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50 disabled:opacity-60"
                >
                  Refresh
                </button>
              }
            />

            {bgErr ? <div className="mt-3 text-sm font-semibold text-rose-700">{bgErr}</div> : null}

            {rootActive ? (
              <div className="mt-4 rounded-3xl bg-rose-50 p-4 ring-1 ring-rose-200">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-xs font-extrabold tracking-wide text-rose-800">ROOT MODE ACTIVE</div>
                    <div className="mt-1 text-sm font-black text-rose-950">{msToClock(rootRemainingMs)} remaining</div>
                    <div className="mt-1 text-xs font-semibold text-rose-900">
                      Purpose: <span className="font-extrabold">{String(bg?.purpose ?? "—")}</span>
                    </div>
                    {bg?.note ? (
                      <div className="mt-1 text-xs font-semibold text-rose-900">
                        Note: <span className="font-extrabold">{bg.note}</span>
                      </div>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => endBreakGlass()}
                    disabled={bgLoading}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    End now
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-3xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">FORMÅL</div>
                    <select
                      value={bgPurpose}
                      onChange={(e) => setBgPurpose(e.target.value as any)}
                      className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    >
                      <option value="DRIFT">DRIFT</option>
                      <option value="SUPPORT">SUPPORT</option>
                      <option value="SECURITY">SECURITY</option>
                      <option value="OFFBOARDING">OFFBOARDING</option>
                      <option value="LEGAL">LEGAL</option>
                    </select>
                    <div className="mt-2 text-[11px] font-semibold text-[rgb(var(--lp-muted))]">Purpose lagres i audit_meta_events.</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">NOTAT (valgfritt)</div>
                    <input
                      value={bgNote}
                      onChange={(e) => setBgNote(e.target.value)}
                      placeholder="Kort forklaring…"
                      className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-neutral-900"
                    />
                    <div className="mt-2 text-[11px] font-semibold text-[rgb(var(--lp-muted))]">
                      Brukes ved revisjon / intern forklaring.
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => startBreakGlass()}
                    disabled={bgLoading}
                    className="rounded-xl bg-neutral-900 px-4 py-2 text-xs font-extrabold text-white hover:bg-neutral-800 disabled:opacity-60"
                  >
                    {bgLoading ? "Starter…" : "Activate (15 min)"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))] p-4">
            <SectionTitle
              overline="IRREVERSIBLE"
              title="Danger zone"
              desc="Skjult med vilje. Krever friksjon + root."
              right={
                <button
                  type="button"
                  onClick={() => {
                    setDangerOpen((v) => !v);
                    setDangerAcknowledge(false);
                    resetDangerForm();
                    setSelected(null);
                  }}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                >
                  {dangerOpen ? "Hide" : "Open"}
                </button>
              }
            />

            {!dangerOpen ? (
              <div className="mt-3 text-xs font-semibold text-[rgb(var(--lp-muted))]">Irreversible actions er skjult til du åpner dette panelet.</div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="rounded-3xl bg-rose-50 p-4 ring-1 ring-rose-200">
                  <div className="text-xs font-extrabold tracking-wide text-rose-800">WARNING</div>
                  <div className="mt-1 text-sm font-black text-rose-950">Irreversible actions</div>
                  <div className="mt-2 text-xs font-semibold text-rose-900">
                    Dette kan ikke angres. Root mode kreves. All handling logges.
                  </div>

                  <label className="mt-3 flex items-center gap-2 text-xs font-extrabold text-rose-900">
                    <input type="checkbox" checked={dangerAcknowledge} onChange={(e) => setDangerAcknowledge(e.target.checked)} />
                    I understand this is irreversible
                  </label>

                  {!rootActive ? (
                    <div className="mt-3 rounded-xl bg-yellow-50 p-3 ring-1 ring-yellow-200">
                      <div className="text-xs font-extrabold text-yellow-900">Requires Root Mode</div>
                      <div className="mt-1 text-xs font-semibold text-yellow-900">Start break-glass før du kan utføre purge.</div>
                    </div>
                  ) : null}
                </div>

                {/* Company picker */}
                <div className="rounded-3xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
                  <div className="text-xs font-extrabold tracking-wide text-neutral-600">FIND COMPANY</div>
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Søk (navn, orgnr, id)…"
                    className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-neutral-900 ring-1 ring-[rgb(var(--lp-border))] placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
                  />

                  {companiesErr ? <div className="mt-3 text-sm font-semibold text-rose-700">{companiesErr}</div> : null}

                  <div className="mt-3 max-h-64 overflow-auto rounded-2xl ring-1 ring-[rgb(var(--lp-border))]">
                    <div className="min-w-[720px] md:min-w-0">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead className="sticky top-0 bg-neutral-50 text-xs font-extrabold tracking-wide text-neutral-600">
                          <tr className="border-b border-[rgb(var(--lp-border))]">
                            <th className="px-3 py-2 md:px-4 md:py-3">FIRMA</th>
                            <th className="px-3 py-2 md:px-4 md:py-3">STATUS</th>
                            <th className="px-3 py-2 md:px-4 md:py-3">SIST</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingCompanies ? (
                            <tr>
                              <td colSpan={3} className="px-3 py-8 md:px-4 text-center text-sm font-semibold text-neutral-600">
                                Laster…
                              </td>
                            </tr>
                          ) : items.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-3 py-8 md:px-4 text-center text-sm font-semibold text-neutral-600">
                                Ingen treff.
                              </td>
                            </tr>
                          ) : (
                            items.map((c) => {
                              const active = selected?.id === c.id;
                              return (
                                <tr
                                  key={c.id}
                                  className={[
                                    "border-b border-[rgb(var(--lp-border))] cursor-pointer",
                                    active ? "bg-neutral-50" : "hover:bg-neutral-50/60",
                                  ].join(" ")}
                                  onClick={() => {
                                    setSelected(c);
                                    resetDangerForm();
                                  }}
                                >
                                  <td className="px-3 py-2 md:px-4 md:py-3">
                                    <div className="font-extrabold text-neutral-950">{c.name}</div>
                                    <div className="mt-0.5 font-mono text-xs text-neutral-500">{c.id}</div>
                                  </td>
                                  <td className="px-3 py-2 md:px-4 md:py-3">
                                    <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))]">
                                      {String(c.status).toUpperCase()}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 md:px-4 md:py-3 text-xs font-semibold text-neutral-700">
                                    {formatISO(c.updated_at)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-neutral-600">
                      Viser <span className="font-extrabold text-neutral-900">{items.length}</span>
                      {cursor ? " (flere tilgjengelig)" : ""}
                    </div>
                    <button
                      disabled={!cursor || loadingMore || loadingCompanies}
                      onClick={() => loadMoreCompanies()}
                      className={[
                        "rounded-xl px-4 py-2 text-xs font-extrabold ring-1 transition",
                        "disabled:cursor-not-allowed disabled:opacity-60",
                        "bg-white text-neutral-900 ring-[rgb(var(--lp-border))] hover:bg-neutral-50",
                      ].join(" ")}
                    >
                      {loadingMore ? "Laster…" : cursor ? "Load more" : "No more"}
                    </button>
                  </div>
                </div>

                {/* Purge panel */}
                <div className="rounded-3xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
                  <div className="text-xs font-extrabold tracking-wide text-neutral-600">PURGE COMPANY</div>
                  {!selected ? (
                    <div className="mt-2 text-sm font-semibold text-neutral-700">Velg et firma for å fortsette.</div>
                  ) : (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                        <div className="text-xs font-extrabold tracking-wide text-neutral-600">TARGET</div>
                        <div className="mt-1 font-black text-neutral-950">{selected.name}</div>
                        <div className="mt-1 font-mono text-xs text-neutral-600">{selected.id}</div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => loadPurgePreview(selected.id)}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                          >
                            Preview impact
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(null);
                              resetDangerForm();
                            }}
                            className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {purgePreviewOpen ? (
                        <div className="rounded-2xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                          <div className="text-xs font-extrabold tracking-wide text-neutral-600">PREVIEW</div>
                          {purgePreviewLoading ? (
                            <div className="mt-2 text-sm font-semibold text-neutral-700">Laster rapport…</div>
                          ) : purgePreviewErr ? (
                            <div className="mt-2 text-sm font-semibold text-rose-700">{purgePreviewErr}</div>
                          ) : purgePreview ? (
                            <div className="mt-2 space-y-2">
                              <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
                                Rapport fra /purge?dryRun=1 (ingen sletting).
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <MiniStat label="orders" value={String(purgePreview?.report?.orders ?? "—")} />
                                <MiniStat label="profiles" value={String(purgePreview?.report?.profiles ?? "—")} />
                                <MiniStat label="locations" value={String(purgePreview?.report?.company_locations ?? "—")} />
                                <MiniStat label="agreements" value={String(purgePreview?.report?.agreements ?? "—")} />
                              </div>
                              <div className="text-[11px] font-mono text-neutral-600">rid: {safeStr(purgePreview?.rid) || "—"}</div>
                            </div>
                          ) : (
                            <div className="mt-2 text-sm font-semibold text-neutral-700">Ingen rapport.</div>
                          )}
                        </div>
                      ) : null}

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div>
                          <div className="text-xs font-extrabold tracking-wide text-neutral-600">TYPE “PURGE”</div>
                          <input
                            value={confirmWord}
                            onChange={(e) => setConfirmWord(e.target.value)}
                            placeholder="PURGE"
                            className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <div className="text-xs font-extrabold tracking-wide text-neutral-600">TYPE COMPANY ID</div>
                          <input
                            value={confirmId}
                            onChange={(e) => setConfirmId(e.target.value)}
                            placeholder={selected.id}
                            className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-extrabold tracking-wide text-neutral-600">REASON (required)</div>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Hvorfor purge? (min. 8 tegn)"
                          className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))] focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          rows={3}
                        />
                      </div>

                      <button
                        type="button"
                        disabled={!purgeAllowed || isPendingPurge}
                        onClick={() => doPurge()}
                        className={[
                          "w-full rounded-2xl px-4 py-3 text-sm font-extrabold transition",
                          purgeAllowed ? "bg-neutral-900 text-white hover:bg-neutral-800" : "bg-neutral-200 text-neutral-600",
                          "disabled:cursor-not-allowed disabled:opacity-80",
                        ].join(" ")}
                      >
                        {isPendingPurge ? "Jobber…" : rootActive ? "PURGE NOW" : "Requires Root Mode"}
                      </button>

                      <div className="text-[11px] font-semibold text-[rgb(var(--lp-muted))]">
                        Purge logges med reason og rid. (Neste steg: server-side krav om root-mode.)
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          TAB: SIMULATION
      ====================================================== */}
      {tab === "simulation" && (
        <div className="mt-5 space-y-4">
          <div className="rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))] p-4">
            <SectionTitle
              overline="SIMULATION"
              title="Time travel / what-if"
              desc="Her kommer den delen som føles som sci-fi: simulér endringer før du trykker Apply."
              right={
                <button
                  type="button"
                  onClick={() => toastOk("Simulation engine: kommer i neste steg (B).")}
                  className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-neutral-800"
                >
                  Explain
                </button>
              }
            />

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <EmptyState title="Scenario builder (v1)" desc="Velg dato + firma + endring → få preview av kjøkkenresultat." />
              <EmptyState title="Delta output" desc="Her vises effekten: porsjoner, avvik, kost/ESG delta – før noe endres." />
            </div>

            <div className="mt-4 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
              <div className="text-xs font-extrabold tracking-wide text-neutral-600">WHY THIS FEELS 15 YEARS AHEAD</div>
              <div className="mt-2 text-xs font-semibold text-neutral-700">
                Simulation gjør drift forutsigbar: du ser konsekvens før handling. Når vi kobler på “policy engine + preview”,
                oppleves dette som et kontrollrom, ikke et adminpanel.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          TAB: FORENSICS
      ====================================================== */}
      {tab === "forensics" && (
        <div className="mt-5 space-y-4">
          <div className="rounded-3xl bg-white ring-1 ring-[rgb(var(--lp-border))] p-4">
            <SectionTitle
              overline="FORENSICS"
              title="Why-trail"
              desc="Dette er bevislaget: hva skjedde, når, hvem, og hvorfor."
              right={
                <>
                  <button
                    type="button"
                    onClick={() => loadRecent()}
                    className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                  >
                    Refresh
                  </button>
                  <Link href="/superadmin/audit" className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-neutral-800">
                    Open Audit
                  </Link>
                </>
              }
            />

            {recentErr ? (
              <div className="mt-3 text-sm font-semibold text-rose-700">{recentErr}</div>
            ) : recentLoading ? (
              <div className="mt-3 text-sm font-semibold text-neutral-700">Laster…</div>
            ) : recent.length === 0 ? (
              <div className="mt-3 text-sm font-semibold text-neutral-700">Ingen hendelser.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {recent.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================
          SETTINGS PREVIEW MODAL
      ====================================================== */}
      {settingsPreviewOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSettingsPreviewOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 md:inset-0 md:flex md:items-center md:justify-center">
            <div className="mx-auto w-full max-w-3xl rounded-t-3xl md:rounded-3xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))] md:shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-extrabold tracking-wide text-neutral-600">PREVIEW</div>
                  <div className="mt-1 text-lg font-black text-neutral-950">Plan → Preview → Apply</div>
                  <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
                    Dette er endringene som vil bli skrevet til systemet.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsPreviewOpen(false)}
                  className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Chip label={`${plan.length} changes`} tone={planDangerCount ? "bad" : planWarnCount ? "warn" : "neutral"} />
                {planDangerCount ? <Chip label={`DANGER: ${planDangerCount}`} tone="bad" /> : null}
                {planWarnCount ? <Chip label={`WARN: ${planWarnCount}`} tone="warn" /> : null}
                <Chip label={editMode ? "MODE: EDIT" : "MODE: READ"} tone={editMode ? "warn" : "neutral"} />
              </div>

              {plan.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-neutral-50 p-4 ring-1 ring-neutral-200">
                  <div className="text-sm font-black text-neutral-950">Ingen endringer</div>
                  <div className="mt-1 text-xs font-semibold text-neutral-700">Gjør en endring i Controls for å bygge en plan.</div>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {plan.map((p) => (
                    <div
                      key={p.id}
                      className={[
                        "rounded-2xl p-3 ring-1",
                        p.severity === "danger"
                          ? "bg-rose-50 ring-rose-200"
                          : p.severity === "warn"
                            ? "bg-yellow-50 ring-yellow-200"
                            : "bg-white ring-[rgb(var(--lp-border))]",
                      ].join(" ")}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Chip
                            label={p.area}
                            tone={p.severity === "danger" ? "bad" : p.severity === "warn" ? "warn" : "neutral"}
                            mono
                          />
                          <div className="text-sm font-extrabold text-neutral-950">{humanKey(p.key)}</div>
                        </div>
                        <div className="text-xs font-semibold text-neutral-700">
                          <span className="font-mono">{p.from}</span> → <span className="font-mono">{p.to}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {planDangerCount ? (
                <div className="mt-4 rounded-2xl bg-rose-50 p-3 ring-1 ring-rose-200">
                  <div className="text-xs font-extrabold tracking-wide text-rose-800">HIGH RISK CHANGE</div>
                  <div className="mt-1 text-xs font-semibold text-rose-900">
                    Planen inneholder endringer som kan stoppe bestilling/avbestilling. Bekreft før Apply.
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-xs font-extrabold text-rose-900">
                    <input
                      type="checkbox"
                      checked={applyAcknowledge}
                      onChange={(e) => setApplyAcknowledge(e.target.checked)}
                    />
                    I understand this impacts production
                  </label>
                </div>
              ) : null}

              <div className="mt-4 flex flex-col gap-2 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={() => {
                    discardChanges();
                    setSettingsPreviewOpen(false);
                  }}
                  disabled={!sysDirty}
                  className="w-full md:w-auto rounded-xl bg-white px-4 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50 disabled:opacity-60"
                >
                  Discard
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsPreviewOpen(false);
                    saveSystemSettings();
                  }}
                  disabled={!canApply() || isSavingSettings}
                  className={[
                    "w-full md:w-auto rounded-xl px-4 py-2 text-xs font-extrabold ring-1 transition",
                    !canApply() || isSavingSettings
                      ? "bg-neutral-200 text-neutral-700 ring-neutral-200"
                      : "bg-neutral-900 text-white ring-neutral-900 hover:bg-neutral-800",
                  ].join(" ")}
                >
                  {isSavingSettings ? "Applying…" : "Apply now"}
                </button>
              </div>

              <div className="mt-3 text-[11px] font-semibold text-[rgb(var(--lp-muted))]">
                Enterprise rule: Changes are intentional, visible, and traceable. (Server-side enforcement tar vi i steg B.)
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* =====================================================
          MOBILE: STICKY BOTTOM ACTION BAR (Edit + Dirty)
      ====================================================== */}
      {tab === "controls" && editMode && sysDirty ? (
        <div className="fixed inset-x-0 bottom-3 z-40 px-4 md:hidden">
          <div className="mx-auto max-w-6xl rounded-3xl bg-white/95 backdrop-blur p-2 ring-1 ring-[rgb(var(--lp-border))] shadow-lg">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => discardChanges()}
                className="flex-1 rounded-2xl bg-white px-3 py-3 text-sm font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => openSettingsPreview()}
                className="flex-1 rounded-2xl bg-white px-3 py-3 text-sm font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => saveSystemSettings()}
                disabled={!canApply() || isSavingSettings}
                className={[
                  "flex-1 rounded-2xl px-3 py-3 text-sm font-extrabold transition",
                  !canApply() || isSavingSettings ? "bg-neutral-200 text-neutral-700" : "bg-neutral-900 text-white hover:bg-neutral-800",
                ].join(" ")}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   Small stats tile
========================================================= */
function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">{label.toUpperCase()}</div>
      <div className="mt-1 text-xl font-black text-neutral-950">{value}</div>
    </div>
  );
}
