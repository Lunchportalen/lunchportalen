// components/admin/BlockedState.tsx
"use client";

import { useMemo, useState, type ReactNode } from "react";

type SystemLevel = "ok" | "followup" | "critical";

export type BlockedStateProps = {
  title: string;
  body: string;

  /**
   * Optional “what now” steps.
   * Keep short. 2–4 bullets is ideal.
   */
  nextSteps?: string[];

  /**
   * Optional primary action (e.g. SupportReportButton)
   */
  action?: ReactNode;

  /**
   * Optional technical meta for diagnostics.
   * This MUST NOT dominate the UI.
   */
  meta?: { label: string; value: string }[];

  /**
   * Optional severity styling
   */
  level?: SystemLevel;

  /**
   * Compact mode for small panels
   */
  compact?: boolean;
};

function cx(...s: Array<string | false | null | undefined>) {
  return s.filter(Boolean).join(" ");
}

function LevelPill({ level }: { level: SystemLevel }) {
  const label = level === "critical" ? "Kritisk" : level === "followup" ? "Krever tiltak" : "OK";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 select-none",
        level === "ok" && "bg-emerald-50 text-emerald-800 ring-emerald-200",
        level === "followup" && "bg-amber-50 text-amber-900 ring-amber-200",
        level === "critical" && "bg-rose-50 text-rose-900 ring-rose-200"
      )}
    >
      <span
        className={cx(
          "h-2 w-2 rounded-full",
          level === "ok" && "bg-emerald-500",
          level === "followup" && "bg-amber-500",
          level === "critical" && "bg-rose-500"
        )}
      />
      {label}
    </span>
  );
}

/* =========================================================
   Clipboard helpers (robust)
========================================================= */

async function copyToClipboard(text: string): Promise<boolean> {
  const t = (text ?? "").toString();
  if (!t) return false;

  // 1) Modern API
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    // fall through
  }

  // 2) Fallback (execCommand)
  try {
    if (typeof document === "undefined") return false;
    const el = document.createElement("textarea");
    el.value = t;
    el.setAttribute("readonly", "true");
    el.style.position = "fixed";
    el.style.left = "-9999px";
    el.style.top = "0";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.focus();
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

function CopyButton({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      onClick={async () => {
        const ok = await copyToClipboard(text);
        setState(ok ? "copied" : "failed");
        window.setTimeout(() => setState("idle"), 1200);
      }}
      className={cx(
        "inline-flex items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition select-none",
        "bg-white/70 text-neutral-900 ring-black/10 hover:bg-white active:scale-[0.99]"
      )}
      aria-label="Kopier teknisk info"
    >
      {state === "copied" ? "Kopiert" : state === "failed" ? "Kunne ikke kopiere" : "Kopier"}
    </button>
  );
}

/* =========================================================
   Component
========================================================= */

/**
 * Enterprise-grade “blocked” panel:
 * - Calm, premium, and actionable
 * - Technical details are hidden behind a disclosure
 * - Text is selectable/copyable (important for auth + diagnostics)
 */
export default function BlockedState(props: BlockedStateProps) {
  const level: SystemLevel = props.level ?? "followup";
  const compact = Boolean(props.compact);

  const metaText = useMemo(() => {
    const rows = props.meta ?? [];
    if (!rows.length) return "";
    return rows
      .map((m) => `${String(m.label ?? "").trim()}: ${String(m.value ?? "").trim()}`)
      .filter(Boolean)
      .join("\n");
  }, [props.meta]);

  const hasMeta = Boolean((props.meta?.length ?? 0) > 0);

  return (
    <section
      className={cx(
        "rounded-3xl bg-white/80 ring-1 ring-black/5 shadow-[0_12px_44px_-34px_rgba(0,0,0,.40)] backdrop-blur",
        "select-text",
        compact ? "p-5" : "p-6"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <LevelPill level={level} />
            <div className="text-sm font-semibold text-neutral-900 select-text">{props.title}</div>
          </div>

          <p className="mt-2 text-sm text-neutral-600 select-text">{props.body}</p>
        </div>

        {props.action ? <div className="shrink-0">{props.action}</div> : null}
      </div>

      {props.nextSteps?.length ? (
        <div className="mt-5 rounded-2xl bg-neutral-50/70 p-4 ring-1 ring-black/5 select-text">
          <div className="text-xs font-semibold tracking-wide text-neutral-700 select-text">Neste steg</div>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            {props.nextSteps.slice(0, 6).map((s, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 select-none" />
                <span className="min-w-0 select-text">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {hasMeta ? (
        <details className="mt-5 group">
          {/* ✅ Summary is clickable, but text remains selectable */}
          <summary
            className={cx(
              "cursor-pointer list-none rounded-2xl bg-white/60 px-4 py-3 text-sm font-semibold text-neutral-900",
              "ring-1 ring-black/10 transition hover:bg-white",
              "select-text"
            )}
          >
            <span className="inline-flex items-center gap-2">
              <span className="opacity-70 group-open:opacity-100 select-text">Teknisk info</span>

              {/* These tiny bits can be non-selectable (doesn't block the text) */}
              <span className="text-xs font-semibold text-neutral-500 group-open:hidden select-none">Vis</span>
              <span className="text-xs font-semibold text-neutral-500 hidden group-open:inline select-none">Skjul</span>

              <span
                className={cx(
                  "ml-1 inline-block h-2 w-2 rotate-45 border-r-2 border-b-2 border-neutral-400 transition",
                  "group-open:rotate-[225deg]",
                  "select-none"
                )}
                aria-hidden="true"
              />
            </span>
          </summary>

          <div className="mt-3 rounded-2xl bg-neutral-950 p-4 ring-1 ring-black/10">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-white/80 select-text">Diagnose</div>
              {metaText ? <CopyButton text={metaText} /> : null}
            </div>

            {/* ✅ Pre is selectable and copyable */}
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-white/85 select-text">
              {metaText}
            </pre>
          </div>
        </details>
      ) : null}
    </section>
  );
}
