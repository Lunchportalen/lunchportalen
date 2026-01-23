"use client";

import { useMemo, useState } from "react";

type LocationRow = {
  id: string;
  label: string;
  name: string;
};

type ApiOk = {
  ok: true;
  email: string;
  role: string;
  company_id: string;
  location_id: string;
};

type ApiErr = {
  ok: false;
  error: string;
  message?: string;
  detail?: any;
};

function cleanEmail(v: string) {
  return String(v ?? "").trim().toLowerCase();
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ChangeCompanyAdmin(props: {
  companyId: string;
  companyName: string;
  locations: LocationRow[];
}) {
  const { companyId, companyName, locations } = props;

  const [email, setEmail] = useState("");
  const [locationId, setLocationId] = useState<string>(locations?.[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [ok, setOk] = useState<ApiOk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    const e = cleanEmail(email);
    if (!e || !isEmail(e)) return false;
    if (!locationId) return false;
    return true;
  }, [email, locationId]);

  async function submit() {
    setErr(null);
    setOk(null);

    const e = cleanEmail(email);
    if (!isEmail(e)) {
      setErr("Ugyldig e-postadresse.");
      return;
    }
    if (!locationId) {
      setErr("Velg lokasjon.");
      return;
    }

    setSubmitting(true);
    try {
      const r = await fetch("/api/superadmin/users/set-scope", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: e,
          role: "company_admin",
          company_id: companyId,
          location_id: locationId,
        }),
      });

      const data = (await r.json().catch(() => null)) as (ApiOk | ApiErr | null);

      if (!r.ok || !data || (data as ApiErr).ok === false) {
        const msg =
          (data as ApiErr | null)?.message ||
          (data as ApiErr | null)?.error ||
          `HTTP ${r.status}`;
        throw new Error(msg);
      }

      setOk(data as ApiOk);
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke bytte admin.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold">Bytt firma-admin</div>
        <div className="text-xs text-[rgb(var(--lp-muted))]">
          Setter valgt e-post som <span className="font-medium">company_admin</span> for{" "}
          <span className="font-medium">{companyName}</span>. Dette bruker superadmin-gateway (audit-vennlig) og endrer
          både profil + auth metadata.
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-1">
          <label className="text-sm font-medium">Ny admin (e-post)</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="navn@firma.no"
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
            autoComplete="email"
          />
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Brukeren må eksistere i systemet (auth.users + profiles). Hvis ikke: opprett/inviter først.
          </div>
        </div>

        <div className="md:col-span-1">
          <label className="text-sm font-medium">Lokasjon</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 w-full rounded-2xl bg-white px-4 py-3 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label} · {l.name}
              </option>
            ))}
          </select>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Valgt lokasjon blir standard scope for admin.
          </div>
        </div>
      </div>

      {err ? (
        <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">{err}</div>
      ) : null}

      {ok ? (
        <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <div className="font-medium">Oppdatert!</div>
          <div className="mt-1 text-xs">
            {ok.email} → <span className="font-mono">{ok.role}</span> · company_id{" "}
            <span className="font-mono">{ok.company_id}</span> · location_id{" "}
            <span className="font-mono">{ok.location_id}</span>
          </div>
          <div className="mt-2 text-xs text-emerald-900/80">
            Tips: Be brukeren logge ut/inn for å få ny rolle umiddelbart i UI.
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[rgb(var(--lp-muted))]">
          Dette endrer kun ny admin. (Hvis du vil: vi kan legge til “degrader gammel admin” som eget steg med audit.)
        </div>

        <button
          disabled={!canSubmit || submitting}
          onClick={submit}
          className={[
            "rounded-2xl px-5 py-3 text-sm font-medium ring-1 transition",
            "disabled:cursor-not-allowed disabled:opacity-60",
            "bg-black text-white ring-black hover:bg-black/90",
          ].join(" ")}
        >
          {submitting ? "Oppdaterer…" : "Bytt admin"}
        </button>
      </div>
    </div>
  );
}
