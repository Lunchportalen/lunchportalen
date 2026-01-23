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

function monoStyle(size = 12): React.CSSProperties {
  return { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: size };
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

function toastBg(kind: "ok" | "err") {
  return kind === "ok" ? "rgba(20, 160, 80, 0.10)" : "rgba(220, 0, 0, 0.08)";
}
function toastBorder(kind: "ok" | "err") {
  return kind === "ok" ? "rgba(20, 160, 80, 0.30)" : "rgba(220, 0, 0, 0.25)";
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
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      {/* Toast */}
      {toast ? (
        <div
          style={{
            position: "fixed",
            right: 16,
            bottom: 16,
            zIndex: 50,
            padding: "10px 12px",
            borderRadius: 14,
            border: `1px solid ${toastBorder(toast.kind)}`,
            background: toastBg(toast.kind),
            backdropFilter: "blur(8px)",
            fontWeight: 800,
          }}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      ) : null}

      {/* Sticky header */}
      <div
        style={{
          position: "sticky",
          top: 10,
          zIndex: 10,
          padding: 12,
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.08)",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(10px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Audit</div>
            <div style={{ opacity: 0.7, fontSize: 13 }}>
              {loading ? "Laster…" : `${viewItems.length} vist • ${critCount} kritiske (heuristikk)`}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={() => setPreset("critical")}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: preset === "critical" ? "white" : "transparent",
                cursor: "pointer",
                fontWeight: 900,
              }}
              aria-label="Vis kritiske hendelser først"
            >
              Kritiske først
            </button>

            <button
              onClick={() => setPreset("all")}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: preset === "all" ? "white" : "transparent",
                cursor: "pointer",
                fontWeight: 900,
              }}
              aria-label="Vis alle hendelser"
            >
              Alle
            </button>

            <button
              onClick={() => {
                setCursor(null);
                load({ resetCursor: true, clearCursorBeforeFetch: true });
              }}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                background: "white",
                cursor: "pointer",
                fontWeight: 900,
              }}
              aria-label="Oppdater audit"
            >
              Oppdater
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
              placeholder="companyId (uuid)"
              style={{
                padding: 10,
                borderRadius: 12,
                border: companyIdInvalid ? "1px solid rgba(220,0,0,0.45)" : "1px solid rgba(0,0,0,0.15)",
                minWidth: 300,
                background: "white",
              }}
              aria-label="Filtrer på companyId"
            />
            {companyIdInvalid ? <div style={{ fontSize: 12, color: "crimson" }}>Ugyldig UUID.</div> : null}
          </div>

          <input
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="action (f.eks. company_)"
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              minWidth: 220,
              background: "white",
            }}
            aria-label="Filtrer på action"
          />

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Søk (email, action, entity, summary)…"
            style={{
              padding: 10,
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              minWidth: 280,
              background: "white",
            }}
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
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              cursor: "pointer",
              fontWeight: 900,
            }}
            aria-label="Nullstill filtre"
          >
            Nullstill
          </button>
        </div>

        {err ? (
          <div
            style={{
              marginTop: 10,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(220,0,0,0.25)",
              background: "rgba(220,0,0,0.06)",
              color: "crimson",
              fontWeight: 800,
            }}
          >
            {err}
          </div>
        ) : null}
      </div>

      {/* Table */}
      <div style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "180px 220px 220px 1fr 90px",
            padding: 12,
            background: "#fafafa",
            fontWeight: 700,
          }}
        >
          <div>Tid</div>
          <div>Actor</div>
          <div>Action</div>
          <div>Entity / summary</div>
          <div style={{ textAlign: "right" }}>Kopier</div>
        </div>

        {!loading && viewItems.length === 0 ? (
          <div style={{ padding: 12, borderTop: "1px solid #eee", opacity: 0.75 }}>Ingen hendelser funnet.</div>
        ) : null}

        {viewItems.map((it) => {
          const critical = isCritical(it);

          return (
            <div
              key={it.id}
              style={{
                display: "grid",
                gridTemplateColumns: "180px 220px 220px 1fr 90px",
                padding: 12,
                borderTop: "1px solid #eee",
                alignItems: "start",
                gap: 8,
                background: preset === "critical" && critical ? "#fff7f7" : "transparent",
              }}
            >
              <div style={monoStyle(12)}>{isoNice(it.created_at)}</div>

              <div style={{ fontSize: 13 }}>
                <div style={{ fontWeight: 900 }}>{pickActorEmail(it)}</div>
                <div style={{ opacity: 0.7 }}>{pickActorRole(it)}</div>
              </div>

              <div style={{ ...monoStyle(12), fontWeight: 800 }}>
                {it.action ?? "-"}{" "}
                {preset === "critical" && critical ? (
                  <span
                    style={{
                      marginLeft: 8,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(220,0,0,0.25)",
                      background: "rgba(220,0,0,0.06)",
                      fontSize: 11,
                      fontWeight: 900,
                      color: "crimson",
                    }}
                  >
                    KRITISK
                  </span>
                ) : null}
              </div>

              <div style={{ fontSize: 13 }}>
                <div style={{ opacity: 0.85 }}>
                  {pickEntityType(it)} /{" "}
                  <span style={monoStyle(12)}>{pickEntityId(it)}</span>
                </div>
                {it.summary ? <div style={{ marginTop: 4 }}>{it.summary}</div> : null}

                <div style={{ marginTop: 8 }}>
                  <Link
                    href={`/superadmin/audit/${it.id}`}
                    style={{ textDecoration: "none", fontWeight: 900, opacity: 0.9 }}
                    aria-label="Åpne audit-detalj"
                  >
                    Åpne detalj →
                  </Link>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={async () => {
                    const ok = await copyText(it.id);
                    showToast(ok ? "ok" : "err", ok ? "ID kopiert" : "Kunne ikke kopiere");
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
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
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <button
          disabled={!nextCursor || loading}
          onClick={() => {
            if (!nextCursor) return;
            setCursor(nextCursor);
          }}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            cursor: nextCursor && !loading ? "pointer" : "not-allowed",
            opacity: nextCursor && !loading ? 1 : 0.5,
            background: "white",
            fontWeight: 900,
          }}
          aria-label="Neste side"
        >
          Neste side
        </button>

        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {items.length > 0 ? `Viser ${items.length} (limit ${limit})` : null}
          {cursor ? ` • cursor: ${isoNice(cursor)}` : null}
        </div>
      </div>
    </div>
  );
}
