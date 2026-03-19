"use client";

/**
 * Internal verification surface: proves AI editor workflow end-to-end.
 * - Trigger, shell, action, loading, result, diff, accept/reject, failure/retry, feature gating.
 * - Reuses EditorAiShell and same state machine; calls real text-improve API.
 * - Backoffice layout: superadmin only. No auth weakening.
 */
import { useCallback, useEffect, useState } from "react";
import { EditorAiShell, type EditorAiShellStatus } from "@/app/(backoffice)/backoffice/content/_components/EditorAiShell";

type CapabilityStatus = "loading" | "available" | "unavailable";

function VerificationDiff({ original, suggestion }: { original: string; suggestion: string }) {
  const label = "text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]";
  const panel = "rounded-lg border border-[rgb(var(--lp-border))] p-3 min-h-[60px] overflow-hidden";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className={panel + " bg-white"}>
        <p className={label}>Opprinnelig</p>
        <p className="mt-1 break-words text-sm text-[rgb(var(--lp-text))]">{original || "—"}</p>
      </div>
      <div className={panel + " bg-[rgb(var(--lp-card))]/50"}>
        <p className={label}>Forslag</p>
        <p className="mt-1 break-words text-sm text-[rgb(var(--lp-text))]">{suggestion || "—"}</p>
      </div>
    </div>
  );
}

export default function AiVerificationPage() {
  const [capability, setCapability] = useState<CapabilityStatus>("loading");
  const [shellOpen, setShellOpen] = useState(false);
  const [status, setStatus] = useState<EditorAiShellStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState("");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<"improve" | "shorten" | null>(null);
  const [inputText, setInputText] = useState("Eksempeltekst for verifikasjon");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/backoffice/ai/capability", { credentials: "include" })
      .then((res) => res.json().catch(() => ({})))
      .then((data: { data?: { enabled?: boolean }; enabled?: boolean }) => {
        if (cancelled) return;
        const enabled = data?.data?.enabled ?? data?.enabled === true;
        setCapability(enabled ? "available" : "unavailable");
      })
      .catch(() => {
        if (!cancelled) setCapability("unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const runAction = useCallback(
    async (action: "improve" | "shorten") => {
      setLastAction(action);
      setOriginal(inputText);
      setStatus("generating");
      setError(null);
      setSuggestion(null);
      try {
        const res = await fetch("/api/backoffice/ai/text-improve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text: inputText, action }),
        });
        const data = (await res.json().catch(() => ({}))) as { data?: { suggestion?: string }; message?: string; error?: string };
        if (!res.ok) {
          const msg = typeof data.message === "string" ? data.message : typeof data.error === "string" ? data.error : `Feil (${res.status})`;
          setError(msg);
          setStatus("failed");
          return;
        }
        const sug = typeof data.data?.suggestion === "string" ? data.data.suggestion : "";
        setSuggestion(sug);
        setStatus("result_ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Ukjent feil");
        setStatus("failed");
      }
    },
    [inputText]
  );

  const accept = useCallback(() => {
    if (suggestion == null) return;
    setStatus("apply_pending");
    setInputText(suggestion);
    setStatus("applied");
  }, [suggestion]);

  const close = useCallback(() => {
    setShellOpen(false);
    setStatus("idle");
    setError(null);
    setOriginal("");
    setSuggestion(null);
    setLastAction(null);
  }, []);

  const disabled = capability !== "available";

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-lg font-semibold text-[rgb(var(--lp-text))]">
        AI-editor verifikasjon (intern)
      </h1>
      <p className="text-sm text-[rgb(var(--lp-muted))]">
        Denne siden verifiserer: trigger → shell → handling → lasting → resultat → diff → bruk/forkast → feil/retry → feature-gating.
      </p>

      {/* Feature gating */}
      <section className="lp-motion-card lp-glass-surface rounded-xl border border-[rgb(var(--lp-border))] p-4">
        <h2 className="text-sm font-medium text-[rgb(var(--lp-text))]">Feature gating</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          GET /api/backoffice/ai/capability:{" "}
          {capability === "loading"
            ? "Sjekker…"
            : capability === "available"
              ? "AI: Tilgjengelig"
              : "AI: Ikke tilgjengelig"}
        </p>
      </section>

      {/* Trigger */}
      <section className="lp-motion-card lp-glass-surface rounded-xl border border-[rgb(var(--lp-border))] p-4">
        <h2 className="text-sm font-medium text-[rgb(var(--lp-text))]">Trigger</h2>
        <button
          type="button"
          onClick={() => setShellOpen(true)}
          disabled={disabled}
          className="mt-2 min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))]"
        >
          Åpne AI-verifikasjon
        </button>
      </section>

      <EditorAiShell
        open={shellOpen}
        onClose={close}
        title="AI-verifikasjon"
        contextLabel="Intern showcase: trigger, shell, action, loading, result, diff, accept/reject, failure/retry"
        status={status}
        errorMessage={error}
        promptContent={
          <div className="space-y-3">
            <label className="block text-xs font-medium text-[rgb(var(--lp-text))]">
              Inndata (brukes som «sidetittel» i test)
            </label>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full rounded border border-[rgb(var(--lp-border))] px-2 py-1.5 text-sm text-[rgb(var(--lp-text))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))]"
              placeholder="Tekst"
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Handlinger">
              <button
                type="button"
                disabled={disabled || status === "generating"}
                onClick={() => runAction("improve")}
                className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))]"
                aria-busy={status === "generating" && lastAction === "improve"}
              >
                {status === "generating" && lastAction === "improve" ? "Genererer…" : "Forbedre"}
              </button>
              <button
                type="button"
                disabled={disabled || status === "generating"}
                onClick={() => runAction("shorten")}
                className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))]"
                aria-busy={status === "generating" && lastAction === "shorten"}
              >
                {status === "generating" && lastAction === "shorten" ? "Genererer…" : "Forkort"}
              </button>
            </div>
          </div>
        }
        resultContent={
          status === "result_ready" && suggestion != null ? (
            <VerificationDiff original={original} suggestion={suggestion} />
          ) : undefined
        }
        footerActions={
          status === "generating" ? (
            <button type="button" onClick={close} className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium">
              Avbryt
            </button>
          ) : status === "failed" ? (
            <>
              <button type="button" onClick={close} className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium">
                Lukk
              </button>
              <button
                type="button"
                onClick={() => runAction(lastAction ?? "improve")}
                className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-700 px-3 py-1.5 text-xs font-medium text-white"
              >
                Prøv igjen
              </button>
            </>
          ) : status === "result_ready" && suggestion != null ? (
            <>
              <button type="button" onClick={close} className="min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium">
                Forkast forslag
              </button>
              <button type="button" onClick={accept} className="min-h-[44px] rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white">
                Bruk forslag
              </button>
            </>
          ) : undefined
        }
        ariaLabel="AI-verifikasjon showcase"
      />
    </div>
  );
}
