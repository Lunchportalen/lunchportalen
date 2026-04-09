// app/superadmin/audit/audit-client.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

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
  meta?: { limit: number; nextCursor: string | null; source: string; filters?: any };
  items?: AuditItem[];
  data?: {
    items: AuditItem[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    filters?: any;
  };
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
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
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

function datetimeLocalToIso(s: string): string | null {
  const x = s.trim();
  if (!x) return null;
  const d = new Date(x);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function previewBeforeAfter(detail: unknown) {
  if (!detail || typeof detail !== "object" || Array.isArray(detail)) return null;
  const o = detail as Record<string, unknown>;
  const b = o.before;
  const a = o.after;
  if (b === undefined && a === undefined) return null;
  const cap = 140;
  const bs = b !== undefined ? JSON.stringify(b).slice(0, cap) : "";
  const as = a !== undefined ? JSON.stringify(a).slice(0, cap) : "";
  return (
    <div className="mt-1 max-w-full break-words font-mono text-[10px] text-[rgb(var(--lp-muted))]">
      {b !== undefined ? <div>before: {bs}{bs.length >= cap ? "…" : ""}</div> : null}
      {a !== undefined ? <div>after: {as}{as.length >= cap ? "…" : ""}</div> : null}
    </div>
  );
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

async function readJsonSafe(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function isAbort(e: any) {
  return e?.name === "AbortError" || String(e?.message || "").toLowerCase().includes("aborted");
}

/* =========================
   ✅ Discriminated union (TS-safe)
========================= */
type NormOk = { ok: true; items: AuditItem[]; nextCursor: string | null; limit: number };
type NormErr = { ok: false; message: string };
type Norm = NormOk | NormErr;

function normalizeApi(j: ApiOk | ApiErr | null): Norm {
  if (!j || (j as any).ok !== true) {
    const e = (j ?? { ok: false, error: "UNKNOWN", message: "Ukjent feil" }) as ApiErr;
    return { ok: false as const, message: e.message || e.error || "Ukjent feil" };
  }

  const root = j as any;
  const payload =
    root?.data && typeof root.data === "object" && !Array.isArray(root.data) ? root.data : root;

  if (Array.isArray(payload.items)) {
    return {
      ok: true as const,
      items: payload.items,
      nextCursor: payload.meta?.nextCursor ?? null,
      limit: payload.meta?.limit ?? 100,
    };
  }

  if (payload.data && Array.isArray(payload.data.items)) {
    return {
      ok: true as const,
      items: payload.data.items,
      nextCursor: payload.data.meta?.nextCursor ?? null,
      limit: payload.data.meta?.limit ?? payload.data.limit ?? 100,
    };
  }

  return { ok: true as const, items: [], nextCursor: null, limit: 100 };
}

export default function AuditClient() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [preset, setPreset] = useState<"critical" | "all">("critical");

  const [companyId, setCompanyId] = useState("");
  const [action, setAction] = useState("");
  const [q, setQ] = useState("");

  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [companyIdDeb, setCompanyIdDeb] = useState("");
  const [actionDeb, setActionDeb] = useState("");
  const [qDeb, setQDeb] = useState("");

  const [sinceLocal, setSinceLocal] = useState("");
  const [untilLocal, setUntilLocal] = useState("");
  const [auditSourceLocal, setAuditSourceLocal] = useState<"" | "user" | "system" | "ai">("");
  const [sinceDeb, setSinceDeb] = useState("");
  const [untilDeb, setUntilDeb] = useState("");
  const [auditSourceDeb, setAuditSourceDeb] = useState<"" | "user" | "system" | "ai">("");

  const abortRef = useRef<AbortController | null>(null);

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
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setCompanyIdDeb(companyId.trim());
      setActionDeb(action.trim());
      setQDeb(q.trim());
      setSinceDeb(sinceLocal.trim());
      setUntilDeb(untilLocal.trim());
      setAuditSourceDeb(auditSourceLocal);
    }, 250);
    return () => window.clearTimeout(t);
  }, [companyId, action, q, sinceLocal, untilLocal, auditSourceLocal]);

  const limit = 100;
  const companyIdInvalid = companyId.trim().length > 0 && !isUuid(companyId.trim());

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(limit));

    if (companyIdDeb && isUuid(companyIdDeb)) {
      p.set("companyId", companyIdDeb); // if API supports
      p.set("entity_id", companyIdDeb); // harmless if ignored
    }

    if (actionDeb) p.set("action", actionDeb);
    if (qDeb) p.set("q", qDeb);
    const sinceIso = datetimeLocalToIso(sinceDeb);
    if (sinceIso) p.set("since", sinceIso);
    const untilIso = datetimeLocalToIso(untilDeb);
    if (untilIso) p.set("until", untilIso);
    if (auditSourceDeb) p.set("auditSource", auditSourceDeb);
    if (cursor) p.set("cursor", cursor);

    return p.toString();
  }, [companyIdDeb, actionDeb, qDeb, sinceDeb, untilDeb, auditSourceDeb, cursor]);

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
        if (companyIdDeb && isUuid(companyIdDeb)) {
          p.set("companyId", companyIdDeb);
          p.set("entity_id", companyIdDeb);
        }
        if (actionDeb) p.set("action", actionDeb);
        if (qDeb) p.set("q", qDeb);
        const sIso = datetimeLocalToIso(sinceDeb);
        if (sIso) p.set("since", sIso);
        const uIso = datetimeLocalToIso(untilDeb);
        if (uIso) p.set("until", uIso);
        if (auditSourceDeb) p.set("auditSource", auditSourceDeb);
        url += "?" + p.toString();
      } else {
        url += "?" + qs;
      }

      const r = await fetch(url, {
        cache: "no-store",
        signal: ac.signal,
        headers: { "Cache-Control": "no-store" },
      });

      const j = (await readJsonSafe(r)) as ApiOk | ApiErr | null;
      const norm = normalizeApi(j);

      // ✅ TS-safe narrowing (no negation)
      if (norm.ok === false) {
        throw new Error(norm.message);
      }

      setItems(norm.items ?? []);
      setNextCursor(norm.nextCursor ?? null);

      if (resetCursor) setCursor(null);
    } catch (e: any) {
      if (isAbort(e)) return;
      setErr(String(e?.message ?? e));
      setItems([]);
      setNextCursor(null);
    } finally {
      if (!ac.signal.aborted) setLoading(false);
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

  const [selectedIdx, setSelectedIdx] = useState<number>(-1);

  useEffect(() => {
    if (viewItems.length === 0) {
      setSelectedIdx(-1);
      return;
    }
    setSelectedIdx((prev) => {
      if (prev < 0) return -1;
      return Math.min(prev, viewItems.length - 1);
    });
  }, [viewItems.length]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName?.toLowerCase();
      const isTyping = tag === "input" || tag === "textarea" || (el as any)?.isContentEditable;
      if (isTyping) return;
      if (viewItems.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((p) => (p < 0 ? 0 : Math.min(viewItems.length - 1, p + 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((p) => (p < 0 ? 0 : Math.max(0, p - 1)));
      } else if (e.key === "Enter") {
        if (selectedIdx < 0) return;
        e.preventDefault();
        const it = viewItems[selectedIdx];
        if (it?.id) window.location.href = `/superadmin/audit/${it.id}`;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedIdx(-1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIdx, viewItems]);

  const navBtn =
    "rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]";

  return (
    <div className="mx-auto w-full max-w-6xl p-4">
      {/* Toast */}
      {toast ? (
        <div
          className={[
            "lp-glass-surface fixed right-4 bottom-4 z-50 rounded-xl px-3 py-2 text-xs font-semibold",
            toastClass(toast.kind),
          ].join(" ")}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      ) : null}

      {/* Sticky header */}
      <div className="lp-glass-surface sticky top-3 z-10 rounded-card p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <div className="text-[22px] font-semibold">Audit</div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">
              {loading ? "Laster…" : `${viewItems.length} vist • ${critCount} kritiske (heuristikk)`}{" "}
              <span className="text-[rgb(var(--lp-muted))]">•</span>{" "}
              <span className="text-[rgb(var(--lp-muted))]">Tastatur: ↑/↓, Enter, Esc</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/superadmin" className={navBtn}>
              Dashboard
            </Link>
            <Link href="/superadmin/companies" className={navBtn}>
              Firma
            </Link>
            <Link href="/superadmin/system" className={navBtn}>
              System
            </Link>

            <button
              onClick={() => setPreset("critical")}
              className={[
                "rounded-lg border px-3 py-2 text-xs font-semibold",
                preset === "critical"
                  ? "border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-text))]"
                  : "border-[rgba(var(--lp-border),0.6)] text-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-surface))]",
              ].join(" ")}
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
            >
              Alle
            </button>

            <button
              onClick={() => {
                setCursor(null);
                load({ resetCursor: true, clearCursorBeforeFetch: true });
              }}
              className={navBtn}
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
            />
            {companyIdInvalid ? <div className="text-xs text-[rgb(var(--lp-crit-tx))]">Ugyldig UUID.</div> : null}
          </div>

          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="action (f.eks. COMPANY_CREATED)"
            className="min-w-[220px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
          />

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk (email, action, entity, summary)…"
            className="min-w-[280px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
          />

          <input
            type="datetime-local"
            value={sinceLocal}
            onChange={(e) => setSinceLocal(e.target.value)}
            aria-label="Fra dato"
            className="min-w-[200px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
          />

          <input
            type="datetime-local"
            value={untilLocal}
            onChange={(e) => setUntilLocal(e.target.value)}
            aria-label="Til dato"
            className="min-w-[200px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
          />

          <select
            value={auditSourceLocal}
            onChange={(e) => setAuditSourceLocal((e.target.value || "") as "" | "user" | "system" | "ai")}
            aria-label="Kilde"
            className="min-w-[160px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
          >
            <option value="">Alle kilder</option>
            <option value="user">Bruker</option>
            <option value="system">System</option>
            <option value="ai">AI</option>
          </select>

          <button
            onClick={() => {
              setCompanyId("");
              setAction("");
              setQ("");
              setSinceLocal("");
              setUntilLocal("");
              setAuditSourceLocal("");
              setCursor(null);
              setPreset("critical");
              setSelectedIdx(-1);
              load({ resetCursor: true, clearCursorBeforeFetch: true });
              showToast("ok", "Filtre nullstilt");
            }}
            className={navBtn}
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
      <div className="mt-3 rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))]">
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

        {viewItems.map((it, idx) => {
          const critical = isCritical(it);
          const selected = idx === selectedIdx;

          const rowClass = selected
            ? "bg-[rgba(var(--lp-text),0.04)]"
            : preset === "critical" && critical
            ? "bg-[rgba(var(--lp-crit-bg),0.7)]"
            : "";

          return (
            <div
              key={it.id}
              className={[
                "grid grid-cols-[180px_220px_220px_1fr_90px] items-start gap-2 border-t border-[rgba(var(--lp-border),0.7)] px-3 py-2",
                selected ? "outline outline-2 outline-[rgba(var(--lp-text),0.15)] -outline-offset-2" : "",
                rowClass,
              ].join(" ")}
              role="row"
              aria-selected={selected}
            >
              <div className="lp-mono text-xs">{isoNice(it.created_at)}</div>

              <div className="text-xs">
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const txt = String(pickActorEmail(it));
                    const ok = await copyText(txt);
                    showToast(ok ? "ok" : "err", ok ? "E-post kopiert" : "Kunne ikke kopiere");
                  }}
                  className="text-left text-xs font-semibold text-[rgb(var(--lp-text))] hover:underline"
                >
                  {pickActorEmail(it)}
                </button>
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
                  {pickEntityType(it)} /{" "}
                  <button
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const txt = String(pickEntityId(it));
                      const ok = await copyText(txt);
                      showToast(ok ? "ok" : "err", ok ? "Entity-id kopiert" : "Kunne ikke kopiere");
                    }}
                    className="lp-mono text-xs font-semibold text-[rgb(var(--lp-text))] hover:underline"
                  >
                    {pickEntityId(it)}
                  </button>
                </div>

                {it.summary ? <div className="mt-1 text-[rgb(var(--lp-text))]">{it.summary}</div> : null}

                {previewBeforeAfter(it.detail)}

                <div className="mt-2">
                  <Link
                    href={`/superadmin/audit/${it.id}`}
                    className="text-xs font-semibold text-[rgb(var(--lp-text))] hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Åpne detalj →
                  </Link>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setSelectedIdx(idx)}
                  className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-white px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
                >
                  Marker
                </button>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const ok = await copyText(it.id);
                    showToast(ok ? "ok" : "err", ok ? "ID kopiert" : "Kunne ikke kopiere");
                  }}
                  className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
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
            setSelectedIdx(-1);
          }}
          className={[
            "rounded-lg border px-4 py-2 text-xs font-semibold",
            nextCursor && !loading
              ? "border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
              : "border-[rgba(var(--lp-border),0.6)] bg-[rgb(var(--lp-surface-2))] text-[rgb(var(--lp-muted))] opacity-70",
          ].join(" ")}
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
