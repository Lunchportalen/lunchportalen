"use client";

import { useCallback, useEffect, useState } from "react";

export default function WeekMenuNotificationToggle() {
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/employee/notification-preferences", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        const json = await res.json();
        if (!cancelled && res.ok && json.ok && json.data) {
          setEnabled(json.data.menuWeekOpeningEnabled !== false);
        }
      } catch {
        if (!cancelled) setError("Kunne ikke laste varselinnstillinger.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onToggle = useCallback(async () => {
    if (loading || saving) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employee/notification-preferences", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ menuWeekOpeningEnabled: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.message ?? "Kunne ikke lagre.");
        return;
      }
      setEnabled(next);
    } catch {
      setError("Kunne ikke lagre.");
    } finally {
      setSaving(false);
    }
  }, [enabled, loading, saving]);

  return (
    <section
      className="ds-week-notification-prefs mb-6 rounded-2xl border border-neutral-200/80 bg-white/80 px-4 py-3 text-left"
      aria-label="Varsler"
    >
      <h2 className="text-sm font-semibold text-neutral-950">Varsler</h2>
      <p className="mt-1 text-sm text-neutral-600">E-post når ny meny åpnes (torsdag kl. 14:00).</p>
      <label className="mt-3 flex min-h-touch items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 shrink-0 rounded border-neutral-300 accent-[var(--ds-accent,#f5c518)]"
          checked={enabled}
          disabled={loading || saving}
          onChange={() => void onToggle()}
        />
        <span className="text-sm font-medium text-neutral-900">
          {enabled ? "Uke-åpning på e-post" : "Uke-åpning av"}
        </span>
      </label>
      {error ? (
        <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>
      ) : null}
    </section>
  );
}
