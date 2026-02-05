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
  company_id?: string | null;
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

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function isoNice(ts: string | null | undefined) {
  if (!ts) return "-";
  const s = String(ts);
  return s.replace("T", " ").slice(0, 19);
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
  return it.entity?.id ?? it.entity_id ?? it.company_id ?? "-";
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

function toastClass(kind: "ok" | "err") {
  return kind === "ok"
    ? "border-[rgba(var(--lp-ok-bd),0.9)] bg-[rgba(var(--lp-ok-bg),0.92)] text-[rgb(var(--lp-ok-tx))]"
    : "border-[rgba(var(--lp-crit-bd),0.9)] bg-[rgba(var(--lp-crit-bg),0.92)] text-[rgb(var(--lp-crit-tx))]";
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AuditClient() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Preset
  const [preset, setPreset] = useState<"critical" | "all">("critical");

  // Filters
  const [companyId, setCompanyId] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");

  // Pagination cursor
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Debounce input
  const [companyIdDeb, setCompanyIdDeb] = useState("");
  const [actionDeb, setActionDeb] = useState("");
  const [qDeb, setQDeb] = useState("");

  const abortRef = useRef<AbortController | null>(null);

  // Toast
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const toastTimer = useRef<number | null>(null);

  function showToast(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  }

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setCompanyIdDeb(companyId.trim());
      setActionDeb(action.trim());
      setQDeb(q.trim());
    }, 250);
    return () => window.clearTimeout(t);
  }, [companyId, action, q]);

  const limit = 100;
  const companyIdInvalid = companyId.trim().length > 0 && !isUuid(companyId.trim());

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));
    if (companyIdDeb) p.set("companyId", companyIdDeb);
    if (actionDeb) p.set("action", actionDeb);
    if (qDeb) p.set("q", qDeb);
    if (cursor) p.set("cursor", cursor);
    return p.toString();
  }, [companyIdDeb, actionDeb, qDeb, cursor]);

  async function load(opts?: { resetCursor?: boolean; clearCursorBeforeFetch?: boolean }) {
    const resetCursor = !!opts?.resetCursor;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr(null);

    try {
      let url = "/api/superadmin/audit";
      if (resetCursor && opts?.clearCursorBeforeFetch) {
        const p = new URLSearchParams();
        p.set("limit", String(limit));
        if (companyIdDeb) p.set("companyId", companyIdDeb);
        if (actionDeb) p.set("action", actionDeb);
        if (qDeb) p.set("q", qDeb);
        url += "?" + p.toString();
      } else {
        url += "?" + qs;
      }

      const r = await fetch(url, { cache: "no-store", signal: ac.signal });
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

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
    <div className="mx-auto max-w-[1100px] p-4">
      {/* Toast */}
      {toast ? (
        <div
          className={[
            "fixed right-4 bottom-4 z-50 rounded-xl border px-3 py-2 text-xs font-semibold backdrop-blur",
            toastClass(toast.kind),
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      ) : null}

      {/* Sticky header */}
      <div className="sticky top-3 z-10 rounded-2xl border border-[rgba(var(--lp-border),0.9)] bg-[rgba(var(--lp-surface),0.85)] p-3 backdrop-blur">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[22px] font-semibold">Audit</div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">
              {loading ? "Laster…" : `${viewItems.length} vist • ${critCount} kritiske (heuristikk)`}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                load({ resetCursor: true, clearCursorBeforeFetch: true });
              }}
              className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
              aria-label="Oppdater audit"
            >
              Oppdater
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="grid gap-1">
            <input
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="companyId (uuid)"
              className={[
                "min-w-[300px] rounded-lg border px-3 py-2 text-sm",
                companyIdInvalid
                  ? "border-[rgba(var(--lp-crit-bd),0.9)] bg-[rgba(var(--lp-crit-bg),0.6)]"
                  : "border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))]",
              ].join(" ")}
              aria-label="Filtrer på companyId"
            />
            {companyIdInvalid ? (
              <div className="text-xs text-[rgb(var(--lp-crit-tx))]">Ugyldig UUID.</div>
            ) : null}
          </div>

          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="action (f.eks. company_)"
            className="min-w-[220px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
            aria-label="Filtrer på action"
          />

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk (email, action, entity, summary)…"
            className="min-w-[280px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
            aria-label="Søk i audit"
          />

          <button
            onClick={() => {
              setCompanyId("");
              setAction("");
              setQ("");
              setCursor(null);
              setPreset("critical");
              load({ resetCursor: true, clearCursorBeforeFetch: true });
              showToast("ok", "Filtre nullstilt");
            }}
            className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
            aria-label="Nullstill filtre"
          >
            Nullstill
          </button>
        </div>

        {err ? (
          <div className="mt-3 rounded-xl border border-[rgba(var(--lp-crit-bd),0.9)] bg-[rgba(var(--lp-crit-bg),0.9)] px-3 py-2 text-sm font-semibold text-[rgb(var(--lp-crit-tx))]">
            {err}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div className="mt-3 overflow-hidden rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))]">
        <div className="grid grid-cols-[180px_220px_220px_1fr_90px] gap-2 border-b border-[rgba(var(--lp-border),0.7)] bg-[rgb(var(--lp-surface-2))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">
          <div>Tid</div>
          <div>Actor</div>
          <div>Action</div>
          <div>Entity / summary</div>
          <div className="text-right">Kopier</div>
        </div>

        {!loading && viewItems.length === 0 ? (
          <div className="border-t border-[rgba(var(--lp-border),0.7)] px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">
            Ingen hendelser funnet.
          </div>
        ) : null}

        {viewItems.map((it) => {
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
                  <span className="ml-2 inline-flex items-center rounded-full border border-[rgba(var(--lp-crit-bd),0.95)] bg-[rgba(var(--lp-crit-bg),0.85)] px-2 py-0.5 text-[10px] font-semibold text-[rgb(var(--lp-crit-tx))]">
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
        })}
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center gap-2">
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

        <div className="text-xs text-[rgb(var(--lp-muted))]">
          {items.length > 0 ? `Viser ${items.length} (limit ${limit})` : null}
          {cursor ? ` • cursor: ${isoNice(cursor)}` : null}
        </div>
      </div>
    </div>
  );
}
