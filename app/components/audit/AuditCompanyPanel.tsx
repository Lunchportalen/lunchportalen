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
    <div style={{ border: "1px solid #eee", borderRadius: 16, overflow: "hidden", position: "relative" }}>
      {/* Toast */}
      {toast ? (
        <div
          style={{
            position: "absolute",
            right: 12,
            bottom: 12,
            zIndex: 20,
            padding: "10px 12px",
            borderRadius: 14,
            border: `1px solid ${toastBorder(toast.kind)}`,
            background: toastBg(toast.kind),
            backdropFilter: "blur(8px)",
            fontWeight: 900,
          }}
          role="status"
          aria-live="polite"
        >
          {toast.msg}
        </div>
      ) : null}

      <button
        onClick={() => persistOpen(!open)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: 14,
          background: "#fafafa",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
        aria-expanded={open}
        aria-label="Åpne/lukk audit"
      >
        <div>
          <div style={{ fontWeight: 900 }}>Audit</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            {open ? (loading ? "Laster…" : `${viewItems.length} vist • ${critCount} kritiske`) : "Åpne for å se hendelser."}
          </div>
        </div>
        <div style={{ opacity: 0.7 }}>{open ? "▾" : "▸"}</div>
      </button>

      {open ? (
        <div style={{ padding: 14, display: "grid", gap: 12 }}>
          {/* Mini sticky controls */}
          <div
            style={{
              position: "sticky",
              top: 10,
              zIndex: 5,
              padding: 10,
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              background: "rgba(255,255,255,0.85)",
              backdropFilter: "blur(10px)",
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={() => setPreset("critical")}
              style={{
                padding: "8px 10px",
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
                padding: "8px 10px",
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
                load(true);
              }}
              style={{
                padding: "8px 10px",
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

            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={async () => {
                  const ok = await copyText(companyId);
                  showToast(ok ? "ok" : "err", ok ? "CompanyId kopiert" : "Kunne ikke kopiere");
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(0,0,0,0.15)",
                  background: "white",
                  cursor: "pointer",
                  fontWeight: 900,
                }}
                aria-label="Kopier companyId"
              >
                Kopier companyId
              </button>
            </div>
          </div>

          {err ? (
            <div style={{ padding: 12, borderRadius: 12, background: "#fff3f3", border: "1px solid #f3c2c2" }}>{err}</div>
          ) : null}

          <div style={{ border: "1px solid #eee", borderRadius: 14, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "180px 220px 220px 1fr 90px",
                padding: 12,
                background: "#fafafa",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <div>Tid</div>
              <div>Actor</div>
              <div>Action</div>
              <div>Entity / summary</div>
              <div style={{ textAlign: "right" }}>Kopier</div>
            </div>

            {loading ? (
              <div style={{ padding: 12, borderTop: "1px solid #eee" }}>Henter…</div>
            ) : viewItems.length === 0 ? (
              <div style={{ padding: 12, borderTop: "1px solid #eee", opacity: 0.75 }}>Ingen hendelser.</div>
            ) : (
              viewItems.map((it) => {
                const critical = isCritical(it);

                return (
                  <div
                    key={it.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "180px 220px 220px 1fr 90px",
                      padding: 12,
                      borderTop: "1px solid #eee",
                      gap: 8,
                      background: preset === "critical" && critical ? "#fff7f7" : "transparent",
                      alignItems: "start",
                    }}
                  >
                    <div style={monoStyle(12)}>{isoNice(it.created_at)}</div>

                    <div style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 900 }}>{pickActorEmail(it)}</div>
                      <div style={{ opacity: 0.7 }}>{pickActorRole(it)}</div>
                    </div>

                    <div style={{ ...monoStyle(12), fontWeight: 900 }}>
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
                        {pickEntityType(it)} / <span style={monoStyle(12)}>{pickEntityId(it)}</span>
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
              })
            )}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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

            <div style={{ fontSize: 12, opacity: 0.7 }}>{cursor ? `cursor: ${isoNice(cursor)}` : ""}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
