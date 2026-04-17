"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type StrategyMode = "profit" | "growth" | "balance";

export type TrustIndicatorPayload = {
  title: string;
  body: string;
  signal: "god" | "middels" | "oppmerksom";
};

export type ForretningsscoreBandPayload = "lav" | "stabil" | "sterk" | "optimal";

export type Prognose7DagerPayload = {
  ingress: string;
  punkter: string[];
  disclaimer: string;
};

export type StyringsanbefalingKodePayload = "la_ai_styre" | "folg_med" | "ta_kontroll";

export type DecisionExplanationPayload = {
  headline: string;
  bullets: string[];
  ai_jobber_med: string;
  forretningsscore_band: ForretningsscoreBandPayload;
  forretningsscore_band_forklaring: string;
  prognose_7_dager: Prognose7DagerPayload;
  styringsanbefaling_kode: StyringsanbefalingKodePayload;
  styringsanbefaling_tittel: string;
  styringsanbefaling_begrunnelse: string;
  forretningsscore_hva_er_det: string;
  hva_skjer_na: string;
  hva_forventer_vi: string;
  effekt_i_korthet: string[];
  tillit: TrustIndicatorPayload[];
  konfidens: { niva: string; forklaring: string };
  salgsblokk_overskrift: string;
  historie_problem_overskrift: string;
  historie_problem_punkter: string[];
  historie_transformasjon_overskrift: string;
  historie_transformasjon_punkter: string[];
  historie_resultat_overskrift: string;
  historie_resultat_punkter: string[];
  historie_bevis_overskrift: string;
  historie_bevis_ingress: string;
  bevis_margin_forbedring_pct: number | null;
  bevis_margin_tekst: string;
  bevis_tid_besparelse_indikator_pct: number | null;
  bevis_tid_tekst: string;
  bevis_disclaimer: string;
  cta_start_ai_styring_label: string;
  cta_start_ai_styring_href: string;
};

export const STRATEGY_LABELS_NB: Record<StrategyMode, string> = {
  profit: "Margin først",
  growth: "Vekst først",
  balance: "Balansert",
};

export function formatPct01(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return `${(n * 100).toFixed(digits)} %`;
}

export function formatSignedRelPct(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)} %`;
}

export function formatUsd(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n);
}

export function forretningsscoreBandLabelNb(band: ForretningsscoreBandPayload): string {
  switch (band) {
    case "lav":
      return "Lav";
    case "stabil":
      return "Stabil";
    case "sterk":
      return "Sterk";
    case "optimal":
      return "Optimal";
  }
}

export function forretningsscoreBandPillClass(band: ForretningsscoreBandPayload): string {
  switch (band) {
    case "lav":
      return "bg-slate-200 text-slate-900";
    case "stabil":
      return "bg-amber-100 text-amber-950";
    case "sterk":
      return "bg-emerald-100 text-emerald-950";
    case "optimal":
      return "bg-emerald-700 text-white";
  }
}

export function styringsanbefalingCardClass(kode: StyringsanbefalingKodePayload): string {
  switch (kode) {
    case "la_ai_styre":
      return "border-emerald-200 bg-emerald-50/90";
    case "folg_med":
      return "border-amber-200 bg-amber-50/80";
    case "ta_kontroll":
      return "border-rose-200 bg-rose-50/90";
  }
}

export function trustIndicatorStripClass(signal: TrustIndicatorPayload["signal"]): string {
  switch (signal) {
    case "god":
      return "border-l-4 border-l-emerald-500";
    case "middels":
      return "border-l-4 border-l-amber-400";
    case "oppmerksom":
      return "border-l-4 border-l-slate-400";
  }
}

export function FortellingTrinn(props: {
  steg: string;
  tittel: string;
  punkter: string[];
  variant: "problem" | "transform" | "result";
}) {
  const { steg, tittel, punkter, variant } = props;
  const surface =
    variant === "problem"
      ? "border-rose-200/90 bg-rose-50/50"
      : variant === "transform"
        ? "border-indigo-200/80 bg-indigo-50/40"
        : "border-emerald-200/90 bg-emerald-50/45";
  return (
    <div className={`rounded-lg border px-4 py-3 ${surface}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{steg}</p>
      <p className="mt-1 text-sm font-semibold leading-snug text-slate-900">{tittel}</p>
      <ul className="mt-2 list-inside list-disc space-y-1.5 text-sm leading-relaxed text-slate-800">
        {punkter.map((line, i) => (
          <li key={i} className="break-words pl-0.5">
            {line}
          </li>
        ))}
      </ul>
    </div>
  );
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function demoStartScorePct(targetPct: number): number {
  const t = Math.min(100, Math.max(0, targetPct));
  if (!Number.isFinite(t) || t <= 0) return 22;
  let s = Math.round((t * 0.56 + 10) * 10) / 10;
  if (s >= t - 0.25) s = Math.round((t - 7) * 10) / 10;
  if (s >= t - 0.25) s = Math.round(t * 0.78 * 10) / 10;
  return Math.max(8, Math.min(t - 0.4, s));
}

type DemoPhase = "idle" | "activating" | "animating" | "done";

export function buildAiDemoQuery(month?: string, includeAutoplay?: boolean): string {
  const q = new URLSearchParams();
  q.set("se_demo", "1");
  if (includeAutoplay) q.set("demo_auto", "1");
  const m = month?.trim();
  if (m && /^\d{4}-\d{2}$/.test(m)) q.set("month", m);
  return `${q.toString()}#ai-motor-demo`;
}

export const DEMO_SHARE_TITLE_NB = "Se Forretningsscore hoppe — på under 20 sekunder";
export const DEMO_SHARE_TEXT_NB =
  "Interaktiv superadmin-demo: før/etter når AI får styre margin og strategi. Sluttbildet er deres ekte tall — ikke reklame. Trykk lenken → play.";

export const DEMO_SHARE_TITLE_PUBLIC =
  "Se AI styre Forretningsscore — offentlig demo (eksempeldata)";
export const DEMO_SHARE_TEXT_PUBLIC =
  "Åpne lenken: samme animasjon og historie som i produktet, med anonymiserte tall. Ingen innlogging kreves.";

export function DemoInstantPreviewFrame(props: { variant?: "live" | "sample" }) {
  const v = props.variant ?? "live";
  return (
    <figure
      className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md ring-1 ring-slate-200/70 sm:mt-4"
      aria-label="Forhåndsvisning: illustrert lav score mot spørsmålstegn før demoen spilles av"
    >
      <div className="flex h-9 items-center gap-1.5 border-b border-slate-200 bg-slate-100 px-3">
        <span className="size-2.5 shrink-0 rounded-full bg-rose-400/90" />
        <span className="size-2.5 shrink-0 rounded-full bg-amber-400/90" />
        <span className="size-2.5 shrink-0 rounded-full bg-emerald-400/90" />
        <span className="ml-2 truncate text-[11px] font-medium tracking-tight text-slate-500">
          Forhåndsvisning · AI-motor (demo)
        </span>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 sm:gap-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Før (illus.)</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-500 sm:text-2xl">~30 %</p>
          <p className="mt-0.5 text-[11px] text-slate-600">Manuelt fragmentert</p>
        </div>
        <div className="rounded-lg border border-dashed border-emerald-300/90 bg-emerald-50/60 px-3 py-2.5 motion-safe:animate-pulse">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-900">Etter</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-800 sm:text-2xl">? %</p>
          <p className="mt-0.5 text-[11px] text-emerald-900/90">
            {v === "sample" ? "Eksempel avsløres i demo" : "Ditt tall avsløres i demo"}
          </p>
        </div>
      </div>
      <figcaption className="border-t border-slate-100 px-3 py-2 text-center text-[11px] leading-snug text-slate-500">
        {v === "sample"
          ? "Visuell smakebit. Under kjører animasjonen med helt anonymiserte tall."
          : "Dette er bare en visuell «smakebit». Under spiller den ekte animasjonen — med deres faktiske score."}
      </figcaption>
    </figure>
  );
}

export function AiMotorInteraktivDemo(props: {
  targetScore01: number;
  targetMode: StrategyMode;
  resetKey: string;
  monthForLink?: string;
  variant?: "live" | "sample";
  shareTitle?: string;
  shareText?: string;
}) {
  const {
    targetScore01,
    targetMode,
    resetKey,
    monthForLink,
    variant = "live",
    shareTitle = DEMO_SHARE_TITLE_NB,
    shareText = DEMO_SHARE_TEXT_NB,
  } = props;
  const targetPct = Number((Math.min(1, Math.max(0, targetScore01)) * 100).toFixed(1));
  const startPct = demoStartScorePct(targetPct);

  const [phase, setPhase] = useState<DemoPhase>("idle");
  const [afterScorePct, setAfterScorePct] = useState(startPct);
  const [strategyShowReal, setStrategyShowReal] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const runDemoRef = useRef<() => void>(() => {});

  const beforeStrategyLabel = "Fragmentert manuell styring";
  const transitionStrategyLabel = "AI aktiverer motor …";
  const afterStrategyLabel = STRATEGY_LABELS_NB[targetMode];

  const clearTimers = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const applyReducedMotionEndState = useCallback(() => {
    clearTimers();
    setPhase("done");
    setAfterScorePct(targetPct);
    setStrategyShowReal(true);
  }, [clearTimers, targetPct]);

  useEffect(() => {
    clearTimers();
    setPhase("idle");
    setAfterScorePct(startPct);
    setStrategyShowReal(false);
  }, [resetKey, startPct, clearTimers]);

  useEffect(
    () => () => {
      clearTimers();
    },
    [clearTimers],
  );

  const scrollDemoIntoView = useCallback(() => {
    const el = rootRef.current;
    if (!el || typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      try {
        el.focus({ preventScroll: true });
      } catch {
        /* ignore */
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const maybeScroll = () => {
      const p = new URLSearchParams(window.location.search);
      const byQuery = p.get("se_demo") === "1" || p.get("se_demo") === "true";
      const byHash = window.location.hash === "#ai-motor-demo";
      if (byQuery || byHash) scrollDemoIntoView();
    };
    maybeScroll();
    window.addEventListener("hashchange", maybeScroll);
    return () => window.removeEventListener("hashchange", maybeScroll);
  }, [resetKey, scrollDemoIntoView]);

  const runDemo = useCallback(() => {
    if (phase === "activating" || phase === "animating") return;
    clearTimers();
    const reduceMotion =
      typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduceMotion) {
      applyReducedMotionEndState();
      return;
    }

    setPhase("activating");
    setAfterScorePct(startPct);
    setStrategyShowReal(false);

    timerRef.current = setTimeout(() => {
      setPhase("animating");
      const durationMs = 1700;
      const t0 = performance.now();

      const tick = (now: number) => {
        const elapsed = now - t0;
        const u = Math.min(1, elapsed / durationMs);
        const e = easeOutCubic(u);
        const v = startPct + (targetPct - startPct) * e;
        setAfterScorePct(Number(v.toFixed(1)));
        setStrategyShowReal(u >= 0.28);

        if (u < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setAfterScorePct(targetPct);
          setStrategyShowReal(true);
          setPhase("done");
          rafRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 480);
  }, [phase, startPct, targetPct, clearTimers, applyReducedMotionEndState]);

  runDemoRef.current = runDemo;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    if (p.get("demo_auto") !== "1" && p.get("demo_auto") !== "true") return;
    const sk = `ai-demo-autoplay:${resetKey}:${variant}`;
    if (sessionStorage.getItem(sk)) return;
    const id = window.setTimeout(() => {
      sessionStorage.setItem(sk, "1");
      runDemoRef.current();
    }, 900);
    return () => window.clearTimeout(id);
  }, [resetKey, variant]);

  const handleShareDemo = useCallback(async () => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    const q = buildAiDemoQuery(monthForLink, true);
    const url = `${window.location.origin}${path}?${q}`;
    setShareNote(null);
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: shareTitle, text: shareText, url });
        return;
      }
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareNote("Lenke kopiert — lim inn i chat, e-post eller sosiale medier.");
    } catch {
      setShareNote("Kunne ikke kopiere automatisk. Marker og kopier adresselinjen manuelt.");
    }
    window.setTimeout(() => setShareNote(null), 4000);
  }, [monthForLink, shareTitle, shareText]);

  const barPct =
    targetPct > startPct + 0.05
      ? Math.min(100, Math.max(0, ((afterScorePct - startPct) / (targetPct - startPct)) * 100))
      : afterScorePct >= targetPct - 0.1
        ? 100
        : 0;

  const busy = phase === "activating" || phase === "animating";
  const afterLabel =
    phase === "idle" ? "Trykk på knappen under" : phase === "activating" ? transitionStrategyLabel : strategyShowReal ? afterStrategyLabel : transitionStrategyLabel;

  const etterLabel = variant === "sample" ? "Etter (eksempel)" : "Etter (deres tall)";

  return (
    <div
      ref={rootRef}
      id="ai-motor-demo"
      tabIndex={-1}
      className="mt-5 scroll-mt-[88px] rounded-lg border border-slate-200 bg-gradient-to-b from-slate-50/90 to-white px-3 py-3 sm:px-4 sm:py-4"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Interaktiv demo</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">Simuler før → etter når AI-styring slår inn</p>
      <p className="mt-1 hidden text-xs leading-relaxed text-slate-600 sm:block">
        {variant === "sample" ? (
          <>
            Illustrert utgangspunkt til venstre; til høyre animeres mot et{" "}
            <span className="font-medium">fastsatt eksempel</span> på Forretningsscore og strategi.
          </>
        ) : (
          <>
            Illustrert utgangspunkt til venstre; til høyre animeres mot <span className="font-medium">deres faktiske</span>{" "}
            Forretningsscore og strategi akkurat nå.
          </>
        )}
      </p>
      <p className="mt-1 text-xs leading-snug text-slate-600 sm:hidden">
        {variant === "sample" ? (
          <>
            Før/etter mot <span className="font-medium">eksempel</span>score — delbar lenke under.
          </>
        ) : (
          <>
            Før/etter mot <span className="font-medium">deres</span> score — delbar lenke under.
          </>
        )}
      </p>

      <div className="mt-3 grid gap-2 sm:mt-4 sm:gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200/90 bg-slate-100/70 px-2.5 py-2.5 sm:px-3 sm:py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">Før (illus.)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-600 sm:mt-2 sm:text-3xl">{startPct.toFixed(1)} %</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-700 sm:mt-1 sm:text-xs">Forretningsscore</p>
          <p className="mt-2 text-xs font-semibold text-slate-800 sm:mt-3 sm:text-sm">{beforeStrategyLabel}</p>
          <p className="mt-0.5 hidden text-xs text-slate-600 sm:mt-1 sm:block">
            Variabler spredt — strategi oppdateres sjeldent og ujevnt.
          </p>
        </div>

        <div
          className={`rounded-lg border px-2.5 py-2.5 transition-colors duration-500 sm:px-3 sm:py-3 ${
            phase === "done"
              ? "border-emerald-300/90 bg-emerald-50/60 shadow-sm"
              : busy
                ? "border-indigo-200/90 bg-indigo-50/50"
                : "border-dashed border-slate-300 bg-white"
          }`}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-[11px]">{etterLabel}</p>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums transition-colors duration-300 sm:mt-2 sm:text-3xl ${
              phase === "done" ? "text-emerald-900" : "text-slate-900"
            }`}
          >
            {phase === "idle" ? "—" : `${afterScorePct.toFixed(1)} %`}
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-700 sm:mt-1 sm:text-xs">Forretningsscore</p>
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200 sm:mt-2"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(barPct)}
            aria-label="Fremdrift mot målt score"
          >
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] duration-75 ease-out"
              style={{ width: `${barPct}%` }}
            />
          </div>
          <p
            className={`mt-2 text-xs font-semibold transition-opacity duration-300 sm:mt-3 sm:text-sm ${
              phase === "activating" ? "animate-pulse text-indigo-900" : "text-slate-900"
            }`}
          >
            {afterLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-600 sm:mt-1 sm:text-xs">
            {phase === "done"
              ? variant === "sample"
                ? "Illustrativt eksempel — ikke koblet til ekte kundedata."
                : "Samme modus og score som under — ikke fiksjon."
              : "AI leser gap fortløpende; strategi holdes stabil med hysterese."}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => void runDemo()}
          disabled={busy}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border-2 border-slate-900 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff007f] focus-visible:ring-offset-2 sm:w-auto"
        >
          {busy ? "Spiller av …" : "Se hva som skjer"}
        </button>
        <button
          type="button"
          onClick={() => void handleShareDemo()}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff007f] focus-visible:ring-offset-2 sm:w-auto"
        >
          Del demo (lenke)
        </button>
        {phase === "done" ? (
          <button
            type="button"
            onClick={() => {
              clearTimers();
              setPhase("idle");
              setAfterScorePct(startPct);
              setStrategyShowReal(false);
            }}
            className="inline-flex min-h-[44px] w-full min-w-[44px] items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff007f] focus-visible:ring-offset-2 sm:w-auto"
          >
            Kjør demo på nytt
          </button>
        ) : null}
      </div>
      <p className="mt-2 text-[11px] leading-snug text-slate-500 sm:text-xs">
        Del-lenken inkluderer <span className="font-medium">demo_auto=1</span> (ett auto-spill per økt). Fjern den fra URL om du bare vil hoppe til demo uten avspilling.
      </p>
      {shareNote ? (
        <p role="status" aria-live="polite" className="mt-2 text-xs font-medium text-emerald-800 sm:text-sm">
          {shareNote}
        </p>
      ) : null}
    </div>
  );
}

export type AiMotorDemoObjectiveSlice = {
  score: number;
  stress: number;
  strategy_mode: StrategyMode;
  strategy_forced: boolean;
  strategy_override_source: "dashboard" | "env" | null;
  margin_gap_stress: number;
  growth_gap_stress: number;
  margin_gap_base?: number;
  growth_gap_base?: number;
  targets: { target_margin_usd: number; target_growth_rel: number };
  achieved_growth_rel: number | null;
  checkpoint_period: string | null;
};

export type AiMotorDemoTotalsSlice = {
  margin_usd: number | null;
  revenue_partial: boolean;
};

export const STRATEGY_SOURCE_NB: Record<NonNullable<AiMotorDemoObjectiveSlice["strategy_override_source"]>, string> = {
  dashboard: "Manuelt i dashboard",
  env: "Miljø (AI_OBJECTIVE_STRATEGY_MODE)",
};

export function AiMotorDemoCoreSection(props: {
  decision: DecisionExplanationPayload;
  objective: AiMotorDemoObjectiveSlice;
  totals: AiMotorDemoTotalsSlice;
  periodLabel: string;
  monthForLink?: string;
  variant: "live" | "sample";
  /** Vises rett under primær-CTA (f.eks. superadmin tilbakemelding etter strategi-endring). */
  belowCtaNotice?: string | null;
  /** data-analytics-cta-id på primær-CTA (f.eks. offentlig funnel). */
  ctaAnalyticsCtaId?: string;
  /** A/B-variant for analytics (data-analytics-ab-variant); frø a/b eller generert id (g1 …). */
  ctaAnalyticsAbVariant?: string;
}) {
  const {
    decision,
    objective,
    totals,
    periodLabel,
    monthForLink,
    variant,
    belowCtaNotice,
    ctaAnalyticsCtaId,
    ctaAnalyticsAbVariant,
  } = props;

  return (
    <>
      <p className="mt-4 text-xl font-semibold leading-snug tracking-tight text-slate-900 sm:text-2xl">
        {decision.salgsblokk_overskrift}
      </p>
      <p className="mt-2 max-w-2xl text-base font-medium leading-snug text-slate-800 sm:text-lg">
        {variant === "sample" ? (
          <>
            Hvordan kan Forretningsscore bevege seg når en motor får harmonisere margin og strategi — uten at du mister
            oversikten?
          </>
        ) : (
          <>
            Hva skjer med Forretningsscore når motoren får styre inn — uten at du mister oversikten over margin og
            strategi?
          </>
        )}
      </p>
      <DemoInstantPreviewFrame variant={variant} />
      <div className="mt-4 space-y-3" aria-label="Historie: problem, transformasjon, resultat">
        <FortellingTrinn
          steg="1 · Problem"
          tittel={decision.historie_problem_overskrift}
          punkter={decision.historie_problem_punkter}
          variant="problem"
        />
        <FortellingTrinn
          steg="2 · Transformasjon"
          tittel={decision.historie_transformasjon_overskrift}
          punkter={decision.historie_transformasjon_punkter}
          variant="transform"
        />
        <FortellingTrinn
          steg="3 · Resultat"
          tittel={decision.historie_resultat_overskrift}
          punkter={decision.historie_resultat_punkter}
          variant="result"
        />
      </div>
      <AiMotorInteraktivDemo
        targetScore01={objective.score}
        targetMode={objective.strategy_mode}
        resetKey={`${periodLabel}-${objective.score}-${objective.strategy_mode}`}
        monthForLink={monthForLink}
        variant={variant}
        shareTitle={variant === "sample" ? DEMO_SHARE_TITLE_PUBLIC : DEMO_SHARE_TITLE_NB}
        shareText={variant === "sample" ? DEMO_SHARE_TEXT_PUBLIC : DEMO_SHARE_TEXT_NB}
      />
      <div className="mt-5 rounded-lg border border-slate-300/90 bg-white px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">4 · Bevis</p>
        <h3 className="mt-1 text-sm font-semibold text-slate-900">{decision.historie_bevis_overskrift}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{decision.historie_bevis_ingress}</p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bevis · margin</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {formatSignedRelPct(decision.bevis_margin_forbedring_pct, 1)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{decision.bevis_margin_tekst}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Bevis · tidsbesparelse (indikator)</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {formatSignedRelPct(decision.bevis_tid_besparelse_indikator_pct, 1)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{decision.bevis_tid_tekst}</p>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{decision.bevis_disclaimer}</p>
      <div className="mt-4">
        <Link
          href={decision.cta_start_ai_styring_href}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-slate-900 bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff007f] focus-visible:ring-offset-2"
          {...(ctaAnalyticsCtaId
            ? {
                "data-analytics-cta-id": ctaAnalyticsCtaId,
                "data-analytics-page-id": "",
                ...(ctaAnalyticsAbVariant ? { "data-analytics-ab-variant": ctaAnalyticsAbVariant } : {}),
              }
            : {})}
        >
          {decision.cta_start_ai_styring_label}
        </Link>
      </div>
      {belowCtaNotice ? (
        <p
          className={`mt-2 rounded border px-2 py-1.5 text-sm ${
            belowCtaNotice.startsWith("Strategi oppdatert")
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {belowCtaNotice}
        </p>
      ) : null}
      <p className="mt-4 text-lg font-semibold leading-snug text-slate-900">{decision.ai_jobber_med}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_minmax(0,1.1fr)]">
        <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Forretningsscore</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums text-slate-900">{formatPct01(objective.score, 1)}</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${forretningsscoreBandPillClass(decision.forretningsscore_band)}`}
            >
              {forretningsscoreBandLabelNb(decision.forretningsscore_band)}
            </span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-700">{decision.forretningsscore_band_forklaring}</p>
        </div>
        <div className={`rounded-lg border px-4 py-3 ${styringsanbefalingCardClass(decision.styringsanbefaling_kode)}`}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-600">Anbefaling</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{decision.styringsanbefaling_tittel}</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-800">{decision.styringsanbefaling_begrunnelse}</p>
        </div>
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">7-dagersprognose</h3>
        <p className="mt-1.5 text-sm font-medium text-slate-900">{decision.prognose_7_dager.ingress}</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
          {decision.prognose_7_dager.punkter.map((line, i) => (
            <li key={i} className="break-words pl-0.5">
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">{decision.prognose_7_dager.disclaimer}</p>
      </div>
      <p className="mt-4 text-base font-semibold text-slate-900">{decision.headline}</p>
      <p className="mt-3 rounded-md border border-slate-100 bg-slate-50/90 px-3 py-2 text-sm leading-relaxed text-slate-800">
        {decision.forretningsscore_hva_er_det}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-100 bg-white px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Hva skjer nå</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{decision.hva_skjer_na}</p>
        </div>
        <div className="rounded-md border border-slate-100 bg-white px-3 py-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Hva forventer vi</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{decision.hva_forventer_vi}</p>
        </div>
      </div>
      <div className="mt-4">
        <h3 className="text-xs font-semibold text-slate-700">Effekt i korthet</h3>
        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
          {decision.effekt_i_korthet.map((line, i) => (
            <li key={i} className="break-words pl-0.5">
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4">
        <h3 className="text-xs font-semibold text-slate-700">Tillit og åpenhet</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {decision.tillit.map((row, i) => (
            <li
              key={i}
              className={`rounded-md border border-slate-100 bg-slate-50/80 py-2 pl-3 pr-2 text-sm ${trustIndicatorStripClass(row.signal)}`}
            >
              <p className="font-medium text-slate-900">{row.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{row.body}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 rounded-md border border-slate-100 bg-white px-3 py-2">
        <h3 className="text-xs font-semibold text-slate-700">Konfidensnivå</h3>
        <p className="mt-1 inline-block rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800">
          {decision.konfidens.niva}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{decision.konfidens.forklaring}</p>
      </div>
      <details className="mt-4 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-slate-700">Teknisk utdyping (drift)</summary>
        <ul className="mt-2 list-inside list-disc space-y-1 pb-1 text-sm text-slate-700">
          {decision.bullets.map((b, i) => (
            <li key={i} className="break-words pl-0.5">
              {b}
            </li>
          ))}
        </ul>
      </details>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-medium text-slate-500">Forretningsscore</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatPct01(objective.score, 1)}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-medium text-slate-500">Samlet trykk (aggregat)</dt>
          <dd className="text-lg font-semibold tabular-nums text-slate-900">{formatPct01(objective.stress, 1)}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-medium text-slate-500">Aktiv strategi</dt>
          <dd className="text-lg font-semibold text-slate-900">{STRATEGY_LABELS_NB[objective.strategy_mode]}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <dt className="text-xs font-medium text-slate-500">Styring</dt>
          <dd className="text-sm font-medium text-slate-900">
            {objective.strategy_override_source
              ? STRATEGY_SOURCE_NB[objective.strategy_override_source]
              : "Automatikk (gap + hysterese)"}
            {objective.strategy_forced ? " · låst" : ""}
          </dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">Margin · mål vs faktisk</p>
          <p className="mt-1 text-sm text-slate-800">Mål (etter modus): {formatUsd(objective.targets.target_margin_usd)}</p>
          <p className="text-sm text-slate-800">
            Faktisk: {formatUsd(totals.margin_usd)}
            {totals.revenue_partial ? " (delvis MRR)" : ""}
          </p>
        </div>
        <div className="rounded-md border border-slate-100 bg-slate-50/80 px-3 py-2">
          <p className="text-xs font-medium text-slate-500">Vekst · mål vs faktisk</p>
          <p className="mt-1 text-sm text-slate-800">Mål: {formatPct01(objective.targets.target_growth_rel, 2)}</p>
          <p className="text-sm text-slate-800">Realisert: {formatPct01(objective.achieved_growth_rel, 2)}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Gap-stress (0–100 %): margin {formatPct01(objective.margin_gap_stress, 0)}, vekst {formatPct01(objective.growth_gap_stress, 0)} ·
        sjekkpunkt {objective.checkpoint_period ?? "–"}
      </p>
    </>
  );
}

export function AiMotorDemoTopLinks(props: { demoDeepLinkHref: string; variant: "live" | "sample" }) {
  const { demoDeepLinkHref, variant } = props;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
      <Link
        href={demoDeepLinkHref}
        className="min-h-[44px] inline-flex items-center font-semibold text-slate-900 underline decoration-slate-400 underline-offset-[3px] hover:decoration-slate-700"
      >
        Se demo
      </Link>
      <span className="hidden text-slate-300 sm:inline" aria-hidden>
        ·
      </span>
      <span className="max-w-full text-xs text-slate-500 sm:text-sm">
        {variant === "sample" ? (
          <>
            Deep link til animasjonen på denne siden (
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">se_demo=1</code>
            ).
          </>
        ) : (
          <>
            Du vet du lurer på tallet — her er deep link (
            <code className="rounded bg-slate-100 px-1 py-0.5 text-[11px]">se_demo=1</code>
            ).
          </>
        )}
      </span>
    </div>
  );
}
