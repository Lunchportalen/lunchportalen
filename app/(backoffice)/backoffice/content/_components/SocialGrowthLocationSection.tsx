"use client";

import { useCallback, useEffect, useState } from "react";

import {
  defaultSocialLocation,
  locationLabel,
  normalizeSocialLocation,
  parseSocialLocationFromCmsData,
  setSocialConfigLocation,
  type Location,
} from "@/lib/social/location";

const OPTIONS: Location[] = ["trondheim", "oslo", "tromso", "stockholm"];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

export type SocialGrowthLocationSectionProps = {
  /** Kalles når CMS-lokasjon er lest eller lagret (synk med kalender/SoMe). */
  onLocationResolved: (loc: Location) => void;
};

/**
 * SoMe-innstillinger: fast geo fra publisert global CMS settings (`social.location`).
 */
export function SocialGrowthLocationSection({ onLocationResolved }: SocialGrowthLocationSectionProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [settingsData, setSettingsData] = useState<Record<string, unknown> | null>(null);
  const [selected, setSelected] = useState<Location>(defaultSocialLocation);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/content/global/settings", { credentials: "include" });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: unknown } | null;
        if (cancelled) return;
        const data = json && isPlainObject(json.data) ? json.data : {};
        setSettingsData(data);
        const loc = parseSocialLocationFromCmsData(data);
        setSelected(loc);
        setSocialConfigLocation(loc);
        onLocationResolved(loc);
      } catch {
        if (!cancelled) setError("Kunne ikke lese CMS-innstillinger.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [onLocationResolved]);

  const mergeAndSave = useCallback(
    async (action: "save" | "publish") => {
      if (!settingsData || !isPlainObject(settingsData)) {
        setError("Innstillinger er ikke lastet — lagring blokkert for å unngå å tømme CMS-data.");
        return;
      }
      setSaving(true);
      setError(null);
      setToast(null);
      try {
        const base = { ...settingsData };
        const prevSocial =
          base.social && isPlainObject(base.social) ? { ...base.social } : {};
        base.social = { ...prevSocial, location: selected };

        const body =
          action === "save"
            ? { action: "save", data: base }
            : { action: "publish", data: base };

        const res = await fetch("/api/content/global/settings", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!res.ok || json?.ok === false) {
          setError(json?.message ?? `Lagring feilet (HTTP ${res.status}).`);
          return;
        }
        setSettingsData(base);
        const loc = normalizeSocialLocation(selected);
        setSocialConfigLocation(loc);
        onLocationResolved(loc);
        setToast(action === "publish" ? "Publisert: SoMe-lokasjon er oppdatert." : "Utkast lagret med ny SoMe-lokasjon.");
        window.setTimeout(() => setToast(null), 6000);
      } catch {
        setError("Nettverksfeil ved lagring.");
      } finally {
        setSaving(false);
      }
    },
    [settingsData, selected, onLocationResolved],
  );

  return (
    <section className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
        SoMe-innstillinger (CMS)
      </h3>
      <p className="mt-1 text-[11px] text-[rgb(var(--lp-muted))]">
        Velg målby for hashtags og lokal B2B-reach. Lagres i globale innstillinger som <code className="text-[10px]">social.location</code>
        — ikke hardkodet i kode.
      </p>
      {loading ? (
        <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Laster lokasjon fra CMS…</p>
      ) : (
        <label className="mt-2 grid gap-1 text-[11px] text-[rgb(var(--lp-text))]">
          Velg lokasjon
          <select
            value={selected}
            onChange={(e) => setSelected(normalizeSocialLocation(e.target.value))}
            className="h-9 max-w-xs rounded-lg border border-[rgb(var(--lp-border))] bg-white px-2 text-sm"
          >
            {OPTIONS.map((loc) => (
              <option key={loc} value={loc}>
                {locationLabel(loc)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || loading || !settingsData}
          className="min-h-9 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-[11px] font-medium disabled:opacity-50"
          onClick={() => void mergeAndSave("save")}
        >
          Lagre utkast
        </button>
        <button
          type="button"
          disabled={saving || loading || !settingsData}
          className="min-h-9 rounded-lg border border-pink-500/30 bg-pink-50/80 px-3 text-[11px] font-semibold text-pink-700 disabled:opacity-50"
          onClick={() => void mergeAndSave("publish")}
        >
          Publiser
        </button>
      </div>
      {error ? <p className="mt-2 text-[11px] text-red-700">{error}</p> : null}
      {toast ? (
        <p className="mt-2 text-[11px] text-emerald-800" role="status">
          {toast}
        </p>
      ) : null}
    </section>
  );
}
