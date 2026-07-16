"use client";

// FASE 6 — full-week ordering via the canonical bulk endpoint.
// Zero order logic here: /api/orders/week-bulk delegates every day to the
// canonical POST /api/orders (lp_order_set). One shared menu choice is applied
// to all orderable days; results are shown per day.
import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

export type BulkOrderableDay = {
  date: string;
  /** Kort norsk etikett, f.eks. «man. 14.07». */
  label: string;
  /** Serverfasit: dagen kan bestilles nå (åpen, i avtalen, ikke allerede bestilt). */
  orderable: boolean;
  /** Kategorier tilgjengelig for dagen (key + label + dagens varianter i serverrekkefølge). */
  categories: Array<{ key: string; label: string; itemKeys: string[] }>;
};

type DayOutcome = { date: string; ok: boolean; message: string | null };

type Props = {
  days: BulkOrderableDay[];
  disabled?: boolean;
  /** Kalles etter fullført bulk slik at uken kan hentes på nytt (window reload). */
  onCompleted: () => void | Promise<void>;
};

function newIdemKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `bulk_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function WeekBulkOrderCard({ days, disabled = false, onCompleted }: Props) {
  const orderableDays = useMemo(() => days.filter((d) => d.orderable), [days]);

  // Felles menyvalg: kun kategorier som finnes på ALLE bestillbare dager kan
  // trygt brukes for hele uken (fail-closed — ingen gjettede kategorier).
  const sharedCategories = useMemo(() => {
    if (orderableDays.length === 0) return [] as Array<{ key: string; label: string }>;
    const first = orderableDays[0]!.categories;
    return first.filter((c) => orderableDays.every((d) => d.categories.some((x) => x.key === c.key)));
  }, [orderableDays]);

  const [choiceKey, setChoiceKey] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<DayOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Stabil idempotency-nøkkel per påbegynt bulk (dobbeltklikk/retry replayer samme skriv).
  const [idemKey, setIdemKey] = useState<string>(() => newIdemKey());

  if (orderableDays.length < 2) return null;

  const effectiveChoice = sharedCategories.length === 1 ? sharedCategories[0]!.key : choiceKey;

  async function orderWholeWeek() {
    if (busy || disabled) return;
    setError(null);
    setOutcomes(null);
    if (!effectiveChoice) {
      setError("Velg menytype for uken før du bestiller.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/orders/week-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idemKey,
        },
        cache: "no-store",
        body: JSON.stringify({
          days: orderableDays.map((d) => {
            // Kategorier med flere varianter krever eksplisitt item — bulk bruker
            // dagens FØRSTE variant (serverfasit-rekkefølge, deterministisk).
            // Serveren validerer valget fail-closed mot publisert meny.
            const cat = d.categories.find((c) => c.key === effectiveChoice);
            const itemKey = cat && cat.itemKeys.length >= 2 ? cat.itemKeys[0] : null;
            return {
              date: d.date,
              action: "set",
              choice_key: effectiveChoice,
              ...(itemKey ? { item_key: itemKey } : {}),
            };
          }),
        }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        data?: { results?: Array<{ date: string; ok: boolean; message: string | null }> };
      } | null;
      if (!res.ok || json?.ok !== true) {
        setError("Ukesbestillingen kunne ikke sendes. Prøv igjen.");
        return;
      }
      const results = Array.isArray(json?.data?.results) ? json.data.results : [];
      setOutcomes(results.map((r) => ({ date: r.date, ok: Boolean(r.ok), message: r.message ?? null })));
      setIdemKey(newIdemKey());
      await onCompleted();
    } catch {
      setError("Ukesbestillingen kunne ikke sendes. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  }

  const labelFor = (date: string) => orderableDays.find((d) => d.date === date)?.label ?? date;

  return (
    <section
      data-lp-week-bulk
      className="mb-5 rounded-2xl bg-white px-4 py-4 text-left ring-1 ring-black/10"
      aria-label="Bestill hele uken"
    >
      <p className="text-sm font-semibold text-neutral-950">Bestill hele uken</p>
      <p className="mt-1 text-xs leading-5 text-neutral-600">
        Én bestilling per åpen dag ({orderableDays.length} dager) med samme menytype. Har dagen flere varianter,
        velges dagens første variant. Hver dag lagres separat og kan endres eller avbestilles frem til fristen.
      </p>

      {sharedCategories.length > 1 ? (
        <label className="mt-3 block text-xs font-medium text-neutral-800">
          Menytype for uken
          <select
            className="mt-1 w-full min-h-touch rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            name="bulk_choice"
            value={choiceKey}
            onChange={(e) => setChoiceKey(e.target.value)}
          >
            <option value="">Velg menytype …</option>
            {sharedCategories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-900 ring-1 ring-rose-200" role="alert">
          {error}
        </p>
      ) : null}

      {outcomes ? (
        <ul className="mt-2 space-y-1" aria-live="polite">
          {outcomes.map((o) => (
            <li key={o.date} className={`text-xs ${o.ok ? "text-emerald-800" : "text-rose-800"}`}>
              {labelFor(o.date)}: {o.ok ? "Bestilt ✔" : o.message || "Kunne ikke bestilles"}
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        name="order-whole-week"
        disabled={busy || disabled || (sharedCategories.length > 1 && !choiceKey)}
        onClick={() => void orderWholeWeek()}
        className="mt-3 inline-flex min-h-touch w-full items-center justify-center rounded-full bg-neutral-950 px-5 text-sm font-bold text-white disabled:pointer-events-none disabled:opacity-50"
      >
        {busy ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            Bestiller uken …
          </>
        ) : (
          `Bestill ${orderableDays.length} åpne dager`
        )}
      </button>
    </section>
  );
}
