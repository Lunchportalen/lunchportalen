// app/superadmin/enterprise/EnterpriseClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";

type GroupRow = {
  id: string;
  name: string;
  orgnr: string | null;
  created_at: string | null;
};

type ApiOk = { ok: true; rid: string; data: { items: GroupRow[]; count: number } };
type ApiErr = { ok: false; rid?: string; error: string; message?: string; status?: number };

type ApiResp = ApiOk | ApiErr;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function formatISO(iso: string | null) {
  try {
    if (!iso) return "-";
    return formatDateTimeNO(iso);
  } catch {
    return iso || "-";
  }
}

export default function EnterpriseClient() {
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [rows, setRows] = useState<GroupRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [rid, setRid] = useState<string | null>(null);

  async function load(nextPage: number) {
    setLoading(true);
    setErr(null);
    setRid(null);

    try {
      const qs = new URLSearchParams({ page: String(nextPage), limit: String(limit) });
      const res = await fetch(`/api/superadmin/enterprise?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const e = json as ApiErr | null;
        if ((e?.status ?? res.status) >= 500) {
          setErr(e?.message || e?.error || `HTTP ${res.status}`);
          setRid(e?.rid ?? null);
        } else {
          setErr(null);
          setRid(e?.rid ?? null);
        }
        setRows([]);
        setTotal(0);
        return;
      }

      const ok = json as ApiOk;
      setRows(ok.data?.items ?? []);
      setTotal(Number(ok.data?.count ?? 0));
      setPage(nextPage);
      setRid(ok.rid ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente konsern.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(page).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold">Konsern</div>
        <div className="text-xs text-[rgb(var(--lp-muted))]">Totalt: {total}</div>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {err}
          {rid ? <div className="mt-1 text-xs font-mono">RID: {rid}</div> : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-[rgb(var(--lp-border))] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs font-semibold text-[rgb(var(--lp-muted))]">
            <tr className="border-b border-[rgb(var(--lp-border))]">
              <th className="px-4 py-3">NAVN</th>
              <th className="px-4 py-3">ORGNR</th>
              <th className="px-4 py-3">OPPRETTET</th>
              <th className="px-4 py-3 text-right">HANDLING</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-[rgb(var(--lp-muted))]">Laster...</td>
              </tr>
            ) : rows.length ? (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[rgb(var(--lp-border))]">
                  <td className="px-4 py-3">
                    <div className="font-semibold">{safeStr(r.name) || "Ukjent konsern"}</div>
                    <div className="text-xs text-[rgb(var(--lp-muted))]">{r.id}</div>
                  </td>
                  <td className="px-4 py-3 text-sm">{r.orgnr || "-"}</td>
                  <td className="px-4 py-3 text-sm">{formatISO(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                      href={`/superadmin/enterprise/${encodeURIComponent(r.id)}`}
                    >
                      Åpne
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-sm text-[rgb(var(--lp-muted))]">Ingen konsern funnet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-[rgb(var(--lp-muted))]">
        <div>
          Side {page} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full border px-3 py-1"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Forrige
          </button>
          <button
            className="rounded-full border px-3 py-1"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Neste
          </button>
        </div>
      </div>

      {rid ? <div className="text-xs font-mono text-[rgb(var(--lp-muted))]">RID: {rid}</div> : null}
    </div>
  );
}
