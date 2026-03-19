"use client";

import { useCallback, useEffect, useState } from "react";

type SystemToggles = {
  enforce_cutoff?: boolean;
  require_active_agreement?: boolean;
  employee_self_service?: boolean;
  company_admin_can_order?: boolean;
  strict_mode?: boolean;
  esg_engine?: boolean;
  email_backup?: boolean;
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
  toggles: SystemToggles;
  killswitch: KillSwitch;
  retention: Retention;
  updated_at: string | null;
  updated_by: string | null;
};

type SystemGetResponse =
  | { ok: true; rid: string; data: { settings?: SystemSettings } | { settings?: SystemSettings }; settings?: SystemSettings }
  | { ok: false; rid: string; error: string; message: string; status: number };

type SystemPutResponse =
  | { ok: true; rid: string; data?: { settings?: SystemSettings }; settings?: SystemSettings }
  | { ok: false; rid: string; error: string; message: string; status: number };

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/superadmin/system", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as SystemGetResponse | null;
      if (!res.ok || !json || (json as any).ok === false) {
        const msg =
          (json as any)?.message ||
          (json as any)?.error ||
          (res.status === 401
            ? "Ikke innlogget."
            : res.status === 403
            ? "Ingen tilgang til systeminnstillinger."
            : `Kunne ikke hente systeminnstillinger (status ${res.status}).`);
        setError(String(msg));
        setSettings(null);
        return;
      }
      const dataSettings =
        (json as any).settings ?? ((json as any).data && (json as any).data.settings);
      if (dataSettings) {
        setSettings(dataSettings as SystemSettings);
      } else {
        setError("Mangler settings i responsen.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil ved henting av systeminnstillinger.");
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateToggle = (key: keyof SystemToggles, value: boolean) => {
    setSettings((prev) =>
      prev ? { ...prev, toggles: { ...prev.toggles, [key]: value } } : prev
    );
  };

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
      const res = await fetch("/api/superadmin/system", {
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
      if (!res.ok || !json || (json as any).ok === false) {
        const msg =
          (json as any)?.message ||
          (json as any)?.error ||
          (res.status === 403
            ? "Endringen krever aktiv Root Mode eller høyere tilgang."
            : `Kunne ikke lagre systeminnstillinger (status ${res.status}).`);
        setError(String(msg));
        return;
      }
      const updated =
        (json as any).settings ?? ((json as any).data && (json as any).data.settings);
      if (updated) {
        setSettings(updated as SystemSettings);
      }
      setToast("Systeminnstillinger lagret.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ukjent feil ved lagring av systeminnstillinger.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-xl font-semibold text-slate-900">Systeminnstillinger</h1>
      <p className="mt-1 text-sm text-slate-600">
        Globale toggles og killswitches for Lunchportalen. Endringer gjelder hele systemet og krever superadmin.
      </p>

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

      <div className="mt-4 flex items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="h-9 rounded border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {loading ? "Laster…" : "Oppdater"}
        </button>
        {settings?.updated_at && (
          <span className="text-xs text-slate-500">
            Sist oppdatert {new Date(settings.updated_at).toLocaleString("nb-NO")}
            {settings.updated_by ? ` av ${settings.updated_by}` : ""}
          </span>
        )}
      </div>

      {!settings && !loading ? (
        <p className="mt-4 text-sm text-slate-500">
          Ingen systeminnstillinger kunne lastes. Sjekk at tabellen <code>system_settings</code> finnes og at du er logget inn som superadmin.
        </p>
      ) : null}

      {settings && (
        <div className="mt-6 space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Toggles</h2>
            <p className="mt-1 text-xs text-slate-600">
              Funksjonsflagg for bestilling, avtaler og drift. Alle verdier er persistente i <code>system_settings</code>.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.toggles.enforce_cutoff}
                  onChange={(e) => updateToggle("enforce_cutoff", e.target.checked)}
                />
                <span>Håndhev bestillingsfrist (cutoff)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.toggles.require_active_agreement}
                  onChange={(e) => updateToggle("require_active_agreement", e.target.checked)}
                />
                <span>Krev aktiv avtale for bestilling</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.toggles.employee_self_service}
                  onChange={(e) => updateToggle("employee_self_service", e.target.checked)}
                />
                <span>Ansatt selvbetjening for bestilling/avbestilling</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.toggles.company_admin_can_order}
                  onChange={(e) => updateToggle("company_admin_can_order", e.target.checked)}
                />
                <span>Company admin kan bestille på vegne av ansatte</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.toggles.strict_mode}
                  onChange={(e) => updateToggle("strict_mode", e.target.checked)}
                />
                <span>Strict mode (ingen unntak / myke feil)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.toggles.esg_engine}
                  onChange={(e) => updateToggle("esg_engine", e.target.checked)}
                />
                <span>Aktiver ESG-motor</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.toggles.email_backup}
                  onChange={(e) => updateToggle("email_backup", e.target.checked)}
                />
                <span>Aktiver e‑post backup/outbox</span>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Killswitch</h2>
            <p className="mt-1 text-xs text-slate-600">
              Strenge globale sperrer. Endringer her påvirker hele systemet umiddelbart.
            </p>
            <div className="mt-3 space-y-2 text-sm">
              <label className="flex items-center gap-2 text-red-700">
                <input
                  type="checkbox"
                  checked={settings.killswitch.orders}
                  onChange={(e) => updateKill("orders", e.target.checked)}
                />
                <span>Stopp alle ordre (orders)</span>
              </label>
              <label className="flex items-center gap-2 text-red-700">
                <input
                  type="checkbox"
                  checked={settings.killswitch.cancellations}
                  onChange={(e) => updateKill("cancellations", e.target.checked)}
                />
                <span>Stopp alle avbestillinger (cancellations)</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.killswitch.emails}
                  onChange={(e) => updateKill("emails", e.target.checked)}
                />
                <span>Stopp utsendelse av e‑post</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={settings.killswitch.kitchen_feed}
                  onChange={(e) => updateKill("kitchen_feed", e.target.checked)}
                />
                <span>Stopp oppdatering av kjøkkenfeed</span>
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">Retensjon</h2>
            <p className="mt-1 text-xs text-slate-600">
              Hvor lenge data beholdes før automatisk opprydding (lageres i <code>system_settings.retention</code>).
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="grid gap-1">
                <span>Ordrehistorikk (måneder)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.retention.orders_months}
                  onChange={(e) => updateRetention("orders_months", Number(e.target.value || settings.retention.orders_months))}
                  className="h-9 w-24 rounded border border-slate-200 px-2 text-sm"
                />
              </label>
              <label className="grid gap-1">
                <span>Revisjonshistorikk (år)</span>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={settings.retention.audit_years}
                  onChange={(e) => updateRetention("audit_years", Number(e.target.value || settings.retention.audit_years))}
                  className="h-9 w-24 rounded border border-slate-200 px-2 text-sm"
                />
              </label>
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !settings}
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? "Lagrer…" : "Lagre systeminnstillinger"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
