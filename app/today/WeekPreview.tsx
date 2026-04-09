"use client";

import { useEffect, useMemo, useState } from "react";

import { unwrapJsonOkData } from "@/lib/http/unwrapClientJson";

type MenuDayItem = {
  date: string; // YYYY-MM-DD
  weekday: string;
  isPublished: boolean;
  description: string | null;
  allergens: string[];
};

type WeekResp = {
  ok: boolean;
  range: { from: string; to: string };
  weekOffset: 0 | 1;
  days: MenuDayItem[];
  error?: string;
  detail?: string;
};

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
    <div className={["inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold", cls].join(" ")}>
      <span aria-hidden className={["h-2 w-2 rounded-full", dot].join(" ")} />
      {label}
    </div>
  );
}

function SegButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "lp-motion-btn h-10 rounded-full px-4 text-sm font-semibold",
        active
          ? "bg-[rgb(var(--lp-text))] text-white"
          : "border border-[rgb(var(--lp-border))] bg-white text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

// --- helpers (Oslo) ---
function todayOsloISO() {
  const now = new Date();
  // “date-only” i Oslo uten å drasse inn libs
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // YYYY-MM-DD
}
function cmpISO(a: string, b: string) {
  // YYYY-MM-DD kan sammenlignes som string
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export default function WeekPreview({
  initialWeekOffset = 0,
  onWeekOffsetChange,
}: {
  initialWeekOffset?: 0 | 1;
  onWeekOffsetChange?: (v: 0 | 1) => void;
}) {
  const [weekOffset, setWeekOffset] = useState<0 | 1>(initialWeekOffset);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WeekResp | null>(null);

  const todayISO = useMemo(() => todayOsloISO(), []);

  function setOffset(v: 0 | 1) {
    setWeekOffset(v);
    onWeekOffsetChange?.(v);
  }

  async function fetchWeek(offset: 0 | 1) {
    setLoading(true);
    try {
      const res = await fetch(`/api/week?weekOffset=${offset}`, { cache: "no-store" });
      const json = await res.json();
      const raw = unwrapJsonOkData<{
        weekOffset?: number;
        range?: { from: string; to: string };
        days?: unknown[];
      }>(json) ?? json;

      const days: MenuDayItem[] = Array.isArray(raw?.days)
        ? (raw.days as Record<string, unknown>[]).map((d) => ({
            date: String(d?.date ?? "").slice(0, 10),
            weekday: String(d?.weekday ?? ""),
            isPublished: Boolean(d?.isPublished),
            description: d?.description != null ? String(d.description) : null,
            allergens: Array.isArray(d?.allergens) ? (d.allergens as unknown[]).map((x) => String(x)) : [],
          }))
        : [];

      const range = raw?.range ?? {
        from: days[0]?.date ?? "",
        to: days[days.length - 1]?.date ?? "",
      };

      const ok = res.ok && days.length > 0;
      setData({
        ok,
        weekOffset: offset,
        range,
        days,
        error: ok ? undefined : "FETCH_FAILED",
      });
    } catch {
      setData({ ok: false, range: { from: "", to: "" }, weekOffset: offset, days: [], error: "FETCH_FAILED" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchWeek(weekOffset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

  const weekMeta = useMemo(() => {
    if (!data?.ok) return null;

    const publishedCount = data.days.filter((d) => d.isPublished).length;
    const allPast = data.days.every((d) => cmpISO(d.date, todayISO) < 0);
    const anyFuture = data.days.some((d) => cmpISO(d.date, todayISO) > 0);

    // Top-pill: ikke “Publisert” på ferdig uke
    if (allPast) {
      return { tone: "neutral" as const, label: "Uke fullført", publishedCount };
    }

    // Hvis uka har fremtidige dager: vis “Klar” status
    if (publishedCount === 5) return { tone: "ok" as const, label: "Klar", publishedCount };
    if (publishedCount === 0) return { tone: "warn" as const, label: "Ikke klar", publishedCount };
    return { tone: "neutral" as const, label: `${publishedCount}/5 klare`, publishedCount, anyFuture };
  }, [data, todayISO]);

  function dayBadge(d: MenuDayItem) {
    const rel = cmpISO(d.date, todayISO);
    // før i dag
    if (rel < 0) return <Pill tone="neutral" label="Gjennomført" />;
    // i dag
    if (rel === 0) return <Pill tone="ok" label="I dag" />;
    // fremtid
    return d.isPublished ? <Pill tone="ok" label="Klar" /> : <Pill tone="warn" label="Ikke klar" />;
  }

  function dayDescription(d: MenuDayItem) {
    const rel = cmpISO(d.date, todayISO);
    if (rel < 0) {
      // historikk: vis menytekst, men dempet, og ikke “publisert”
      return (
        <span className="text-[rgb(var(--lp-muted))]">
          {d.description || "—"}
        </span>
      );
    }
    // i dag/fremtid: normal
    return d.isPublished ? (d.description || "—") : <span className="text-[rgb(var(--lp-muted))]">Ikke publisert</span>;
  }

  return (
    <section className="rounded-3xl border border-[rgb(var(--lp-border))] bg-white/70 p-6 shadow-sm">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">Ukemeny</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Oversikt (Man–Fre). Bestilling gjøres kun for i dag.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SegButton active={weekOffset === 0} onClick={() => setOffset(0)}>
            Denne uken
          </SegButton>
          <SegButton active={weekOffset === 1} onClick={() => setOffset(1)}>
            Neste uke
          </SegButton>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4">
        {loading ? (
          <div className="text-sm text-[rgb(var(--lp-muted))]">Henter ukemeny…</div>
        ) : !data?.ok ? (
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm text-[rgb(var(--lp-muted))]">Kunne ikke hente ukemeny.</div>
            <Pill tone="danger" label="Feil" />
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-[rgb(var(--lp-muted))]">
                Periode:{" "}
                <span className="font-semibold text-[rgb(var(--lp-text))]">
                  {data.range.from} → {data.range.to}
                </span>
              </div>

              {weekMeta ? <Pill tone={weekMeta.tone} label={weekMeta.label} /> : null}
            </div>

            <div className="mt-4 divide-y divide-[rgb(var(--lp-divider))] rounded-2xl border border-[rgb(var(--lp-border))]">
              {data.days.map((d) => (
                <div key={d.date} className="flex flex-col gap-2 p-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">
                      {d.weekday} <span className="font-normal text-[rgb(var(--lp-muted))]">• {d.date}</span>
                    </div>

                    <div className="mt-1 text-sm text-[rgb(var(--lp-text))]">
                      {dayDescription(d)}
                    </div>

                    {/* Allergener: kun når publisert og ikke historikk-støy */}
                    {cmpISO(d.date, todayISO) >= 0 && d.isPublished && d.allergens?.length ? (
                      <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
                        Allergener: {d.allergens.join(", ")}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0">{dayBadge(d)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
