"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  EditorAiShell,
  type EditorAiShellStatus,
} from "@/app/(backoffice)/backoffice/content/_components/EditorAiShell";

const STATUSES: EditorAiShellStatus[] = [
  "idle",
  "generating",
  "result_ready",
  "apply_pending",
  "applied",
  "failed",
];

const CTA_ACTIONS = [
  { id: "improve", label: "Forbedre tekst" },
  { id: "shorten", label: "Forkort" },
  { id: "clarify", label: "Gjør tydeligere" },
  { id: "rewrite", label: "Omskriv CTA" },
];

/** Minimal result preview for verification (matches shell result area pattern). */
function MockCtaResult() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-white p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          Original
        </p>
        <p className="mt-1 text-sm text-[rgb(var(--lp-text))]">Tittel: Eksempel CTA</p>
        <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">Brødtekst og knappetekst…</p>
      </div>
      <div className="rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
          Forslag
        </p>
        <p className="mt-1 text-sm text-[rgb(var(--lp-text))]">Tittel: Forbedret CTA-tittel</p>
        <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">Kort brødtekst. Knapp: Les mer</p>
      </div>
    </div>
  );
}

export default function AiEditorVerificationPage() {
  const [shellOpen, setShellOpen] = useState(false);
  const [status, setStatus] = useState<EditorAiShellStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [simulateGated, setSimulateGated] = useState(false);
  const [simulateGenerating, setSimulateGenerating] = useState(false);

  const openShell = useCallback(() => {
    setShellOpen(true);
    setStatus("idle");
    setErrorMessage(null);
    setSimulateGenerating(false);
  }, []);

  const closeShell = useCallback(() => {
    setShellOpen(false);
    setStatus("idle");
    setErrorMessage(null);
    setSimulateGenerating(false);
  }, []);

  const runSimulateGenerating = useCallback(() => {
    setStatus("generating");
    setSimulateGenerating(true);
    setErrorMessage(null);
    setTimeout(() => {
      setStatus("result_ready");
      setSimulateGenerating(false);
    }, 2000);
  }, []);

  const setFailed = useCallback(() => {
    setStatus("failed");
    setErrorMessage("Simulert feil for verifikasjon. Prøv igjen eller lukk.");
  }, []);

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-xl font-semibold text-[rgb(var(--lp-text))]">
        AI editor — verifikasjon
      </h1>
      <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
        Intern verifikasjonsside. Verifiser shell-rendering, asynkrone tilstander, resultat, accept/reject og feature-gating. Ikke offentlig UX.
      </p>

      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <p>
          Denne siden bruker den reelle <code className="rounded bg-amber-100 px-1">EditorAiShell</code> og
          samme tilstander som CTA AI-flyten i content-editoren. Bruk kontrollene nedenfor for å gå gjennom alle tilstander.
        </p>
      </div>

      {/* Feature gating simulation */}
      <section className="lp-motion-card lp-glass-surface mt-6 rounded-xl border border-[rgb(var(--lp-border))] p-4">
        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Feature-gating</h2>
        <label className="mt-2 flex items-center gap-2 text-sm text-[rgb(var(--lp-text))]">
          <input
            type="checkbox"
            checked={simulateGated}
            onChange={(e) => setSimulateGated(e.target.checked)}
            className="h-4 w-4 rounded border-[rgb(var(--lp-border))]"
          />
          Simuler gating (skjul trigger når avkrysset)
        </label>
      </section>

      {/* Trigger */}
      <section className="mt-6 rounded-lg border border-[rgb(var(--lp-border))] bg-white p-4">
        <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Trigger</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Åpne CTA AI-shell. Når gating er simulert, vises ikke knappen.
        </p>
        {!simulateGated && (
          <button
            type="button"
            onClick={openShell}
            className="lp-motion-btn mt-2 min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
          >
            Åpne AI-editor-shell (CTA)
          </button>
        )}
      </section>

      {/* Manual status override (when shell open) */}
      {shellOpen && (
        <section className="lp-motion-card lp-glass-surface mt-6 rounded-xl border border-[rgb(var(--lp-border))] p-4">
          <h2 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Sett tilstand (verifikasjon)</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setStatus(s);
                  if (s === "failed") setErrorMessage("Simulert feil.");
                  else setErrorMessage(null);
                }}
                className="min-h-[36px] rounded border border-[rgb(var(--lp-border))] bg-white px-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]"
              >
                {s}
              </button>
            ))}
            <button
              type="button"
              onClick={runSimulateGenerating}
              disabled={simulateGenerating}
              className="min-h-[36px] rounded border border-slate-600 bg-slate-600 px-2 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {simulateGenerating ? "Genererer…" : "Simuler generating → result"}
            </button>
            <button
              type="button"
              onClick={setFailed}
              className="min-h-[36px] rounded border border-red-200 bg-red-50 px-2 text-xs font-medium text-red-800 hover:bg-red-100"
            >
              Simuler feil
            </button>
          </div>
        </section>
      )}

      <p className="mt-6 flex flex-wrap items-center gap-4 text-sm text-[rgb(var(--lp-muted))]">
        <Link
          href="/backoffice/internal/ai-verification"
          className="underline underline-offset-2 hover:text-[rgb(var(--lp-text))]"
        >
          Full API-verifikasjon (ekte kall) →
        </Link>
        <Link
          href="/backoffice/ai"
          className="underline underline-offset-2 hover:text-[rgb(var(--lp-text))]"
        >
          ← Tilbake til AI Control
        </Link>
      </p>

      {/* Shell: real component, all states */}
      <EditorAiShell
        open={shellOpen}
        onClose={closeShell}
        title="Forbedre CTA med AI"
        contextLabel="Verifikasjon · CTA-blokk (mock)"
        status={status}
        errorMessage={errorMessage}
        promptContent={
          <div className="space-y-3">
            <p className="text-xs text-[rgb(var(--lp-muted))]">
              Velg handling. Forslag vises under; du bruker det ikke automatisk.
            </p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="AI-handlinger">
              {CTA_ACTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  disabled={status === "generating"}
                  onClick={() => runSimulateGenerating()}
                  className="lp-motion-btn min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
                >
                  {status === "generating" ? "Genererer…" : label}
                </button>
              ))}
            </div>
          </div>
        }
        resultContent={status === "result_ready" ? <MockCtaResult /> : undefined}
        footerActions={
          status === "generating" ? (
            <button
              type="button"
              onClick={closeShell}
              className="lp-motion-btn min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            >
              Avbryt
            </button>
          ) : status === "failed" ? (
            <>
              <button
                type="button"
                onClick={closeShell}
                className="lp-motion-btn min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
              >
                Lukk
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("generating");
                  setErrorMessage(null);
                  setSimulateGenerating(true);
                  setTimeout(() => {
                    setStatus("result_ready");
                    setSimulateGenerating(false);
                  }, 1500);
                }}
                className="lp-motion-btn min-h-[44px] rounded-lg border border-slate-700 bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
              >
                Prøv igjen
              </button>
            </>
          ) : status === "result_ready" ? (
            <>
              <button
                type="button"
                onClick={closeShell}
                className="lp-motion-btn min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
              >
                Forkast forslag
              </button>
              <button
                type="button"
                onClick={closeShell}
                className="lp-motion-btn min-h-[44px] rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
              >
                Bruk forslag
              </button>
            </>
          ) : undefined
        }
      />
    </div>
  );
}
