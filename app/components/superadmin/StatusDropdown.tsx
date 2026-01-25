// components/superadmin/StatusDropdown.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type CompanyStatus = "pending" | "active" | "paused" | "closed";

type Props = {
  companyId: string;
  status: CompanyStatus;
  disabled?: boolean;

  /** Kalles etter vellykket oppdatering */
  onChanged?: (next: CompanyStatus) => void;

  /** Valgfritt: override API-endpoint */
  endpoint?: string;
};

const LABEL: Record<CompanyStatus, string> = {
  pending: "Pending",
  active: "Active",
  paused: "Paused",
  closed: "Closed",
};

function pillClasses(s: CompanyStatus) {
  if (s === "active") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (s === "paused") return "bg-amber-50 text-amber-900 ring-amber-200";
  if (s === "closed") return "bg-neutral-100 text-neutral-900 ring-neutral-200";
  return "bg-sky-50 text-sky-900 ring-sky-200";
}

async function readJsonSafe(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function toServerStatus(s: CompanyStatus) {
  return s.toUpperCase();
}

type Tone = "info" | "ok" | "warn" | "stop";

function toneDot(t: Tone) {
  if (t === "ok") return "bg-emerald-500";
  if (t === "warn") return "bg-amber-500";
  if (t === "stop") return "bg-neutral-700";
  return "bg-sky-500";
}

function optionTone(s: CompanyStatus): Tone {
  if (s === "active") return "ok";
  if (s === "paused") return "warn";
  if (s === "closed") return "stop";
  return "info";
}

/**
 * ✅ 10/10: segmented-control i menyen
 * - Én linje med 4 valg (enterprise)
 * - Closed krever ekstra bekreftelse (egen rad under)
 */
export default function StatusDropdown({ companyId, status, disabled, onChanged, endpoint }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const apiUrl = useMemo(() => endpoint ?? `/api/superadmin/companies/${companyId}/status`, [endpoint, companyId]);

  // Click outside
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      const el = rootRef.current;
      if (!el) return;
      if (e.target && el.contains(e.target as Node)) return;
      setOpen(false);
      setConfirmClose(false);
      setErr(null);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // ESC to close + focus return
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setConfirmClose(false);
        setErr(null);
        setTimeout(() => btnRef.current?.focus(), 0);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function setStatus(next: CompanyStatus) {
    if (disabled || busy) return;
    if (next === status) {
      setOpen(false);
      setConfirmClose(false);
      setErr(null);
      return;
    }

    setBusy(true);
    setErr(null);

    try {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ status: toServerStatus(next) }),
      });

      const data = await readJsonSafe(res);
      if (!res.ok || !data?.ok) {
        const msg =
          data?.message ||
          data?.error ||
          (res.status === 401
            ? "Ikke innlogget (401)."
            : res.status === 403
              ? "Ingen tilgang (403)."
              : `Kunne ikke oppdatere status (HTTP ${res.status}).`);
        throw new Error(String(msg));
      }

      onChanged?.(next);
      setOpen(false);
      setConfirmClose(false);
    } catch (e: any) {
      setErr(String(e?.message || "Ukjent feil"));
    } finally {
      setBusy(false);
    }
  }

  function choose(next: CompanyStatus) {
    if (disabled || busy) return;

    if (next === "closed" && status !== "closed") {
      setConfirmClose(true);
      return;
    }
    setStatus(next);
  }

  const currentLabel = LABEL[status];

  const SEG: CompanyStatus[] = ["pending", "active", "paused", "closed"];

  return (
    <div ref={rootRef} className="relative inline-flex">
      {/* Control */}
      <button
        ref={btnRef}
        type="button"
        disabled={disabled || busy}
        onClick={() => {
          setOpen((v) => !v);
          setConfirmClose(false);
          setErr(null);
        }}
        className={[
          "inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-extrabold ring-1 transition",
          "bg-white hover:bg-neutral-50 ring-[rgb(var(--lp-border))]",
          disabled || busy ? "opacity-60" : "",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span
          className={[
            "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-black ring-1 leading-none",
            pillClasses(status),
          ].join(" ")}
        >
          {currentLabel}
        </span>

        <span className="text-[12px] font-black text-neutral-900">Status</span>

        <svg
          className={["h-4 w-4 text-neutral-700 transition", open ? "rotate-180" : ""].join(" ")}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Menu */}
      {open && (
        <div
          role="menu"
          className={[
            "absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-2xl bg-white shadow-xl ring-1",
            "ring-[rgb(var(--lp-border))]",
          ].join(" ")}
        >
          {/* Header */}
          <div className="px-3 py-3 border-b border-[rgb(var(--lp-border))]">
            <div className="text-[11px] font-extrabold tracking-wide text-neutral-600">STATUS</div>
            <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
              Endring påvirker tilgang og bestilling for hele firmaet.
            </div>
          </div>

          {/* Error */}
          {err && (
            <div className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50/60 border-b border-rose-200">
              {err}
            </div>
          )}

          <div className="px-3 py-3">
            {/* Segmented control */}
            <div className="rounded-2xl bg-neutral-50 p-1 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="grid grid-cols-4 gap-1">
                {SEG.map((s) => {
                  const active = s === status;
                  const tone = optionTone(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      role="menuitem"
                      onClick={() => choose(s)}
                      disabled={busy || disabled}
                      className={[
                        "relative rounded-xl px-2 py-2 text-center text-[11px] font-extrabold transition ring-1",
                        active
                          ? "bg-white text-neutral-950 ring-[rgb(var(--lp-border))]"
                          : "bg-transparent text-neutral-700 ring-transparent hover:bg-white/70 hover:ring-[rgb(var(--lp-border))]",
                        s === "closed" && status !== "closed" ? "text-neutral-800" : "",
                      ].join(" ")}
                      title={LABEL[s]}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <span className={["inline-block h-2 w-2 rounded-full", toneDot(tone)].join(" ")} />
                        <span>{LABEL[s]}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Closed confirm */}
            {confirmClose && status !== "closed" && (
              <div className="mt-3 rounded-2xl bg-neutral-50 p-3 ring-1 ring-neutral-200">
                <div className="text-xs font-black text-neutral-900">Stenge firma?</div>
                <div className="mt-1 text-xs font-semibold text-[rgb(var(--lp-muted))]">
                  Mister tilgang umiddelbart. Kan åpnes igjen av Superadmin.
                </div>

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-white px-3 py-2 text-xs font-extrabold ring-1 ring-[rgb(var(--lp-border))] hover:bg-neutral-50"
                    onClick={() => setConfirmClose(false)}
                    disabled={busy}
                  >
                    Avbryt
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-neutral-900 px-3 py-2 text-xs font-extrabold text-white hover:bg-neutral-800"
                    onClick={() => setStatus("closed")}
                    disabled={busy}
                  >
                    Steng firma
                  </button>
                </div>
              </div>
            )}

            {/* Busy hint */}
            {busy && (
              <div className="mt-2 text-[11px] font-semibold text-neutral-600">
                Oppdaterer status…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
