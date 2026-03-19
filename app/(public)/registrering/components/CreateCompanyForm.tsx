"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
type Tier = "BASIS" | "LUXUS";

const DAYS: Array<{ key: DayKey; label: string }> = [
  { key: "monday", label: "Mandag" },
  { key: "tuesday", label: "Tirsdag" },
  { key: "wednesday", label: "Onsdag" },
  { key: "thursday", label: "Torsdag" },
  { key: "friday", label: "Fredag" },
];

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}
function toInt(v: unknown) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}
function toPrice(v: unknown) {
  const n = Number(String(v ?? "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : NaN;
}

type Suggestion = { id: string; title: string; subtitle?: string | null };

type DayState = {
  enabled: boolean;
  tier: Tier;
  price: number; // per kuvert eks mva
};

type FormState = {
  company_name: string;
  orgnr: string;
  employee_count: string;

  address: string;
  postal_code: string;
  city: string;

  delivery_from: string; // "08:30"
  delivery_to: string; // "10:00"

  terms_ok: boolean;
  credit_ok: boolean;

  days: Record<DayKey, DayState>;
};

const defaultDays: Record<DayKey, DayState> = {
  monday: { enabled: true, tier: "BASIS", price: 90 },
  tuesday: { enabled: true, tier: "BASIS", price: 90 },
  wednesday: { enabled: true, tier: "BASIS", price: 90 },
  thursday: { enabled: true, tier: "BASIS", price: 90 },
  friday: { enabled: true, tier: "LUXUS", price: 130 },
};

export default function CreateCompanyForm() {
  const [s, setS] = useState<FormState>({
    company_name: "",
    orgnr: "",
    employee_count: "20",

    address: "",
    postal_code: "",
    city: "",

    delivery_from: "08:30",
    delivery_to: "10:00",

    terms_ok: false,
    credit_ok: false,

    days: defaultDays,
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<{ company_id: string; location_id: string } | null>(null);

  // Address suggestions
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const suggestAbort = useRef<AbortController | null>(null);

  // Keep q synced with address input
  useEffect(() => {
    setQ(s.address);
  }, [s.address]);

  // Debounced search
  useEffect(() => {
    const query = safeStr(q);
    if (query.length < 3) {
      setSuggestions([]);
      setSuggestOpen(false);
      return;
    }

    const t = setTimeout(async () => {
      try {
        suggestAbort.current?.abort();
        const ac = new AbortController();
        suggestAbort.current = ac;

        // ✅ Du kan peke dette til din faktiske autosuggest-endpoint
        const res = await fetch(`/api/address/search?q=${encodeURIComponent(query)}`, {
          signal: ac.signal,
          cache: "no-store",
        });

        if (!res.ok) {
          setSuggestions([]);
          setSuggestOpen(false);
          return;
        }

        const data = (await res.json()) as { items?: Suggestion[] };
        const items = Array.isArray(data?.items) ? data.items : [];
        setSuggestions(items.slice(0, 8));
        setSuggestOpen(items.length > 0);
      } catch {
        // ignore aborts
      }
    }, 220);

    return () => clearTimeout(t);
  }, [q]);

  async function resolveSuggestion(id: string) {
    try {
      setErr(null);

      // ✅ Du kan peke dette til din faktiske resolve-endpoint
      const res = await fetch(`/api/address/resolve?id=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = (await res.json()) as {
        address?: string;
        postalCode?: string;
        city?: string;
      };

      const nextAddress = safeStr(data.address) || s.address;
      const nextPostal = safeStr(data.postalCode) || s.postal_code;
      const nextCity = safeStr(data.city) || s.city;

      setS((p) => ({
        ...p,
        address: nextAddress,
        postal_code: nextPostal,
        city: nextCity,
      }));

      setSuggestOpen(false);
    } catch {
      // ignore
    }
  }

  function validate(): string | null {
    if (!safeStr(s.company_name)) return "Bedriftsnavn må fylles ut.";
    const emp = toInt(s.employee_count);
    if (!Number.isFinite(emp) || emp < 20) return "Antall ansatte må være minst 20.";

    if (!safeStr(s.address)) return "Adresse må fylles ut.";
    if (!/^[0-9]{4}$/.test(safeStr(s.postal_code))) return "Postnummer må være 4 siffer.";
    if (!safeStr(s.city)) return "Poststed må fylles ut.";

    // delivery window
    if (!safeStr(s.delivery_from) || !safeStr(s.delivery_to)) return "Leveringsvindu må fylles ut.";
    if (safeStr(s.delivery_from) >= safeStr(s.delivery_to)) return "Leveringsvindu fra må være før til.";

    // days
    const anyEnabled = DAYS.some((d) => s.days[d.key]?.enabled);
    if (!anyEnabled) return "Velg minst én leveringsdag.";

    for (const d of DAYS) {
      const st = s.days[d.key];
      if (!st?.enabled) continue;
      if (st.tier !== "BASIS" && st.tier !== "LUXUS") return `Ugyldig nivå for ${d.label}.`;
      if (!Number.isFinite(st.price) || st.price <= 0) return `Pris må være > 0 for ${d.label}.`;
    }

    if (!s.terms_ok) return "Du må akseptere avtalevilkårene.";
    if (!s.credit_ok) return "Du må samtykke til kredittvurdering.";

    return null;
  }

  function buildPayload() {
    // API route forventer felter som:
    // monday_enabled, monday_tier, monday_price, ...
    const payload: any = {
      company_name: safeStr(s.company_name),
      orgnr: safeStr(s.orgnr),
      employee_count: toInt(s.employee_count),

      address: safeStr(s.address),
      postal_code: safeStr(s.postal_code),
      city: safeStr(s.city),

      delivery_from: safeStr(s.delivery_from),
      delivery_to: safeStr(s.delivery_to),
    };

    for (const d of DAYS) {
      const st = s.days[d.key];
      payload[`${d.key}_enabled`] = !!st.enabled;
      payload[`${d.key}_tier`] = st.tier;
      payload[`${d.key}_price`] = st.price;
    }

    return payload;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setBusy(true);
    try {
      const payload = buildPayload();

      const res = await fetch("/api/company/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setErr(data?.message || "Kunne ikke opprette firma. Sjekk feltene og prøv igjen.");
        return;
      }

      const company_id = data?.data?.company_id || data?.company_id;
      const location_id = data?.data?.location_id || data?.location_id;

      if (!company_id || !location_id) {
        setErr("Opprettet, men mangler kvittering (company/location). Dette skal ikke skje.");
        return;
      }

      setOk({ company_id, location_id });
    } finally {
      setBusy(false);
    }
  }

  const totalDaysEnabled = useMemo(() => DAYS.filter((d) => s.days[d.key].enabled).length, [s.days]);

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Header */}
      <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-5 shadow-[var(--lp-shadow-soft)]">
        <h1 className="text-xl font-semibold">Opprett bedrift</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Adresse kan foreslås automatisk. Postnummer og poststed kan alltid korrigeres.
        </p>

        {err ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {err}
          </div>
        ) : null}

        {ok ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            Opprettet! Company: <span className="font-mono">{ok.company_id}</span> – Location:{" "}
            <span className="font-mono">{ok.location_id}</span>
          </div>
        ) : null}
      </div>

      {/* Company */}
      <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-5 shadow-[var(--lp-shadow-soft)]">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Bedriftsnavn *</span>
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2"
              value={s.company_name}
              onChange={(e) => setS((p) => ({ ...p, company_name: e.target.value }))}
              autoComplete="organization"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Organisasjonsnummer</span>
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2"
              value={s.orgnr}
              onChange={(e) => setS((p) => ({ ...p, orgnr: e.target.value }))}
              inputMode="numeric"
              placeholder="9 siffer"
            />
          </label>

          <label className="block md:col-span-2">
            <span className="text-sm font-medium">Hvor mange ansatte? *</span>
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2"
              value={s.employee_count}
              onChange={(e) => setS((p) => ({ ...p, employee_count: e.target.value }))}
              inputMode="numeric"
            />
            <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Minimum 20 ansatte.</p>
          </label>
        </div>
      </div>

      {/* Address + delivery window */}
      <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-5 shadow-[var(--lp-shadow-soft)]">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative md:col-span-2">
            <label className="block">
              <span className="text-sm font-medium">Adresse *</span>
              <input
                className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] px-3 py-2"
                value={s.address}
                onChange={(e) => setS((p) => ({ ...p, address: e.target.value }))}
                onFocus={() => setSuggestOpen(suggestions.length > 0)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
                autoComplete="street-address"
              />
            </label>

            {suggestOpen ? (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-[rgb(var(--lp-border))] bg-white shadow-[var(--lp-shadow-soft)]">
                {suggestions.map((it) => (
                  <button
                    type="button"
                    key={it.id}
                    className="lp-motion-row block w-full px-3 py-2 text-left hover:bg-[rgb(var(--lp-surface-2))]"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => resolveSuggestion(it.id)}
                  >
                    <div className="text-sm font-medium">{it.title}</div>
                    {it.subtitle ? <div className="text-xs text-[rgb(var(--lp-muted))]">{it.subtitle}</div> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="block">
            <span className="text-sm font-medium">Postnummer *</span>
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2"
              value={s.postal_code}
              onChange={(e) => setS((p) => ({ ...p, postal_code: e.target.value }))}
              inputMode="numeric"
              placeholder="7037"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Poststed *</span>
            <input
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2"
              value={s.city}
              onChange={(e) => setS((p) => ({ ...p, city: e.target.value }))}
              placeholder="Trondheim"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Leveringsvindu fra *</span>
            <input
              type="time"
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2"
              value={s.delivery_from}
              onChange={(e) => setS((p) => ({ ...p, delivery_from: e.target.value }))}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium">Leveringsvindu til *</span>
            <input
              type="time"
              className="mt-1 w-full rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2"
              value={s.delivery_to}
              onChange={(e) => setS((p) => ({ ...p, delivery_to: e.target.value }))}
            />
          </label>
        </div>
      </div>

      {/* Agreement */}
      <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-5 shadow-[var(--lp-shadow-soft)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Avtale (velg nivå per dag)</h2>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Velg hvilke dager dere ønsker levering, og om dagen er Basis eller Luxus. Pris per kuvert eks. mva.
            </p>
          </div>
          <div className="text-sm text-[rgb(var(--lp-muted))]">{totalDaysEnabled} dager valgt</div>
        </div>

        <div className="mt-4 space-y-3">
          {DAYS.map((d) => {
            const st = s.days[d.key];
            return (
              <div
                key={d.key}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 py-3"
              >
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={st.enabled}
                    onChange={(e) =>
                      setS((p) => ({
                        ...p,
                        days: { ...p.days, [d.key]: { ...p.days[d.key], enabled: e.target.checked } },
                      }))
                    }
                    className="h-5 w-5"
                  />
                  <span className="font-medium">{d.label}</span>
                </label>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!st.enabled}
                    onClick={() =>
                      setS((p) => ({
                        ...p,
                        days: { ...p.days, [d.key]: { ...p.days[d.key], tier: "BASIS" } },
                      }))
                    }
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold",
                      st.enabled && st.tier === "BASIS"
                        ? "bg-black text-white"
                        : "border border-[rgb(var(--lp-border))] bg-white text-black",
                      !st.enabled ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    Basis
                  </button>

                  <button
                    type="button"
                    disabled={!st.enabled}
                    onClick={() =>
                      setS((p) => ({
                        ...p,
                        days: { ...p.days, [d.key]: { ...p.days[d.key], tier: "LUXUS" } },
                      }))
                    }
                    className={[
                      "rounded-full px-4 py-2 text-sm font-semibold",
                      st.enabled && st.tier === "LUXUS"
                        ? "bg-black text-white"
                        : "border border-[rgb(var(--lp-border))] bg-white text-black",
                      !st.enabled ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    Luxus
                  </button>

                  <span className="ml-3 text-sm text-[rgb(var(--lp-muted))]">Pris *</span>
                  <input
                    disabled={!st.enabled}
                    className="w-24 rounded-xl border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                    value={String(st.price)}
                    onChange={(e) => {
                      const n = toPrice(e.target.value);
                      setS((p) => ({
                        ...p,
                        days: { ...p.days, [d.key]: { ...p.days[d.key], price: Number.isFinite(n) ? n : p.days[d.key].price } },
                      }));
                    }}
                    inputMode="decimal"
                  />
                  <span className="text-sm text-[rgb(var(--lp-muted))]">kr/kuvert eks. mva</span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface-2))] p-4 text-sm">
          <div className="font-semibold">Hva skjer etter registrering?</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-[rgb(var(--lp-muted))]">
            <li>Bedriften opprettes med faste rammer</li>
            <li>Du får tilgang som admin</li>
            <li>Ansatte kan legges til når du er klar</li>
            <li>Lunsj bestilles med cut-off kl. 08:00</li>
          </ul>
        </div>
      </div>

      {/* Consents + submit */}
      <div className="rounded-[var(--lp-radius-card)] border border-[rgb(var(--lp-border))] bg-white p-5 shadow-[var(--lp-shadow-soft)]">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={s.terms_ok}
            onChange={(e) => setS((p) => ({ ...p, terms_ok: e.target.checked }))}
            className="mt-1 h-5 w-5"
          />
          <span className="text-sm">
            Jeg har lest og aksepterer <Link className="underline" href="/vilkar">avtalevilkårene</Link> *
          </span>
        </label>

        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            checked={s.credit_ok}
            onChange={(e) => setS((p) => ({ ...p, credit_ok: e.target.checked }))}
            className="mt-1 h-5 w-5"
          />
          <span className="text-sm">Jeg samtykker til kredittvurdering av firmaet (utføres i Tripletex) *</span>
        </label>

        <p className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
          Avtalen har 12 måneders bindingstid. Oppsigelse: 3 mnd før utløpt bindingstid. Alle priser faktureres eks. mva.
        </p>

        <button
          type="submit"
          disabled={busy}
          className={[
            "mt-4 w-full rounded-2xl px-4 py-3 text-sm font-semibold",
            "bg-black text-white shadow-[var(--lp-shadow-soft)]",
            busy ? "opacity-70" : "hover:opacity-95",
          ].join(" ")}
        >
          {busy ? "Oppretter..." : "Opprett bedrift"}
        </button>
      </div>
    </form>
  );
}
