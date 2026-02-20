// app/superadmin/companies/[id]/agreement/AgreementClient.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { NormalizedAgreement, PlanTier, TierByDay, WeekdayKey } from "@/lib/agreements/types";

type ApiOk = { ok: true; rid?: string; agreement: NormalizedAgreement | null };
type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };
type ApiRes = ApiOk | ApiErr;

const DAYS: { key: WeekdayKey; label: string }[] = [
  { key: "MON", label: "Man" },
  { key: "TUE", label: "Tir" },
  { key: "WED", label: "Ons" },
  { key: "THU", label: "Tor" },
  { key: "FRI", label: "Fre" },
];

const DAY_ORDER: Record<WeekdayKey, number> = { MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5 };

function Badge({ children, tone }: { children: any; tone: "green" | "yellow" | "red" | "neutral" }) {
  const cls =
    tone === "green"
      ? "bg-green-100 text-green-800"
      : tone === "yellow"
        ? "bg-yellow-100 text-yellow-800"
        : tone === "red"
          ? "bg-red-100 text-red-800"
          : "bg-neutral-100 text-neutral-800";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${cls}`}>{children}</span>;
}

function toneForStatus(s: string) {
  if (s === "ACTIVE") return "green";
  if (s === "PAUSED") return "yellow";
  if (s === "CLOSED") return "red";
  return "neutral";
}

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) throw new Error(`Tom respons (HTTP ${res.status})`);
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`Ugyldig JSON (HTTP ${res.status})`);
  }
}

function apiErrorMessage(x: any) {
  if (!x) return "Ukjent feil";
  if (typeof x === "string") return x;
  return String(x.message || x.error || "Ukjent feil");
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function sortDays(days: WeekdayKey[]) {
  return [...days].sort((a, b) => DAY_ORDER[a] - DAY_ORDER[b]);
}

export default function AgreementClient({ companyId }: { companyId: string }) {
  const [pending, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [agreement, setAgreement] = useState<NormalizedAgreement | null>(null);

  // Form state
  const [status, setStatus] = useState<"ACTIVE" | "PAUSED" | "CLOSED">("ACTIVE");
  const [mode, setMode] = useState<"SINGLE" | "BY_DAY">("SINGLE");
  const [planTier, setPlanTier] = useState<PlanTier>("BASIS");
  const [tierByDay, setTierByDay] = useState<TierByDay>({} as any);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState<string>("");
  const [bindingMonths, setBindingMonths] = useState<string>("12");

  const [deliveryDays, setDeliveryDays] = useState<WeekdayKey[]>(["MON", "TUE", "WED", "THU", "FRI"]);
  const [cutoffTime, setCutoffTime] = useState("08:00");
  const [timezone, setTimezone] = useState("Europe/Oslo");

  // ---------- derived ----------
  const dirty = useMemo(() => {
    // Hvis ingen agreement i DB, så er den "dirty" hvis bruker endrer noe fra defaults
    // (vi returnerer true for å tillate "Lagre" på ny avtale)
    if (!agreement) return true;

    const bm = bindingMonths.trim() ? Number(bindingMonths) : null;
    const bmA = agreement.binding_months ?? null;

    const end = endDate.trim() ? endDate.trim() : null;

    const same =
      agreement.status === status &&
      agreement.mode === mode &&
      agreement.plan_tier === planTier &&
      JSON.stringify(agreement.tier_by_day ?? {}) === JSON.stringify(tierByDay ?? {}) &&
      agreement.start_date === startDate &&
      (agreement.end_date ?? null) === (end ?? null) &&
      bmA === (Number.isFinite(bm as any) ? (bm as any) : null) &&
      JSON.stringify(sortDays(agreement.delivery_days)) === JSON.stringify(sortDays(deliveryDays)) &&
      agreement.cutoff_time === cutoffTime &&
      agreement.timezone === timezone;

    return !same;
  }, [agreement, status, mode, planTier, tierByDay, startDate, endDate, bindingMonths, deliveryDays, cutoffTime, timezone]);

  function applyFromAgreement(a: NormalizedAgreement | null) {
    setAgreement(a);

    if (!a) {
      // defaults
      setStatus("ACTIVE");
      setMode("SINGLE");
      setPlanTier("BASIS");
      setTierByDay({} as any);
      setStartDate(todayISO());
      setEndDate("");
      setBindingMonths("12");
      setDeliveryDays(["MON", "TUE", "WED", "THU", "FRI"]);
      setCutoffTime("08:00");
      setTimezone("Europe/Oslo");
      return;
    }

    setStatus(a.status);
    setMode(a.mode);
    setPlanTier(a.plan_tier);
    setTierByDay((a.tier_by_day ?? {}) as any);

    setStartDate(a.start_date || todayISO());
    setEndDate(a.end_date ?? "");
    setBindingMonths(a.binding_months == null ? "" : String(a.binding_months));

    setDeliveryDays(sortDays(a.delivery_days || ["MON", "TUE", "WED", "THU", "FRI"]));
    setCutoffTime(a.cutoff_time || "08:00");
    setTimezone(a.timezone || "Europe/Oslo");
  }

  async function load() {
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/superadmin/companies/${companyId}/agreement`, { cache: "no-store" });
      const json = (await readJson(res)) as ApiRes;
      if (!json.ok) throw new Error(apiErrorMessage(json));
      applyFromAgreement(json.agreement);
    } catch (e: any) {
      setErr(e?.message || "Kunne ikke laste avtale");
      // fallback defaults
      applyFromAgreement(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  function toggleDeliveryDay(d: WeekdayKey) {
    setDeliveryDays((prev) => {
      const has = prev.includes(d);
      const next = has ? prev.filter((x) => x !== d) : [...prev, d];
      return sortDays(next);
    });
  }

  function setDayTier(day: WeekdayKey, tier: PlanTier | "NONE") {
    setTierByDay((prev) => {
      const next: any = { ...(prev || {}) };
      if (tier === "NONE") delete next[day];
      else next[day] = tier;
      return next;
    });
  }

  async function save() {
    setErr(null);

    // Minimal UI-validering (API validerer hardt uansett)
    if (!startDate) return setErr("Startdato mangler");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return setErr("Startdato må være YYYY-MM-DD");
    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return setErr("Sluttdato må være YYYY-MM-DD");
    if (!/^\d{2}:\d{2}$/.test(cutoffTime)) return setErr("Cut-off må være HH:MM");
    if (!deliveryDays.length) return setErr("Velg minst én leveringsdag");

    if (mode === "BY_DAY") {
      const keys = Object.keys(tierByDay || {});
      if (!keys.length) return setErr("Velg minst én dag i 'Plan per dag' (eller bytt til 'Enkel plan')");
    }

    const payload: any = {
      status,
      mode,
      plan_tier: planTier,
      tier_by_day: mode === "BY_DAY" ? tierByDay : null,
      start_date: startDate,
      end_date: endDate ? endDate : null,
      binding_months: bindingMonths.trim() ? Number(bindingMonths) : null,
      delivery_days: deliveryDays,
      cutoff_time: cutoffTime,
      timezone,
    };

    startTransition(async () => {
      try {
        const res = await fetch(`/api/superadmin/companies/${companyId}/agreement`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await readJson(res)) as ApiRes;
        if (!json.ok) throw new Error(apiErrorMessage(json));
        applyFromAgreement(json.agreement);
      } catch (e: any) {
        setErr(e?.message || "Kunne ikke lagre");
      }
    });
  }

  async function quickStatus(next: "ACTIVE" | "PAUSED" | "CLOSED") {
    setErr(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/superadmin/companies/${companyId}/agreement/status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        const json = await readJson(res);
        if (!json?.ok) throw new Error(apiErrorMessage(json));
        setStatus(next);
        await load(); // refetch for å få fasit fra DB
      } catch (e: any) {
        setErr(e?.message || "Kunne ikke oppdatere status");
      }
    });
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="text-sm text-neutral-500">Laster avtale…</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status + quick actions */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="text-sm text-neutral-500">Status</div>
            <Badge tone={toneForStatus(status) as any}>{status}</Badge>
            {agreement?.id ? <span className="text-xs text-neutral-400">({agreement.id})</span> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => quickStatus("ACTIVE")}
              disabled={pending}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
            >
              Sett ACTIVE
            </button>
            <button
              onClick={() => quickStatus("PAUSED")}
              disabled={pending}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
            >
              Sett PAUSED
            </button>
            <button
              onClick={() => quickStatus("CLOSED")}
              disabled={pending}
              className="rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
            >
              Sett CLOSED
            </button>
          </div>
        </div>

        {err ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
        ) : null}
      </div>

      {/* Binding / leveringsrammer */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Binding / periode</div>

          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs text-neutral-500">Startdato (YYYY-MM-DD)</span>
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="2026-01-25"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-neutral-500">Sluttdato (valgfritt)</span>
              <input
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="YYYY-MM-DD"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-neutral-500">Binding (mnd) (valgfritt)</span>
              <input
                value={bindingMonths}
                onChange={(e) => setBindingMonths(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="12"
                inputMode="numeric"
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-3 text-sm font-semibold">Leveringsrammer</div>

          <div className="grid gap-3">
            <div>
              <div className="mb-1 text-xs text-neutral-500">Leveringsdager</div>
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => {
                  const on = deliveryDays.includes(d.key);
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDeliveryDay(d.key)}
                      className={`rounded-xl border px-3 py-2 text-sm ${on ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 text-xs text-neutral-400">Tips: Man–Fre er standard.</div>
            </div>

            <label className="grid gap-1">
              <span className="text-xs text-neutral-500">Cut-off (HH:MM)</span>
              <input
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="08:00"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs text-neutral-500">Timezone</span>
              <input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="rounded-xl border px-3 py-2 text-sm"
                placeholder="Europe/Oslo"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Plan */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Plan</div>
            <div className="text-xs text-neutral-500">Støtter både én plan, eller plan per ukedag.</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode("SINGLE")}
              className={`rounded-xl border px-3 py-2 text-sm ${mode === "SINGLE" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
            >
              Enkel plan
            </button>
            <button
              type="button"
              onClick={() => setMode("BY_DAY")}
              className={`rounded-xl border px-3 py-2 text-sm ${mode === "BY_DAY" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
            >
              Plan per dag
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* fallback */}
          <div className="rounded-2xl border p-4">
            <div className="mb-2 text-xs font-semibold text-neutral-700">Fallback-plan</div>
            <div className="mb-3 text-xs text-neutral-500">
              Brukes alltid som standard, og som fallback hvis en dag ikke er definert i “Plan per dag”.
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPlanTier("BASIS")}
                className={`rounded-xl border px-3 py-2 text-sm ${planTier === "BASIS" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
              >
                BASIS
              </button>
              <button
                type="button"
                onClick={() => setPlanTier("LUXUS")}
                className={`rounded-xl border px-3 py-2 text-sm ${planTier === "LUXUS" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
              >
                LUXUS
              </button>
            </div>
          </div>

          {/* by-day */}
          <div className="rounded-2xl border p-4">
            <div className="mb-2 text-xs font-semibold text-neutral-700">Plan per dag</div>
            <div className="mb-3 text-xs text-neutral-500">Kun aktiv når “Plan per dag” er valgt.</div>

            <div className={`grid gap-2 ${mode !== "BY_DAY" ? "opacity-50 pointer-events-none" : ""}`}>
              {DAYS.map((d) => {
                const v = (tierByDay as any)?.[d.key] as PlanTier | undefined;
                const has = v === "BASIS" || v === "LUXUS";

                return (
                  <div key={d.key} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                    <div className="text-sm font-medium">{d.label}</div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDayTier(d.key, "NONE")}
                        className={`rounded-xl border px-3 py-1.5 text-sm ${!has ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"}`}
                      >
                        Av
                      </button>

                      <button
                        type="button"
                        onClick={() => setDayTier(d.key, "BASIS")}
                        className={`rounded-xl border px-3 py-1.5 text-sm ${
                          v === "BASIS" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"
                        }`}
                      >
                        BASIS
                      </button>

                      <button
                        type="button"
                        onClick={() => setDayTier(d.key, "LUXUS")}
                        className={`rounded-xl border px-3 py-1.5 text-sm ${
                          v === "LUXUS" ? "bg-neutral-900 text-white" : "hover:bg-neutral-50"
                        }`}
                      >
                        LUXUS
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="mt-1 text-xs text-neutral-400">
                Tips: Velg bare de dagene som skal avvike fra fallback-planen.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-4">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge tone={dirty ? "yellow" : "green"}>{dirty ? "Ulagrede endringer" : "Alt lagret"}</Badge>
              {pending ? <span className="text-xs text-neutral-500">Jobber…</span> : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => load()}
                disabled={pending}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50 disabled:opacity-60"
              >
                Oppdater
              </button>
              <button
                type="button"
                onClick={save}
                disabled={pending || !dirty}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Lagre
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
