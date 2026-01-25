// app/admin/audit/AuditClient.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type Severity = "info" | "warning" | "critical";

type AuditItem = {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_role: string | null;
  action: string;
  severity: Severity;
  company_id: string | null;
  location_id: string | null;
  entity_type: string;
  entity_id: string;
  summary: string | null;
  detail: any | null;
};

type ApiOk = {
  ok: true;
  rid: string;
  meta: { limit: number; nextCursor: string | null; source: "audit_events"; filtered?: boolean };
  items: AuditItem[];
};

type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };
type ApiRes = ApiOk | ApiErr;

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}

function fmtTs(ts: string) {
  try {
    return new Date(ts).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function badgeForSeverity(s: Severity) {
  if (s === "critical") return "bg-red-100 text-red-800 ring-1 ring-red-200";
  if (s === "warning") return "bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200";
  return "bg-slate-100 text-slate-800 ring-1 ring-slate-200";
}

async function readJson(res: Response) {
  const txt = await res.text();
  if (!txt) throw new Error(`Tom respons (HTTP ${res.status})`);
  try {
    return JSON.parse(txt);
  } catch {
    throw new Error(`Ugyldig JSON (HTTP ${res.status}): ${txt.slice(0, 220)}`);
  }
}

function buildUrl(params: { limit: number; cursor: string | null; q: string; severity: "" | Severity }) {
  const u = new URL("/api/superadmin/audit", window.location.origin);
  u.searchParams.set("limit", String(params.limit));
  if (params.cursor) u.searchParams.set("cursor", params.cursor);
  if (params.q.trim()) u.searchParams.set("q", params.q.trim());
  if (params.severity) u.searchParams.set("severity", params.severity);
  return u.toString();
}

export function AuditClient() {
  const [q, setQ] = useState("");
  const [severity, setSeverity] = useState<"" | Severity>("");
  const [limit, setLimit] = useState(150);

  const [items, setItems] = useState<AuditItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingMore, startMore] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const canLoadMore = useMemo(() => Boolean(nextCursor), [nextCursor]);

  async function fetchFirst() {
    setLoading(true);
    setError(null);
    setOpenId(null);

    try {
      const url = buildUrl({ limit, cursor: null, q, severity });
      const res = await fetch(url, { method: "GET", cache: "no-store" });
      const data = (await readJson(res)) as ApiRes;

      if (!data || (data as any).ok !== true) {
        const err = data as ApiErr;
        throw new Error(err?.message || err?.error || `Ukjent feil (HTTP ${res.status})`);
      }

      const ok = data as ApiOk;
      setRid(ok.rid || null);
      setItems(ok.items ?? []);
      setNextCursor(ok.meta?.nextCursor ?? null);
    } catch (e: any) {
      setError(String(e?.message ?? e ?? "Ukjent feil"));
      setItems([]);
      setNextCursor(null);
    } finally {
      setLoading(false);
    }
  }

  async function fetchMore() {
    if (!nextCursor) return;

    startMore(async () => {
      try {
        setError(null);

        const url = buildUrl({ limit, cursor: nextCursor, q, severity });
        const res = await fetch(url, { method: "GET", cache: "no-store" });
        const data = (await readJson(res)) as ApiRes;

        if (!data || (data as any).ok !== true) {
          const err = data as ApiErr;
          throw new Error(err?.message || err?.error || `Ukjent feil (HTTP ${res.status})`);
        }

        const ok = data as ApiOk;
        setRid(ok.rid || null);

        const incoming = ok.items ?? [];
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          const add = incoming.filter((x) => !seen.has(x.id));
          return [...prev, ...add];
        });

        setNextCursor(ok.meta?.nextCursor ?? null);
      } catch (e: any) {
        setError(String(e?.message ?? e ?? "Ukjent feil"));
      }
    });
  }

  useEffect(() => {
    const t = setTimeout(() => fetchFirst(), 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, severity, limit]);

  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-end">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Søk</div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk i e-post, action, entity_type, summary eller UUID…"
              className="w-full md:w-[360px] rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Severity</div>
            <select
              value={severity}
              onChange={(e) => setSeverity((e.target.value as any) || "")}
              className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
            >
              <option value="">Alle</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-xs text-[rgb(var(--lp-muted))]">Limit</div>
            <select
              value={String(limit)}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] focus:outline-none"
            >
              <option value="50">50</option>
              <option value="150">150</option>
              <option value="300">300</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          {loading ? (
            <span className="text-xs text-[rgb(var(--lp-muted))]">Laster…</span>
          ) : rid ? (
            <span className="text-xs text-[rgb(var(--lp-muted))]">RID: {rid}</span>
          ) : null}

          <button
            onClick={() => fetchFirst()}
            className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
          >
            Oppdater
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-800 ring-1 ring-red-100">
          <div className="font-semibold">Feil</div>
          <div className="mt-1 whitespace-pre-wrap">{error}</div>
        </div>
      ) : null}

      <div className="mt-4 overflow-hidden rounded-2xl ring-1 ring-[rgb(var(--lp-border))]">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white">
              <tr className="text-xs text-[rgb(var(--lp-muted))]">
                <th className="px-4 py-3">Tid</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Summary</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>

            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-[rgb(var(--lp-muted))]" colSpan={7}>
                    Laster audit-hendelser…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-[rgb(var(--lp-muted))]" colSpan={7}>
                    Ingen hendelser funnet.
                  </td>
                </tr>
              ) : (
                items.map((x) => {
                  const isOpen = openId === x.id;
                  return (
                    <tr key={x.id} className="border-t border-[rgb(var(--lp-border))]">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtTs(x.created_at)}</td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{x.actor_email || "—"}</div>
                        <div className="text-xs text-[rgb(var(--lp-muted))]">{x.actor_role || "ukjent rolle"}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{x.action}</div>
                        <div className="text-xs text-[rgb(var(--lp-muted))]">
                          company: {x.company_id ? x.company_id.slice(0, 8) : "—"}
                          {x.location_id ? ` • loc: ${x.location_id.slice(0, 8)}` : ""}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className={cx("inline-flex items-center rounded-full px-2.5 py-1 text-xs", badgeForSeverity(x.severity))}>
                          {x.severity}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{x.entity_type}</div>
                        <div className="text-xs text-[rgb(var(--lp-muted))]">{x.entity_id}</div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-sm">{x.summary || "—"}</div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setOpenId(isOpen ? null : x.id)}
                          className="rounded-xl bg-white px-3 py-1.5 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
                        >
                          {isOpen ? "Skjul" : "Detaljer"}
                        </button>
                      </td>

                      {isOpen ? (
                        <td colSpan={7} className="px-4 pb-4">
                          <div className="mt-2 rounded-2xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
                            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-xs ring-1 ring-[rgb(var(--lp-border))]">
{JSON.stringify(x.detail, null, 2)}
                            </pre>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-[rgb(var(--lp-muted))]">Viser {items.length} hendelser</div>

        <button
          onClick={fetchMore}
          disabled={!canLoadMore || loadingMore || loading}
          className={cx(
            "rounded-2xl px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]",
            !canLoadMore || loadingMore || loading ? "bg-white/60 text-[rgb(var(--lp-muted))]" : "bg-white hover:bg-white/90"
          )}
        >
          {loadingMore ? "Laster…" : canLoadMore ? "Last mer" : "Ingen flere"}
        </button>
      </div>
    </div>
  );
}
