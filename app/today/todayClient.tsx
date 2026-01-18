"use client";

import React, { useEffect, useMemo, useState } from "react";

type Choice = { key: string; label?: string };

type DayChoiceRow = {
  id: string;
  date: string;
  choice_key: string;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  tier?: "BASIS" | "PREMIUM" | null;
};

type TodayState = {
  ok: boolean;
  date: string;

  // vi støtter begge varianter (legacy + ny)
  locked?: boolean;
  cutoffTime?: string;
  cutoff?: { locked: boolean; cutoffTime: string; nowISO?: string };

  menuAvailable: boolean;
  canAct?: boolean;
  reason?: string;
  message?: string;
  rid?: string;

  dayChoice: DayChoiceRow | null;
  tierToday?: "BASIS" | "PREMIUM" | null;

  // ✅ Kontraktstyrte valg (anbefalt å returnere fra /api/today)
  allowedChoices?: Choice[] | null;

  error?: string;
  detail?: string;
};

type SetChoiceResp = {
  ok: boolean;
  rid?: string;
  error?: string;
  message?: string;
  detail?: string;
  locked?: boolean;
  cutoffTime?: string;
  canAct?: boolean;

  date?: string;
  choice_key?: string;
  note?: string | null;
  tier?: "BASIS" | "PREMIUM";
  updated_at?: string;
};

function formatOslo(ts?: string | null) {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: "Europe/Oslo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return ts || "";
  }
}

type PillTone = "ok" | "neutral" | "warn" | "danger";
function Pill({ tone, label }: { tone: PillTone; label: string }) {
  const cls =
    tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "danger"
      ? "border-red-200 bg-red-50 text-red-900"
      : "border-slate-200 bg-slate-50 text-slate-900";

  const dot =
    tone === "ok"
      ? "bg-emerald-500"
      : tone === "warn"
      ? "bg-amber-500"
      : tone === "danger"
      ? "bg-red-500"
      : "bg-slate-500";

  return (
    <div
      className={[
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        cls,
      ].join(" ")}
    >
      <span aria-hidden className={["h-2 w-2 rounded-full", dot].join(" ")} />
      {label}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div className="text-sm text-[rgb(var(--lp-muted))]">{label}</div>
      <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">{value}</div>
    </div>
  );
}

const FALLBACK_CHOICES: Choice[] = [
  { key: "salatbar", label: "Salatbar" },
  { key: "paasmurt", label: "Påsmurt" },
  { key: "varmmat", label: "Varmmat" },
  { key: "sushi", label: "Sushi" },
  { key: "poke", label: "Pokébowl" },
  { key: "thai", label: "Thaimat" },
];

export default function TodayClient(props: {
  dateISO: string;
  cutoffLocked: boolean;
  cutoffTime: string;
  menuAvailable: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<TodayState | null>(null);

  const [choiceKey, setChoiceKey] = useState("");
  const [note, setNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setToast(null);

    try {
      const res = await fetch("/api/today", { cache: "no-store" });
      const json = (await res.json()) as TodayState;

      setState(json);

      if (json?.ok) {
        const dc = json.dayChoice;
        if (dc?.choice_key) setChoiceKey(dc.choice_key);
        if (typeof dc?.note === "string") setNote(dc.note ?? "");
      }

      if (!res.ok && !json?.message) setToast("Kunne ikke hente status.");
      if (json?.message) setToast(json.message);
    } catch {
      setToast("Kunne ikke hente status.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(() => {
      if (!busy) refresh();
    }, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Bruk API-fasit der det finnes
  const effectiveLocked = useMemo(() => {
    if (state?.ok) return state.cutoff?.locked ?? state.locked ?? props.cutoffLocked;
    return props.cutoffLocked;
  }, [state, props.cutoffLocked]);

  const effectiveCutoffTime = useMemo(() => {
    if (state?.ok) return state.cutoff?.cutoffTime ?? state.cutoffTime ?? props.cutoffTime ?? "08:00";
    return props.cutoffTime ?? "08:00";
  }, [state, props.cutoffTime]);

  const effectiveMenu = useMemo(() => {
    if (state?.ok) return !!state.menuAvailable;
    return props.menuAvailable;
  }, [state, props.menuAvailable]);

  // ✅ Bruk kontraktstyrte valg fra API om mulig
  const choices: Choice[] = useMemo(() => {
    const apiChoices = state?.ok ? state.allowedChoices : null;
    if (Array.isArray(apiChoices) && apiChoices.length > 0) return apiChoices;
    return FALLBACK_CHOICES;
  }, [state]);

  const choiceLabel = useMemo(() => {
    const hit = choices.find((c) => c.key === choiceKey);
    return hit?.label ?? choiceKey;
  }, [choiceKey, choices]);

  // API canAct er fasit når den finnes
  const canAct = useMemo(() => {
    if (state?.ok && typeof state.canAct === "boolean") return state.canAct && !busy;
    return !effectiveLocked && effectiveMenu && !busy;
  }, [state, effectiveLocked, effectiveMenu, busy]);

  const dc = state?.ok ? state.dayChoice : null;
  const tier = dc?.tier ?? state?.tierToday ?? null;

  // ✅ Dato som skal lagres: bruk API-date hvis tilgjengelig
  const effectiveDateISO = useMemo(() => {
    if (state?.ok && typeof state.date === "string" && state.date) return state.date;
    return props.dateISO;
  }, [state, props.dateISO]);

  // Enterprise state model
  const view = useMemo(() => {
    if (loading) {
      return {
        pill: <Pill tone="neutral" label="Henter status" />,
        title: "Status oppdateres",
        subtitle: "Henter data fra systemet.",
        tone: "neutral" as const,
      };
    }

    if (!state?.ok) {
      return {
        pill: <Pill tone="danger" label="Kunne ikke hente" />,
        title: "Status utilgjengelig",
        subtitle: state?.rid ? `Ref: ${state.rid}` : "Prøv igjen.",
        tone: "danger" as const,
      };
    }

    if (state.reason === "PROFILE_MISSING_SCOPE") {
      return {
        pill: <Pill tone="warn" label="Mangler tilgang" />,
        title: "Bestilling utilgjengelig",
        subtitle: "Kontoen mangler firmatilknytning/leveringssted.",
        tone: "warn" as const,
      };
    }

    if (!effectiveMenu) {
      return {
        pill: <Pill tone="warn" label="Utilgjengelig" />,
        title: "Bestilling utilgjengelig",
        subtitle: "Dagens meny er ikke publisert.",
        tone: "warn" as const,
      };
    }

    if (effectiveLocked) {
      return {
        pill: <Pill tone="neutral" label="Endringer stengt" />,
        title: "Bestilling stengt",
        subtitle: `Frist passert (${effectiveCutoffTime}).`,
        tone: "neutral" as const,
      };
    }

    return {
      pill: <Pill tone="ok" label="Endringer åpne" />,
      title: "Bestilling åpen",
      subtitle: `Åpent til ${effectiveCutoffTime}.`,
      tone: "ok" as const,
    };
  }, [loading, state, effectiveMenu, effectiveLocked, effectiveCutoffTime]);

  async function saveChoice() {
    if (!choiceKey) {
      setToast("Velg et alternativ før du lagrer.");
      return;
    }

    // ✅ Guard: hvis API har allowedChoices, stopp ugyldig valg før POST
    if (state?.ok && Array.isArray(state.allowedChoices) && state.allowedChoices.length > 0) {
      const ok = state.allowedChoices.some((c) => c.key === choiceKey);
      if (!ok) {
        setToast("Valget er ikke tilgjengelig på din avtale i dag.");
        return;
      }
    }

    setBusy(true);
    setToast(null);

    try {
      const res = await fetch("/api/order/set-choice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          date: effectiveDateISO, // ✅ API-date når den finnes
          choice_key: choiceKey,
          note,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as SetChoiceResp;

      if (res.status === 423 || json?.locked) {
        setToast(json?.message || `Endringer er stengt (${effectiveCutoffTime}).`);
        await refresh();
        return;
      }

      if (!res.ok || !json?.ok) {
        setToast(json?.message || json?.error || "Kunne ikke lagre.");
        return;
      }

      setToast(`Lagret • ${json.updated_at ? formatOslo(json.updated_at) : "nå"}`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const showActions = effectiveMenu && state?.ok && state.reason !== "PROFILE_MISSING_SCOPE";
  const showForm = showActions;

  return (
    <section className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">{view.title}</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">{view.subtitle}</div>
        </div>
        {view.pill}
      </div>

      {state?.ok && effectiveMenu && dc && (
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))] p-4">
          <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">Registrert</div>
          <div className="mt-2 divide-y divide-[rgb(var(--lp-divider))]">
            <Row
              label="Valg"
              value={choices.find((c) => c.key === dc.choice_key)?.label ?? dc.choice_key}
            />
            <Row label="Avtale" value={tier ?? "—"} />
            <Row label="Oppdatert" value={formatOslo(dc.updated_at) || "—"} />
          </div>
          {dc.note ? (
            <div className="mt-3 text-sm text-[rgb(var(--lp-muted))]">
              Kommentar: <span className="text-[rgb(var(--lp-text))]">{dc.note}</span>
            </div>
          ) : null}
        </div>
      )}

      {showForm && (
        <>
          <div className="mt-5">
            <label className="block text-sm font-semibold text-[rgb(var(--lp-text))]">
              Velg for i dag
            </label>
            <select
              className="mt-2 h-11 w-full rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-[rgb(var(--lp-cta)/0.15)]"
              value={choiceKey}
              onChange={(e) => setChoiceKey(e.target.value)}
              disabled={!canAct}
            >
              <option value="">Velg…</option>
              {choices.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label ?? c.key}
                </option>
              ))}
            </select>

            <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
              {tier ? (
                <>
                  Dagens avtale:{" "}
                  <span className="font-semibold text-[rgb(var(--lp-text))]">{tier}</span>
                </>
              ) : (
                <>
                  Dagens avtale: <span className="text-[rgb(var(--lp-muted))]">—</span>
                </>
              )}
              {choiceKey ? (
                <>
                  <span className="mx-2">•</span>
                  Valgt:{" "}
                  <span className="font-semibold text-[rgb(var(--lp-text))]">{choiceLabel}</span>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-semibold text-[rgb(var(--lp-text))]">
              Kommentar (valgfritt)
            </label>
            <input
              className="mt-2 h-11 w-full rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-3 text-sm outline-none focus:ring-4 focus:ring-[rgb(var(--lp-cta)/0.15)]"
              placeholder="F.eks. uten løk"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!canAct}
              maxLength={280}
            />
            <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Maks 280 tegn.</div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[rgb(var(--lp-cta))] px-5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={saveChoice}
              disabled={!canAct || busy}
            >
              {busy ? "Lagrer…" : "Lagre"}
            </button>

            <button
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-5 text-sm font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={refresh}
              disabled={busy}
            >
              Oppdater
            </button>
          </div>
        </>
      )}

      {toast && (
        <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white px-4 py-3 text-sm text-[rgb(var(--lp-text))]">
          {toast}
        </div>
      )}
    </section>
  );
}
