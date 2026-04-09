"use client";

import { useCallback, useEffect, useState } from "react";

import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";

type SystemToggles = {
  enforce_cutoff?: boolean;
  require_active_agreement?: boolean;
  employee_self_service?: boolean;
  company_admin_can_order?: boolean;
  strict_mode?: boolean;
  esg_engine?: boolean;
  email_backup?: boolean;
  ai_enabled?: boolean;
  autopilot_enabled?: boolean;
};

type KillSwitch = {
  orders: boolean;
  cancellations: boolean;
  emails: boolean;
  kitchen_feed: boolean;
};

type Retention = {
  orders_months: number;
  audit_years: number;
};

type SystemSettings = {
  site_name: string;
  support_email: string;
  /** Legacy / top-level mirror; prefer toggles when present */
  ai_enabled?: boolean;
  autopilot_enabled?: boolean;
  toggles: SystemToggles;
  killswitch: KillSwitch;
  retention: Retention;
  updated_at: string | null;
  updated_by: string | null;
};

type SystemSettingsBaseline = {
  status: "ready" | "row_missing" | "table_missing" | "read_error";
  source: "service_role" | "request_scope";
  operatorMessage: string;
  operatorAction: string | null;
  detail: string | null;
};

type SystemPutResponse =
  | {
      ok: true;
      rid: string;
      data?: { settings?: SystemSettings; baseline?: SystemSettingsBaseline };
      settings?: SystemSettings;
    }
  | { ok: false; rid: string; error: string; message: string; status: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseBaseline(raw: unknown): SystemSettingsBaseline | null {
  if (!isRecord(raw)) return null;
  const status = String(raw.status ?? "").trim();
  if (
    status !== "ready" &&
    status !== "row_missing" &&
    status !== "table_missing" &&
    status !== "read_error"
  ) {
    return null;
  }
  const source = raw.source === "service_role" ? "service_role" : "request_scope";
  return {
    status,
    source,
    operatorMessage: typeof raw.operatorMessage === "string" ? raw.operatorMessage : "",
    operatorAction: typeof raw.operatorAction === "string" ? raw.operatorAction : null,
    detail: typeof raw.detail === "string" ? raw.detail : null,
  };
}

function baselineLabel(status: SystemSettingsBaseline["status"] | null | undefined): string {
  switch (status) {
    case "ready":
      return "Klar";
    case "row_missing":
      return "Mangler rad";
    case "table_missing":
      return "Mangler tabell";
    case "read_error":
      return "Lesefeil";
    default:
      return "Ukjent";
  }
}

function pickBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function pickNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeSystemSettings(raw: Record<string, unknown>): SystemSettings {
  const rawToggles = raw.toggles ?? {};
  const t =
    typeof rawToggles === "object" && rawToggles !== null && !Array.isArray(rawToggles)
      ? (rawToggles as Record<string, unknown>)
      : {};
  const k =
    raw.killswitch && typeof raw.killswitch === "object" && raw.killswitch !== null
      ? (raw.killswitch as Record<string, unknown>)
      : {};
  const r =
    raw.retention && typeof raw.retention === "object" && raw.retention !== null
      ? (raw.retention as Record<string, unknown>)
      : {};

  const site_name = typeof raw.site_name === "string" ? raw.site_name : "";
  const support_email = typeof raw.support_email === "string" ? raw.support_email : "";

  const ai_enabled = pickBool(
    t.ai_enabled !== undefined ? t.ai_enabled : raw.ai_enabled,
    false
  );
  const autopilot_enabled = pickBool(
    t.autopilot_enabled !== undefined ? t.autopilot_enabled : raw.autopilot_enabled,
    false
  );

  const toggles: SystemToggles = {
    enforce_cutoff: pickBool(t.enforce_cutoff, true),
    require_active_agreement: pickBool(t.require_active_agreement, true),
    employee_self_service: pickBool(t.employee_self_service, true),
    company_admin_can_order: pickBool(t.company_admin_can_order, true),
    strict_mode: pickBool(t.strict_mode, true),
    esg_engine: pickBool(t.esg_engine, false),
    email_backup: pickBool(t.email_backup, true),
    ai_enabled,
    autopilot_enabled,
  };

  const killswitch: KillSwitch = {
    orders: pickBool(k.orders, false),
    cancellations: pickBool(k.cancellations, false),
    emails: pickBool(k.emails, false),
    kitchen_feed: pickBool(k.kitchen_feed, false),
  };

  const retention: Retention = {
    orders_months: pickNum(r.orders_months, 18, 1, 60),
    audit_years: pickNum(r.audit_years, 5, 1, 15),
  };

  return {
    site_name,
    support_email,
    ai_enabled,
    autopilot_enabled,
    toggles,
    killswitch,
    retention,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : null,
    updated_by: typeof raw.updated_by === "string" ? raw.updated_by : null,
  };
}

export default function SettingsSystemPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [baseline, setBaseline] = useState<SystemSettingsBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/settings", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!json || typeof json !== "object" || json.ok !== true) {
        console.warn("Settings failed", json);
        setSettings(null);
        setBaseline(null);
        const errCode = typeof json.error === "string" ? json.error : "";
        const msg =
          errCode === "SETTINGS_TABLE_MISSING"
            ? "Systemet er ikke initialisert enda"
            : typeof json.message === "string" && json.message.length
              ? json.message
              : "Kunne ikke laste systeminnstillinger";
        setError(msg);
        return;
      }

      const payload = isRecord(json.data) ? json.data : {};
      const rawSettings = isRecord(payload.settings) ? payload.settings : payload;
      const normalized = normalizeSystemSettings(rawSettings);
      const nextBaseline = parseBaseline(payload.baseline);
      setSettings(normalized);
      setBaseline(nextBaseline);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil ved henting av systeminnstillinger.");
      setSettings(null);
      setBaseline(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function updateToggle(key: string, value: boolean) {
    setSettings((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        toggles: {
          ...(prev.toggles ?? {}),
          [key]: value,
        },
      };
    });
  }

  const updateKill = (key: keyof KillSwitch, value: boolean) => {
    setSettings((prev) =>
      prev ? { ...prev, killswitch: { ...prev.killswitch, [key]: value } } : prev
    );
  };

  const updateRetention = (key: keyof Retention, value: number) => {
    setSettings((prev) =>
      prev ? { ...prev, retention: { ...prev.retention, [key]: value } } : prev
    );
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setToast(null);
    try {
      const res = await fetch("/api/backoffice/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toggles: settings.toggles,
          killswitch: settings.killswitch,
          retention: settings.retention,
        }),
      });
      const json = (await res.json().catch(() => null)) as SystemPutResponse | null;
      if (!res.ok || !json || (json as { ok?: boolean }).ok === false) {
        const msg =
          (json as any)?.message ||
          (json as any)?.error ||
          (res.status === 403
            ? "Endringen krever aktiv Root Mode eller høyere tilgang."
            : `Kunne ikke lagre systeminnstillinger (status ${res.status}).`);
        setError(String(msg));
        return;
      }
      const updated = (json as any).settings ?? ((json as any).data && (json as any).data.settings);
      if (updated && isRecord(updated)) {
        setSettings(normalizeSystemSettings(updated));
      }
      const nextBaseline = parseBaseline((json as any)?.data?.baseline);
      if (nextBaseline) setBaseline(nextBaseline);
      setToast("Systeminnstillinger lagret.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil ved lagring av systeminnstillinger.");
    } finally {
      setSaving(false);
    }
  };

  const aiEnabled =
    settings?.toggles?.ai_enabled ?? settings?.ai_enabled ?? false;
  const baselineReady = baseline?.status === "ready";
  const activeKillCount = [
    settings?.killswitch?.orders,
    settings?.killswitch?.cancellations,
    settings?.killswitch?.emails,
    settings?.killswitch?.kitchen_feed,
  ].filter(Boolean).length;

  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "system",
    title: "Systeminnstillinger",
    description:
      "Driftsnær management workspace for globale toggles, killswitches og retensjon. Endringer gjelder hele Lunchportalen og krever superadmin.",
    routeKind: "workspace",
    signals: [
      {
        label: "Baseline",
        value: loading ? "Laster" : baselineLabel(baseline?.status),
        tone: baselineReady ? "success" : "warning",
        description: "Persisted system_settings-truth for denne arbeidsflaten. Ikke-klar baseline låser lagring og viser fail-closed defaults.",
      },
      {
        label: "Killswitcher aktive",
        value: loading ? "Laster" : String(activeKillCount),
        tone: activeKillCount > 0 ? "warning" : "success",
        description: "Globale sperrer som påvirker ordre, avbestilling, e-post og kjøkkenfeed.",
      },
      {
        label: "AI",
        value: aiEnabled ? "Aktiv" : loading ? "Laster" : "Av",
        tone: aiEnabled ? "success" : "neutral",
        description: "Samlet runtime-toggle for AI- og autopilot-nære flater.",
      },
    ],
    primaryAction: null,
    secondaryActions: [
      { label: "Governance og bruk", href: "/backoffice/settings/governance-insights", look: "secondary" },
      { label: "Management read", href: "/backoffice/settings/management-read", look: "outline" },
    ],
    relatedLinks: [
      { label: "Settings-oversikt", href: "/backoffice/settings", look: "outline" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
      { label: "System health", href: "/superadmin/system", look: "outline" },
    ],
    note:
      "Dette er en høyrisiko arbeidsflate: toggles og killswitches er runtime-nære, persistente og skal behandles som systemstyring, ikke som dekorativ CRUD.",
  });

  if (!settings && !loading) {
    return (
      <BackofficeManagementWorkspaceFrame model={workspaceModel}>
        <div className="max-w-4xl space-y-3">
          {error ? (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          ) : null}
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Ingen systeminnstillinger tilgjengelig.
          </div>
        </div>
      </BackofficeManagementWorkspaceFrame>
    );
  }

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="max-w-4xl">
      {error ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}
      {toast ? (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {toast}
        </div>
      ) : null}
      {baseline && baseline.status !== "ready" ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <p>{baseline.operatorMessage}</p>
          {baseline.operatorAction ? (
            <p className="mt-2 rounded border border-amber-200/80 bg-white/60 px-3 py-2 text-xs font-medium text-amber-900">
              Neste steg: {baseline.operatorAction}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-amber-900/80">
            Kilde: {baseline.source === "service_role" ? "service role" : "request scope"} · Lagring er låst til baseline er klar.
          </p>
          {baseline.detail ? (
            <details className="mt-2 text-xs text-amber-900/80">
              <summary className="cursor-pointer font-medium uppercase tracking-wide">Teknisk detalj</summary>
              <p className="mt-1 break-words font-mono">{baseline.detail}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Laster…" : "Oppdater"}
        </button>
        {baseline && baseline.status !== "ready" ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
            Read-only beredskap
          </span>
        ) : null}
        {settings?.updated_at ? (
          <span className="text-xs text-slate-500">
            Sist oppdatert {new Date(settings.updated_at).toLocaleString("nb-NO")}
            {settings.updated_by ? ` av ${settings.updated_by}` : ""}
          </span>
        ) : null}
      </div>

      {settings && !loading ? (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Toggles</h2>
            <p className="mt-1 text-xs text-slate-600">
              Funksjonsflagg for bestilling, avtaler og drift. Alle verdier er persistente i{" "}
              <code>system_settings</code>.
            </p>
            <fieldset
              disabled={!baselineReady || saving}
              className="mt-3 space-y-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.toggles?.enforce_cutoff ?? false}
                  onChange={(e) => updateToggle("enforce_cutoff", e.target.checked)}
                />
                <span>Håndhev bestillingsfrist (cutoff)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.toggles?.require_active_agreement ?? false}
                  onChange={(e) => updateToggle("require_active_agreement", e.target.checked)}
                />
                <span>Krev aktiv avtale for bestilling</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.toggles?.employee_self_service ?? false}
                  onChange={(e) => updateToggle("employee_self_service", e.target.checked)}
                />
                <span>Ansatt selvbetjening for bestilling/avbestilling</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.toggles?.company_admin_can_order ?? false}
                  onChange={(e) => updateToggle("company_admin_can_order", e.target.checked)}
                />
                <span>Company admin kan bestille på vegne av ansatte</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.toggles?.strict_mode ?? false}
                  onChange={(e) => updateToggle("strict_mode", e.target.checked)}
                />
                <span>Strict mode (ingen unntak / myke feil)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.toggles?.esg_engine ?? false}
                  onChange={(e) => updateToggle("esg_engine", e.target.checked)}
                />
                <span>Aktiver ESG-motor</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.toggles?.email_backup ?? false}
                  onChange={(e) => updateToggle("email_backup", e.target.checked)}
                />
                <span>Aktiver e‑post backup/outbox</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => updateToggle("ai_enabled", e.target.checked)}
                />
                <span>AI aktivert</span>
              </label>
            </fieldset>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Killswitch</h2>
            <p className="mt-1 text-xs text-slate-600">
              Strenge globale sperrer. Endringer her påvirker hele systemet umiddelbart.
            </p>
            <fieldset
              disabled={!baselineReady || saving}
              className="mt-3 space-y-2 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              <label className="flex items-center gap-2 text-red-700">
                <input
                  type="checkbox"
                  checked={settings?.killswitch?.orders ?? false}
                  onChange={(e) => updateKill("orders", e.target.checked)}
                />
                <span>Stopp alle ordre (orders)</span>
              </label>
              <label className="flex items-center gap-2 text-red-700">
                <input
                  type="checkbox"
                  checked={settings?.killswitch?.cancellations ?? false}
                  onChange={(e) => updateKill("cancellations", e.target.checked)}
                />
                <span>Stopp alle avbestillinger (cancellations)</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={settings?.killswitch?.emails ?? false}
                  onChange={(e) => updateKill("emails", e.target.checked)}
                />
                <span>Stopp utsendelse av e‑post</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={settings?.killswitch?.kitchen_feed ?? false}
                  onChange={(e) => updateKill("kitchen_feed", e.target.checked)}
                />
                <span>Stopp oppdatering av kjøkkenfeed</span>
              </label>
            </fieldset>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Retensjon</h2>
            <p className="mt-1 text-xs text-slate-600">
              Hvor lenge data beholdes før automatisk opprydding (lageres i{" "}
              <code>system_settings.retention</code>).
            </p>
            <fieldset
              disabled={!baselineReady || saving}
              className="mt-3 flex flex-wrap gap-4 text-sm disabled:cursor-not-allowed disabled:opacity-70"
            >
              <label className="grid gap-1">
                <span>Ordrehistorikk (måneder)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings?.retention?.orders_months ?? 18}
                  onChange={(e) =>
                    updateRetention(
                      "orders_months",
                      Number(e.target.value || String(settings?.retention?.orders_months ?? 18))
                    )
                  }
                  className="h-9 w-24 rounded border border-slate-200 px-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span>Revisjonshistorikk (år)</span>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={settings?.retention?.audit_years ?? 5}
                  onChange={(e) =>
                    updateRetention(
                      "audit_years",
                      Number(e.target.value || String(settings?.retention?.audit_years ?? 5))
                    )
                  }
                  className="h-9 w-24 rounded border border-slate-200 px-2 text-sm"
                />
              </label>
            </fieldset>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !settings || !baselineReady}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Lagrer…" : "Lagre systeminnstillinger"}
            </button>
          </div>
        </div>
      ) : null}
      </div>
    </BackofficeManagementWorkspaceFrame>
  );
}
