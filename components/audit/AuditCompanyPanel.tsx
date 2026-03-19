"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type AuditItem = {
  id: string;
  created_at: string;

  actor_user_id?: string | null;
  actor_email?: string | null;
  actor_role?: string | null;

  action?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;

  summary?: string | null;
  detail?: any | null;

  actor?: { email?: string | null; role?: string | null } | null;
  entity?: { type?: string | null; id?: string | null } | null;
};

type ApiOk = {
  ok: true;
  rid: string;
  meta: { limit: number; nextCursor: string | null; source: string };
  items: AuditItem[];
};

type ApiErr = {
  ok: false;
  rid?: string;
  error: string;
  message?: string;
  detail?: any;
};

function isoNice(ts: string | null | undefined) {
  if (!ts) return "-";
  return String(ts).replace("T", " ").slice(0, 19);
}

function toastClass(kind: "ok" | "err") {
  return kind === "ok"
    ? "border-[rgba(var(--lp-ok-bd),0.9)] bg-[rgba(var(--lp-ok-bg),0.92)] text-[rgb(var(--lp-ok-tx))]"
    : "border-[rgba(var(--lp-crit-bd),0.9)] bg-[rgba(var(--lp-crit-bg),0.92)] text-[rgb(var(--lp-crit-tx))]";
}

function pickActorEmail(it: AuditItem) {
  return it.actor?.email ?? it.actor_email ?? "-";
}
function pickActorRole(it: AuditItem) {
  return it.actor?.role ?? it.actor_role ?? "-";
}
function pickEntityType(it: AuditItem) {
  return it.entity?.type ?? it.entity_type ?? "-";
}
function pickEntityId(it: AuditItem) {
  return it.entity?.id ?? it.entity_id ?? "-";
}

function isCritical(it: AuditItem) {
  const a = String(it.action ?? "").toLowerCase();
  const s = String(it.summary ?? "").toLowerCase();
  const d = JSON.stringify(it.detail ?? {}).toLowerCase();

  return (
    a.includes("fail") ||
    a.includes("error") ||
    a.includes("forbidden") ||
    a.includes("denied") ||
    a.includes("rls") ||
    a.includes("blocked") ||
    a.includes("unauthorized") ||
    s.includes("fail") ||
    s.includes("error") ||
    s.includes("forbud") ||
    d.includes("fail") ||
    d.includes("error") ||
    d.includes("forbidden") ||
    d.includes("unauthorized")
  );
}


async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AuditCompanyPanel({
  companyId,
  initialOpen = false,
  initialLimit = 200,
}: {
  companyId: string;
  initialOpen?: boolean;
  initialLimit?: number;
}) {
  const storageKey = useMemo(() => `lp_sa_company_audit_open_${companyId}`, [companyId]);

  const [open, setOpen] = useState(initialOpen);
  const [preset, setPreset] = useState<"critical" | "all">("critical");

  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  // Toast
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  function showToast(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1600);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") setOpen(true);
      if (v === "0") setOpen(false);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  function persistOpen(v: boolean) {
    setOpen(v);
    try {
      localStorage.setItem(storageKey, v ? "1" : "0");
    } catch {
      // ignore
    }
  }

  const limit = Math.max(1, Math.min(500, Math.floor(initialLimit)));

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    p.set("companyId", companyId);
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, [companyId, cursor, limit]);

  async function load(resetCursor = false) {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr(null);

    try {
      const r = await fetch(`/api/superadmin/audit?${qs}`, { cache: "no-store", signal: ac.signal });
      const j = (await r.json()) as ApiOk | ApiErr;

      if (!j || (j as any).ok !== true) {
        const je = j as ApiErr;
        throw new Error(je?.message || je?.error || "Ukjent feil");
      }

      const ok = j as ApiOk;
      setItems(ok.items ?? []);
      setNextCursor(ok.meta?.nextCursor ?? null);

      if (resetCursor) setCursor(null);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(String(e?.message ?? e));
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, qs]);

  const viewItems = useMemo(() => {
    const base = [...items].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    if (preset === "critical") {
      const crit: AuditItem[] = [];
      const rest: AuditItem[] = [];
      for (const it of base) (isCritical(it) ? crit : rest).push(it);
      return [...crit, ...rest];
    }
    return base;
  }, [items, preset]);

  const critCount = useMemo(() => viewItems.filter((x) => isCritical(x)).length, [viewItems]);

  return (
    <div className="lp-card relative overflow-hidden">
      {/* Toast */}
      {toast ? (
        <div
          className={[
            "lp-glass-surface absolute right-3 bottom-3 z-20 rounded-xl px-3 py-2 text-xs font-semibold",
            toastClass(toast.kind),
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      ) : null}

      <button
        onClick={() => persistOpen(!open)}
        className="flex w-full items-center justify-between gap-3 border-b border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface-2))] px-4 py-3 text-left"
        aria-expanded={open}
        aria-label="Åpne/lukk audit"
      >
        <div>
          <div className="text-sm font-semibold">Audit</div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            {open ? (loading ? "Laster…" : `${viewItems.length} vist • ${critCount} kritiske`) : "Åpne for å se hendelser."}
          </div>
        </div>
        <div className="text-[rgb(var(--lp-muted))]">{open ? "▾" : "▸"}</div>
      </button>

      {open ? (
        <div className="grid gap-3 p-4">
          {/* Mini sticky controls */}
          <div className="lp-glass-surface sticky top-3 z-10 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2">
            <button
              onClick={() => setPreset("critical")}
              className={[
                "rounded-lg border px-3 py-2 text-xs font-semibold",
                preset === "critical"
                  ? "border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-text))]"
                  : "border-[rgba(var(--lp-border),0.6)] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-surface))]",
              ].join(" ")}
              aria-label="Vis kritiske hendelser først"
            >
              Kritiske først
            </button>

            <button
              onClick={() => setPreset("all")}
              className={[
                "rounded-lg border px-3 py-2 text-xs font-semibold",
                preset === "all"
                  ? "border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-text))]"
                  : "border-[rgba(var(--lp-border),0.6)] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-surface))]",
              ].join(" ")}
              aria-label="Vis alle hendelser"
            >
              Alle
            </button>

            <button
              onClick={() => {
                setCursor(null);
                load(true);
              }}
              className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
              aria-label="Oppdater audit"
            >
              Oppdater
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={async () => {
                  const ok = await copyText(companyId);
                  showToast(ok ? "ok" : "err", ok ? "CompanyId kopiert" : "Kunne ikke kopiere");
                }}
                className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
                aria-label="Kopier companyId"
              >
                Kopier companyId
              </button>
            </div>
          </div>

          {err ? (
            <div className="rounded-xl border border-[rgba(var(--lp-crit-bd),0.9)] bg-[rgba(var(--lp-crit-bg),0.9)] px-3 py-2 text-sm text-[rgb(var(--lp-crit-tx))]">
              {err}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))]">
            <div className="grid grid-cols-[180px_220px_220px_1fr_90px] gap-2 border-b border-[rgba(var(--lp-border),0.7)] bg-[rgb(var(--lp-surface-2))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">
              <div>Tid</div>
              <div>Actor</div>
              <div>Action</div>
              <div>Entity / summary</div>
              <div className="text-right">Kopier</div>
            </div>

            {loading ? (
              <div className="border-t border-[rgba(var(--lp-border),0.7)] px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">
                Henter…
              </div>
            ) : viewItems.length === 0 ? (
              <div className="border-t border-[rgba(var(--lp-border),0.7)] px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">
                Ingen hendelser.
              </div>
            ) : (
              viewItems.map((it) => {
                const critical = isCritical(it);

                return (
                  <div
                    key={it.id}
                    className={[
                      "grid grid-cols-[180px_220px_220px_1fr_90px] items-start gap-2 border-t border-[rgba(var(--lp-border),0.7)] px-3 py-2",
                      preset === "critical" && critical ? "bg-[rgba(var(--lp-crit-bg),0.7)]" : "",
                    ].join(" ")}
                  >
                    <div className="lp-mono text-xs">{isoNice(it.created_at)}</div>

                    <div className="text-xs">
                      <div className="font-semibold text-[rgb(var(--lp-text))]">{pickActorEmail(it)}</div>
                      <div className="text-[rgb(var(--lp-muted))]">{pickActorRole(it)}</div>
                    </div>

                    <div className="lp-mono text-xs font-semibold text-[rgb(var(--lp-text))]">
                      {it.action ?? "-"}{" "}
                      {preset === "critical" && critical ? (
                        <span className="ml-2 inline-flex items-center rounded-full border border-[rgba(var(--lp-crit-bd),0.95)] bg-[rgba(var(--lp-crit-bg),0.85)] px-2 py-0.5 text-xs font-semibold text-[rgb(var(--lp-crit-tx))]">
                          KRITISK
                        </span>
                      ) : null}
                    </div>

                    <div className="text-xs">
                      <div className="text-[rgb(var(--lp-muted))]">
                        {pickEntityType(it)} / <span className="lp-mono">{pickEntityId(it)}</span>
                      </div>
                      {it.summary ? <div className="mt-1 text-[rgb(var(--lp-text))]">{it.summary}</div> : null}

                      <div className="mt-2">
                        <Link
                          href={`/superadmin/audit/${it.id}`}
                          className="text-xs font-semibold text-[rgb(var(--lp-text))] hover:underline"
                          aria-label="Åpne audit-detalj"
                        >
                          Åpne detalj →
                        </Link>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        onClick={async () => {
                          const ok = await copyText(it.id);
                          showToast(ok ? "ok" : "err", ok ? "ID kopiert" : "Kunne ikke kopiere");
                        }}
                        className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
                        aria-label="Kopier id"
                      >
                        ID
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={!nextCursor || loading}
              onClick={() => {
                if (!nextCursor) return;
                setCursor(nextCursor);
              }}
              className={[
                "rounded-lg border px-4 py-2 text-xs font-semibold",
                nextCursor && !loading
                  ? "border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
                  : "border-[rgba(var(--lp-border),0.6)] bg-[rgb(var(--lp-surface-2))] text-[rgb(var(--lp-muted))] opacity-70",
              ].join(" ")}
              aria-label="Neste side"
            >
              Neste side
            </button>

            <div className="text-xs text-[rgb(var(--lp-muted))]">{cursor ? `cursor: ${isoNice(cursor)}` : ""}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
