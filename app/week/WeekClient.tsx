"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDateForDisplay } from "@/lib/date/format";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri";
type Tier = "BASIS" | "PREMIUM";
type Choice = { key: string; label?: string };

type OrderDay = {
  date: string;
  weekday: DayKey;
  isLocked: boolean;
  isEnabled: boolean;

  tier: Tier;

  allowedChoices: Choice[];
  wantsLunch: boolean;
  selectedChoiceKey: string | null;

  menuTitle?: string | null;
  menuDescription: string | null;
  allergens: string[];

  lastSavedAt?: string | null;
};

type WindowResp = {
  ok: boolean;
  range: { from: string; to: string };
  company?: { name?: string; policy?: string };
  days: OrderDay[];
  error?: string;
  detail?: string;
  rid?: string;
};

function weekdayLabel(w: DayKey) {
  const map: Record<DayKey, string> = {
    mon: "Man",
    tue: "Tir",
    wed: "Ons",
    thu: "Tor",
    fri: "Fre",
  };
  return map[w];
}

function tierLabel(t: Tier) {
  return t === "BASIS" ? "Basis" : "Luxus";
}

function canAct(day: OrderDay) {
  return day.isEnabled && !day.isLocked;
}

function safeUserMessage(raw: string) {
  const s = (raw || "").toLowerCase();
  if (s.includes("locked") || s.includes("låst")) return "Dagen er låst etter 08:00.";
  if (s.includes("unauth") || s.includes("innlogget")) return "Du er ikke innlogget.";
  if (s.includes("mangler menyvalg") || s.includes("no_choices")) return "Firmaavtalen mangler menyvalg.";
  if (s.includes("ikke aktiv") || s.includes("not enabled")) return "Denne dagen er ikke aktiv i avtalen.";
  return raw || "Noe gikk galt. Prøv igjen.";
}

function StatusChip({ day }: { day: OrderDay }) {
  if (!day.isEnabled)
    return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">Ikke aktiv</span>;
  if (day.isLocked)
    return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">🔒 Låst</span>;
  if (day.wantsLunch)
    return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">✅ Bestilt</span>;
  return <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">⭕ Ikke bestilt</span>;
}

function defaultChoiceKey(day: OrderDay) {
  const varm = day.allowedChoices?.find((c) => c.key === "varmmat")?.key;
  return varm ?? day.allowedChoices?.[0]?.key ?? null;
}

function choiceLabel(day: OrderDay, key: string) {
  return day.allowedChoices.find((c) => c.key === key)?.label ?? key;
}

function TogglePill({
  active,
  disabled,
  onClick,
  title,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-10 w-16 rounded-full border px-1 transition",
        "focus:outline-none focus:ring-2 focus:ring-offset-2",
        disabled ? "opacity-50 cursor-not-allowed" : "hover:brightness-[1.02]",
        active
          ? "bg-emerald-600 border-emerald-700 focus:ring-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
          : "bg-rose-600 border-rose-700 focus:ring-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
      ].join(" ")}
      aria-pressed={active}
      title={title}
    >
      <span
        className={[
          "block h-8 w-8 rounded-full bg-white transition shadow",
          active ? "translate-x-6" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

export default function WeekClient() {
  const [weekIndex, setWeekIndex] = useState<0 | 1>(0);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<WindowResp | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [savingDate, setSavingDate] = useState<string | null>(null);
  const [savingMsg, setSavingMsg] = useState<string | null>(null);

  async function loadWindow() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/order/window?weeks=2", { cache: "no-store" });
      const json = (await res.json()) as WindowResp;

      if (!res.ok || !json.ok) {
        setMsg(safeUserMessage(json.error || json.detail || "Kunne ikke hente lunsjplanen."));
        setData(null);
        return;
      }

      setData(json);
    } catch {
      setMsg("Kunne ikke hente lunsjplanen. Prøv igjen.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWindow();
  }, []);

  const daysThisWeek = useMemo(() => (data?.days ?? []).slice(0, 5), [data]);
  const daysNextWeek = useMemo(() => (data?.days ?? []).slice(5, 10), [data]);
  const visibleDays = weekIndex === 0 ? daysThisWeek : daysNextWeek;

  const summary = useMemo(() => {
    const enabled = visibleDays.filter((d) => d.isEnabled).length;
    const ordered = visibleDays.filter((d) => d.wantsLunch).length;
    const locked = visibleDays.filter((d) => d.isLocked).length;
    return { enabled, ordered, locked };
  }, [visibleDays]);

  async function setDay(date: string, patch: Partial<Pick<OrderDay, "wantsLunch" | "selectedChoiceKey">>) {
    if (!data?.days?.length) return;

    setSavingDate(date);
    setSavingMsg(null);
    setMsg(null);

    // optimistic update
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        days: prev.days.map((d) =>
          d.date === date
            ? {
                ...d,
                wantsLunch: patch.wantsLunch ?? d.wantsLunch,
                selectedChoiceKey: patch.selectedChoiceKey ?? d.selectedChoiceKey,
              }
            : d
        ),
      };
    });

    const day = data.days.find((d) => d.date === date);
    const wantsLunch = patch.wantsLunch ?? day?.wantsLunch ?? false;

    const candidate = patch.selectedChoiceKey ?? day?.selectedChoiceKey ?? null;
    const choice_key = wantsLunch ? (candidate ?? (day ? defaultChoiceKey(day) : null)) : null;

    try {
      const res = await fetch("/api/order/set-day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, wantsLunch, choice_key }),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        await loadWindow();
        setMsg(safeUserMessage(json.message || json.error || "Kunne ikke lagre. Prøv igjen."));
        return;
      }

      if (json.savedAt) {
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            days: prev.days.map((d) => (d.date === date ? { ...d, lastSavedAt: json.savedAt } : d)),
          };
        });
      }

      setSavingMsg("Lagret");
    } catch {
      await loadWindow();
      setMsg("Kunne ikke lagre. Prøv igjen.");
    } finally {
      setSavingDate(null);
      setTimeout(() => setSavingMsg(null), 1100);
    }
  }

  function onToggleLunch(day: OrderDay, next: boolean) {
    if (!canAct(day)) return;

    if (!next) {
      void setDay(day.date, { wantsLunch: false, selectedChoiceKey: null });
      return;
    }

    const pick =
      day.selectedChoiceKey && day.allowedChoices.some((c) => c.key === day.selectedChoiceKey)
        ? day.selectedChoiceKey
        : defaultChoiceKey(day);

    void setDay(day.date, { wantsLunch: true, selectedChoiceKey: pick });
  }

  function onSelectChoice(day: OrderDay, key: string) {
    if (!canAct(day)) return;
    if (!day.wantsLunch) return;
    if (!day.allowedChoices.some((c) => c.key === key)) return;

    void setDay(day.date, { selectedChoiceKey: key });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      {/* Top */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-medium text-text">Planlegg lunsj</div>
          <div className="text-sm text-muted">
            Endringer låses kl. <span className="font-medium text-text">08:00</span> samme dag.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekIndex(0)}
            className={`rounded-xl border px-3 py-2 text-sm ${
              weekIndex === 0 ? "border-border bg-bg text-text" : "border-border/60 text-muted hover:bg-bg"
            }`}
          >
            Denne uke
          </button>
          <button
            type="button"
            onClick={() => setWeekIndex(1)}
            className={`rounded-xl border px-3 py-2 text-sm ${
              weekIndex === 1 ? "border-border bg-bg text-text" : "border-border/60 text-muted hover:bg-bg"
            }`}
          >
            Neste uke
          </button>
          <button
            type="button"
            onClick={loadWindow}
            className="rounded-xl border border-border/40 px-3 py-2 text-sm text-muted hover:bg-bg"
            disabled={loading || !!savingDate}
          >
            Oppdater
          </button>
        </div>
      </div>

      {/* Range + save */}
      <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-muted">
          {data?.range ? (
            <>
              Periode: <span className="font-medium text-text">{formatDateForDisplay(data.range.from)}</span> –{" "}
              <span className="font-medium text-text">{formatDateForDisplay(data.range.to)}</span>
            </>
          ) : (
            <>Periode</>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          {savingDate ? (
            <span className="text-muted">Lagrer…</span>
          ) : savingMsg ? (
            <span className="text-muted">{savingMsg}</span>
          ) : null}
        </div>
      </div>

      {/* Summary */}
      {!loading && !msg ? (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-border bg-bg p-4 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-text">
            <span className="font-medium">Ukeoversikt:</span>{" "}
            <span className="text-muted">
              {summary.ordered} bestilt • {summary.enabled} aktive dager • {summary.locked} låste
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="lp-chip">Man–Fre</span>
            <span className="lp-chip">Cut-off 08:00</span>
            <span className="lp-chip">Autosave</span>
          </div>
        </div>
      ) : null}

      {/* Body */}
      {loading ? (
        <div className="mt-4 text-sm text-muted">Henter lunsjplan…</div>
      ) : msg ? (
        <div className="mt-4 rounded-2xl border border-border bg-bg p-4 text-sm text-muted">{msg}</div>
      ) : (
        <>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {visibleDays.map((day) => {
              const disabled = day.isLocked || !day.isEnabled || savingDate === day.date;
              const activeChoice = day.selectedChoiceKey;

              return (
                <div
                  key={day.date}
                  className={[
                    "relative rounded-2xl border border-border bg-surface p-4",
                    day.isLocked ? "opacity-95" : "",
                  ].join(" ")}
                >
                  {/* Locked overlay */}
                  {day.isLocked ? (
                    <div className="pointer-events-none absolute inset-0 rounded-2xl">
                      <div className="absolute inset-0 rounded-2xl bg-white/40 backdrop-blur-[2px]" />
                      <div className="absolute right-3 top-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface/90 px-3 py-1 text-xs text-muted shadow-sm">
                        <span>🔒</span>
                        <span className="font-medium text-text">Låst kl. 08:00</span>
                      </div>
                      <div className="absolute bottom-3 left-3 right-3 rounded-xl border border-border bg-surface/80 px-3 py-2 text-xs text-muted">
                        Endringer er ikke mulig etter cut-off.
                      </div>
                    </div>
                  ) : null}

                  {/* Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-lg font-semibold tracking-tight text-text">
                        {weekdayLabel(day.weekday)}{" "}
                        <span className="text-sm font-normal text-muted">({formatDateForDisplay(day.date)})</span>
                      </div>

                      <div className="mt-1 text-sm text-muted">
                        {day.menuTitle ? <span className="font-medium text-text">{day.menuTitle}:</span> : null}{" "}
                        {day.menuDescription ? day.menuDescription : <span className="italic">Meny kommer</span>}
                      </div>

                      {day.allergens?.length ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {day.allergens.map((a) => (
                            <span key={a} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                              {a}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <StatusChip day={day} />
                      <span className="text-xs text-muted">{tierLabel(day.tier)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 rounded-xl border border-border bg-bg p-3 sm:p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium text-text">Lunsj</div>
                        <div className="text-xs text-muted">
                          {!day.isEnabled
                            ? "Ikke aktiv i avtalen."
                            : day.isLocked
                            ? "Låst etter 08:00."
                            : "Kan endres frem til 08:00."}
                        </div>
                      </div>

                      <TogglePill
                        active={day.wantsLunch}
                        disabled={disabled}
                        onClick={() => onToggleLunch(day, !day.wantsLunch)}
                        title={day.wantsLunch ? "Klikk for å avbestille" : "Klikk for å bestille"}
                      />
                    </div>

                    {day.wantsLunch ? (
                      <div className="mt-3">
                        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border bg-bg px-3 py-1 text-sm transition">
                          <span className="text-muted">Valgt</span>
                          <span className="font-medium text-text">
                            {activeChoice ? choiceLabel(day, activeChoice) : "–"}
                          </span>
                        </div>

                        <div className="mt-2 rounded-xl border border-border bg-surface p-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            {day.allowedChoices.map((c) => {
                              // Hotpink #ff008c — discreet neon ring only when bestilt
                              const active = day.wantsLunch && day.selectedChoiceKey === c.key;

                              return (
                                <button
                                  key={c.key}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => onSelectChoice(day, c.key)}
                                  className={[
                                    "w-full sm:w-auto rounded-xl sm:rounded-full border px-3 py-2 text-sm transition",
                                    "active:scale-[0.99] sm:active:scale-100",
                                    "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[rgb(var(--lp-cta)/0.35)]",
                                    disabled ? "opacity-50" : "hover:bg-bg",
                                    active
                                      ? [
                                          "bg-bg text-text font-medium",
                                          "border-[rgba(255,0,140,0.55)]",
                                          "ring-2 ring-[rgba(255,0,140,0.55)]",
                                          "ring-offset-2 ring-offset-bg",
                                          "shadow-[0_0_0_1px_rgba(255,0,140,0.10),0_0_14px_rgba(255,0,140,0.22)]",
                                        ].join(" ")
                                      : "border-border/60 bg-white text-text/80",
                                  ].join(" ")}
                                >
                                  {c.label ?? c.key}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-2 text-xs text-muted">
                          Hvis du ikke velger noe, bruker vi standardvalget automatisk.
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-sm text-muted">Ikke bestilt.</div>
                    )}
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted">
                    <span>{day.wantsLunch ? "✅ Bestilt" : "⭕ Ikke bestilt"}</span>
                    <span>{day.lastSavedAt ? `Sist lagret: ${day.lastSavedAt}` : ""}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Weekend CTA */}
          <div className="mt-5 rounded-2xl border border-border bg-bg p-4">
            <div className="text-sm font-medium text-text">Helgelevering (lørdag/søndag)</div>
            <div className="mt-1 text-sm text-muted">Levering i helg bestilles ikke i Lunchportalen.</div>
            <a
              href="https://melhuscatering.no/catering/bestill-her/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-xl border border-border px-4 py-2 text-sm text-text hover:bg-surface"
            >
              Bestill helgelevering
            </a>
          </div>
        </>
      )}
    </section>
  );
}
