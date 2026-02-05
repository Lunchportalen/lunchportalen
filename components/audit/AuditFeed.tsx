// components/audit/AuditFeed.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { formatDateTimeNO } from "@/lib/date/format";
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
  return formatDateTimeNO(ts);
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
      className="fixed inset-0 z-[9999] grid place-items-center bg-black/40 p-4"
    >
      <div className="max-h-[90vh] w-[min(1000px,96vw)] overflow-auto rounded-2xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] shadow-[0_20px_70px_rgba(0,0,0,0.25)]">
        <div className="sticky top-0 flex items-center justify-between gap-3 rounded-t-2xl border-b border-[rgba(var(--lp-border),0.8)] bg-[rgb(var(--lp-surface))] px-4 py-3">
          <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">{title}</div>
          <button
            ref={closeBtnRef}
            onClick={onClose}
            className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
          >
            Lukk
          </button>
        </div>

        <div className="p-4">{children}</div>
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
    <div className="grid gap-3">
      {title ? (
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-lg font-semibold">{title}</div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Søk (actor, action, entity_type, summary)"
          className="min-w-[320px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
        />

        <input
          value={action}
          onChange={(e) => setAction(e.target.value)}
          placeholder="Filtrer på action (f.eks. COMPANY_ACTIVATED)"
          className="min-w-[320px] rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm"
        />

        <button
          onClick={() => startTransition(() => load(true))}
          disabled={pending || inFlightRef.current}
          className={[
            "rounded-lg border px-3 py-2 text-xs font-semibold",
            pending || inFlightRef.current
              ? "border-[rgba(var(--lp-border),0.6)] bg-[rgb(var(--lp-surface-2))] text-[rgb(var(--lp-muted))] opacity-70"
              : "border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]",
          ].join(" ")}
        >
          {pending || inFlightRef.current ? "Laster…" : "Oppdater"}
        </button>

        {err ? <div className="text-sm font-semibold text-[rgb(var(--lp-crit-tx))]">{err}</div> : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))]">
        <div className="grid grid-cols-[170px_220px_1fr_260px] gap-0 border-b border-[rgba(var(--lp-border),0.7)] bg-[rgb(var(--lp-surface-2))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-muted))]">
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
            className="grid w-full grid-cols-[170px_220px_1fr_260px] gap-0 border-t border-[rgba(var(--lp-border),0.7)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-left text-xs hover:bg-[rgb(var(--lp-surface-2))]"
          >
            <div className="lp-mono text-xs">{fmtTs(x.created_at)}</div>
            <div>
              <div className="font-semibold text-[rgb(var(--lp-text))]">{x.actor_email ?? "—"}</div>
              <div className="text-[rgb(var(--lp-muted))]">{x.actor_role ?? "—"}</div>
            </div>
            <div>
              <div className="font-semibold text-[rgb(var(--lp-text))]">{x.action}</div>
              <div className="text-[rgb(var(--lp-muted))]">{x.summary ?? ""}</div>
            </div>
            <div className="text-[rgb(var(--lp-muted))]">
              {x.entity_type} <span className="opacity-60">({x.entity_id})</span>
            </div>
          </button>
        ))}

        {!items.length && !pending && !inFlightRef.current ? (
          <div className="border-t border-[rgba(var(--lp-border),0.7)] px-3 py-2 text-sm text-[rgb(var(--lp-muted))]">
            Ingen audit-hendelser.
          </div>
        ) : null}
      </div>

      {hasMore ? (
        <button
          onClick={() => startTransition(() => load(false))}
          disabled={pending || inFlightRef.current}
          className={[
            "w-[180px] rounded-lg border px-3 py-2 text-xs font-semibold",
            pending || inFlightRef.current
              ? "border-[rgba(var(--lp-border),0.6)] bg-[rgb(var(--lp-surface-2))] text-[rgb(var(--lp-muted))] opacity-70"
              : "border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]",
          ].join(" ")}
        >
          {pending || inFlightRef.current ? "Laster…" : "Last eldre"}
        </button>
      ) : null}

      <Modal open={open} title="Audit detail" onClose={closeDetail}>
        {detailLoading ? (
          <div className="rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-sm">
            Laster…
          </div>
        ) : null}

        {detailErr ? (
          <div className="rounded-xl border border-[rgba(var(--lp-crit-bd),0.9)] bg-[rgba(var(--lp-crit-bg),0.9)] px-3 py-2 text-sm font-semibold text-[rgb(var(--lp-crit-tx))]">
            {detailErr}
          </div>
        ) : null}

        {!detailLoading && !detailErr && detail ? (
          <div className="grid gap-3">
            <div className="rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] p-3">
              <div className="grid grid-cols-[160px_1fr] gap-2 text-sm">
                <div className="text-[rgb(var(--lp-muted))]">Tid</div>
                <div className="font-semibold text-[rgb(var(--lp-text))]">{fmtTs(detail.created_at)}</div>

                <div className="text-[rgb(var(--lp-muted))]">Actor</div>
                <div>
                  <div className="font-semibold text-[rgb(var(--lp-text))]">{detail.actor_email ?? "—"}</div>
                  <div className="text-xs text-[rgb(var(--lp-muted))]">{detail.actor_role ?? "—"}</div>
                </div>

                <div className="text-[rgb(var(--lp-muted))]">Action</div>
                <div className="font-semibold text-[rgb(var(--lp-text))]">{detail.action}</div>

                <div className="text-[rgb(var(--lp-muted))]">Entity</div>
                <div className="font-semibold text-[rgb(var(--lp-text))]">
                  {detail.entity_type} <span className="opacity-60">({detail.entity_id})</span>
                </div>

                <div className="text-[rgb(var(--lp-muted))]">Summary</div>
                <div className="text-[rgb(var(--lp-text))]">{detail.summary ?? ""}</div>
              </div>
            </div>

            <div className="rounded-xl border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] p-3">
              <div className="text-sm font-semibold text-[rgb(var(--lp-text))]">Detail (JSON)</div>
              <pre className="lp-mono mt-2 max-h-[420px] overflow-auto rounded-xl bg-[rgba(var(--lp-text),0.04)] p-3 text-xs leading-snug">
                {JSON.stringify(detail.detail ?? null, null, 2)}
              </pre>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    if (detailId) router.push(`/superadmin/audit/${detailId}`);
                  }}
                  className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
                >
                  Åpne egen side
                </button>

                <button
                  onClick={closeDetail}
                  className="rounded-lg border border-[rgba(var(--lp-border),0.9)] bg-[rgb(var(--lp-surface))] px-3 py-2 text-xs font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-surface-2))]"
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
