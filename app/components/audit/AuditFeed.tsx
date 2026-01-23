// components/audit/AuditFeed.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AuditRow = {
  id: string;
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string | null;
};

type AuditDetail = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  summary: string | null;
  detail: any | null;
};

type ApiOk = {
  ok: true;
  rid?: string;
  meta?: { limit: number; nextCursor: string | null; source: "audit_events" };
  items?: AuditRow[];
};

type ApiErr = {
  ok: false;
  rid?: string;
  error?: string;
  message?: string;
  detail?: any;
};

type ApiRes = ApiOk | ApiErr;

function fmtTs(ts: string) {
  try {
    return new Date(ts).toLocaleString("nb-NO");
  } catch {
    return ts;
  }
}

function isOk(res: any): res is ApiOk {
  return !!res && typeof res === "object" && res.ok === true;
}

function isErr(res: any): res is ApiErr {
  return !!res && typeof res === "object" && res.ok === false;
}

function safeText(v: any, maxLen: number) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, maxLen) : "";
}

/** Minimal modal (ingen libs) */
function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // focus close button for accessibility
    const t = setTimeout(() => closeBtnRef.current?.focus(), 0);

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);

    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "min(1000px, 96vw)",
          maxHeight: "90vh",
          overflow: "auto",
          background: "white",
          borderRadius: 18,
          border: "1px solid rgba(0,0,0,0.12)",
          boxShadow: "0 20px 70px rgba(0,0,0,0.25)",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "white",
            borderBottom: "1px solid rgba(0,0,0,0.08)",
            padding: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
          }}
        >
          <div style={{ fontWeight: 900 }}>{title}</div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(0,0,0,0.15)",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Lukk
          </button>
        </div>

        <div style={{ padding: 14 }}>{children}</div>
      </div>
    </div>
  );
}

export default function AuditFeed({
  companyId,
  initialLimit = 200,
  title,
}: {
  companyId?: string;
  initialLimit?: number;
  title?: string;
}) {
  const router = useRouter();

  const [q, setQ] = useState("");
  const [action, setAction] = useState("");

  const [items, setItems] = useState<AuditRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // bulletproof: blokkér parallelle loads + ignorer gamle svar
  const inFlightRef = useRef(false);
  const loadTokenRef = useRef(0);

  // modal detail
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AuditDetail | null>(null);
  const [detailErr, setDetailErr] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const baseUrl = useMemo(() => {
    const p = new URLSearchParams();
    p.set("limit", String(initialLimit));
    if (companyId) p.set("companyId", companyId);

    const a = safeText(action, 120);
    if (a) p.set("action", a);

    const qq = safeText(q, 120);
    if (qq) p.set("q", qq);

    return `/api/superadmin/audit?${p.toString()}`;
  }, [companyId, initialLimit, action, q]);

  async function load(first: boolean) {
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    const myToken = ++loadTokenRef.current;

    try {
      setErr(null);

      const url = new URL(baseUrl, window.location.origin);
      if (!first && cursor) url.searchParams.set("cursor", cursor);

      const r = await fetch(url.toString(), { cache: "no-store" });

      let raw: any = null;
      try {
        raw = await r.json();
      } catch {
        raw = null;
      }

      // ignorer hvis en nyere load har startet
      if (myToken !== loadTokenRef.current) return;

      if (!r.ok) {
        const msg =
          (raw && typeof raw === "object" && (raw.message || raw.error)) ||
          `HTTP ${r.status} – kunne ikke hente audit.`;
        setErr(String(msg));
        return;
      }

      if (!isOk(raw)) {
        setErr((isErr(raw) && (raw.message || raw.error)) || "Kunne ikke hente audit.");
        return;
      }

      const newItems = (raw.items ?? []) as AuditRow[];
      const next = raw.meta?.nextCursor ?? null;

      if (first) setItems(newItems);
      else setItems((prev) => [...prev, ...newItems]);

      setCursor(next);
      setHasMore(!!next && newItems.length > 0);
    } catch (e: any) {
      if (myToken === loadTokenRef.current) {
        setErr(String(e?.message ?? "Ukjent feil ved henting av audit."));
      }
    } finally {
      // alltid frigjør
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    startTransition(() => {
      setCursor(null);
      load(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseUrl]);

  async function openDetail(id: string) {
    setOpen(true);
    setDetailId(id);
    setDetail(null);
    setDetailErr(null);
    setDetailLoading(true);

    try {
      const r = await fetch(`/api/superadmin/audit/${id}`, { cache: "no-store" });
      let raw: any = null;
      try {
        raw = await r.json();
      } catch {
        raw = null;
      }

      if (!r.ok || !raw?.ok) {
        setDetailErr(raw?.message || raw?.error || `HTTP ${r.status} – kunne ikke hente audit-detaljer.`);
        return;
      }

      setDetail(raw.audit as AuditDetail);
      router.prefetch(`/superadmin/audit/${id}`);
    } catch (e: any) {
      setDetailErr(String(e?.message ?? "Ukjent feil"));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setOpen(false);
    setDetailId(null);
    setDetail(null);
    setDetailErr(null);
    setDetailLoading(false);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {title ? (
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
        </div>
      ) : null}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk (actor, action, entity_type, summary)"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            minWidth: 320,
          }}
        />

        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filtrer på action (f.eks. COMPANY_ACTIVATED)"
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            minWidth: 320,
          }}
        />

        <button
          onClick={() => startTransition(() => load(true))}
          disabled={pending || inFlightRef.current}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            cursor: pending || inFlightRef.current ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {pending || inFlightRef.current ? "Laster…" : "Oppdater"}
        </button>

        {err ? <div style={{ color: "crimson", fontWeight: 700 }}>{err}</div> : null}
      </div>

      <div style={{ border: "1px solid rgba(0,0,0,0.10)", borderRadius: 16, overflow: "hidden" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "170px 220px 1fr 260px",
            gap: 0,
            padding: 12,
            fontWeight: 800,
            background: "rgba(0,0,0,0.03)",
          }}
        >
          <div>Tid</div>
          <div>Actor</div>
          <div>Action / Summary</div>
          <div>Entity</div>
        </div>

        {items.map((x) => (
          <button
            key={x.id}
            onClick={() => openDetail(x.id)}
            onMouseEnter={() => router.prefetch(`/superadmin/audit/${x.id}`)}
            style={{
              display: "grid",
              gridTemplateColumns: "170px 220px 1fr 260px",
              gap: 0,
              padding: 12,
              width: "100%",
              textAlign: "left",
              border: "none",
              borderTop: "1px solid rgba(0,0,0,0.06)",
              background: "white",
              cursor: "pointer",
            }}
          >
            <div>{fmtTs(x.created_at)}</div>
            <div>
              <div style={{ fontWeight: 700 }}>{x.actor_email ?? "—"}</div>
              <div style={{ opacity: 0.7, fontSize: 12 }}>{x.actor_role ?? "—"}</div>
            </div>
            <div>
              <div style={{ fontWeight: 900 }}>{x.action}</div>
              <div style={{ opacity: 0.8 }}>{x.summary ?? ""}</div>
            </div>
            <div style={{ opacity: 0.85 }}>
              {x.entity_type} <span style={{ opacity: 0.6 }}>({x.entity_id})</span>
            </div>
          </button>
        ))}

        {!items.length && !pending && !inFlightRef.current ? (
          <div style={{ padding: 12, opacity: 0.7 }}>Ingen audit-hendelser.</div>
        ) : null}
      </div>

      {hasMore ? (
        <button
          onClick={() => startTransition(() => load(false))}
          disabled={pending || inFlightRef.current}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid rgba(0,0,0,0.15)",
            background: "white",
            width: 180,
            cursor: pending || inFlightRef.current ? "not-allowed" : "pointer",
            fontWeight: 800,
          }}
        >
          {pending || inFlightRef.current ? "Laster…" : "Last eldre"}
        </button>
      ) : null}

      <Modal open={open} title="Audit detail" onClose={closeDetail}>
        {detailLoading ? (
          <div style={{ padding: 12, borderRadius: 14, border: "1px solid rgba(0,0,0,0.10)", background: "white" }}>
            Laster…
          </div>
        ) : null}

        {detailErr ? (
          <div
            style={{
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(220,0,0,0.25)",
              background: "rgba(220,0,0,0.05)",
              color: "crimson",
              fontWeight: 800,
            }}
          >
            {detailErr}
          </div>
        ) : null}

        {!detailLoading && !detailErr && detail ? (
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "white",
              }}
            >
              <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 10 }}>
                <div style={{ opacity: 0.65 }}>Tid</div>
                <div style={{ fontWeight: 900 }}>{fmtTs(detail.created_at)}</div>

                <div style={{ opacity: 0.65 }}>Actor</div>
                <div>
                  <div style={{ fontWeight: 900 }}>{detail.actor_email ?? "—"}</div>
                  <div style={{ opacity: 0.7, fontSize: 12 }}>{detail.actor_role ?? "—"}</div>
                </div>

                <div style={{ opacity: 0.65 }}>Action</div>
                <div style={{ fontWeight: 900 }}>{detail.action}</div>

                <div style={{ opacity: 0.65 }}>Entity</div>
                <div style={{ fontWeight: 800 }}>
                  {detail.entity_type} <span style={{ opacity: 0.6 }}>({detail.entity_id})</span>
                </div>

                <div style={{ opacity: 0.65 }}>Summary</div>
                <div style={{ opacity: 0.9 }}>{detail.summary ?? ""}</div>
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(0,0,0,0.10)",
                background: "white",
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>Detail (JSON)</div>
              <pre
                style={{
                  margin: 0,
                  padding: 12,
                  borderRadius: 12,
                  background: "rgba(0,0,0,0.04)",
                  overflow: "auto",
                  lineHeight: 1.35,
                }}
              >
                {JSON.stringify(detail.detail ?? null, null, 2)}
              </pre>

              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    if (detailId) router.push(`/superadmin/audit/${detailId}`);
                  }}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Åpne egen side
                </button>

                <button
                  onClick={closeDetail}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid rgba(0,0,0,0.15)",
                    background: "white",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Lukk
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
