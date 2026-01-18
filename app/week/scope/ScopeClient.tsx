// app/week/scope/ScopeClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Company = { id: string; name: string };
type Location = { id: string; company_id: string; name: string };

type LoadState =
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "ready"; companies: Company[]; locations: Location[] };

export default function ScopeClient({ nextPath }: { nextPath: string }) {
  const router = useRouter();

  const [state, setState] = useState<LoadState>({ type: "loading" });
  const [companyId, setCompanyId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setState({ type: "loading" });
    try {
      const r = await fetch("/api/scope/options", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.message || j?.error || "Kunne ikke hente valg");
      setState({ type: "ready", companies: j.companies, locations: j.locations });

      // auto-select første firma hvis kun ett
      if (j.companies?.length === 1) setCompanyId(j.companies[0].id);
    } catch (e: any) {
      setState({ type: "error", message: e?.message || "Ukjent feil" });
    }
  }

  useEffect(() => {
    load();
  }, []);

  const locationOptions = useMemo(() => {
    if (state.type !== "ready") return [];
    return state.locations.filter((l) => l.company_id === companyId);
  }, [state, companyId]);

  useEffect(() => {
    // reset location når firma endres
    setLocationId("");
  }, [companyId]);

  async function save() {
    if (!companyId || !locationId) return;
    setSaving(true);
    try {
      const r = await fetch("/api/profile/set-scope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, locationId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.message || j?.error || "Kunne ikke lagre scope");

      router.replace(nextPath);
      router.refresh();
    } catch (e: any) {
      alert(e?.message || "Feil");
    } finally {
      setSaving(false);
    }
  }

  if (state.type === "loading") {
    return (
      <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
        Laster valg…
      </div>
    );
  }

  if (state.type === "error") {
    return (
      <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="text-sm font-semibold">Kunne ikke laste</div>
        <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{state.message}</div>
        <button className="lp-btn mt-4" onClick={load}>
          Prøv igjen
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="lp-label">Firma</div>
            <select
              className="lp-input mt-1"
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Velg firma</option>
              {state.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="lp-label">Lokasjon</div>
            <select
              className="lp-input mt-1"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              disabled={!companyId}
            >
              <option value="">{companyId ? "Velg lokasjon" : "Velg firma først"}</option>
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="lp-btn-primary"
            onClick={save}
            disabled={!companyId || !locationId || saving}
          >
            {saving ? "Lagrer…" : "Lagre og gå til uke"}
          </button>

          <button className="lp-btn" onClick={() => router.replace("/admin")}>
            Avbryt
          </button>
        </div>
      </div>

      <div className="text-xs text-[rgb(var(--lp-muted))]">
        Scope lagres på profilen din og kan endres senere ved behov.
      </div>
    </div>
  );
}
