// app/superadmin/enterprise/[groupId]/EnterpriseGroupClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatDateTimeNO } from "@/lib/date/format";

type Company = {
  id: string;
  name: string;
  orgnr: string | null;
  status: string | null;
  created_at: string | null;
  location_count: number;
  locations: Array<{ id: string; name: string | null; status: string | null; address: string | null }>;
};

type ApiOk = {
  ok: true;
  rid: string;
  data: {
    group: { id: string; name: string; orgnr: string | null; created_at: string | null };
    page: number;
    limit: number;
    total: number;
    companies: Company[];
  };
};

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

export default function EnterpriseGroupClient({ groupId }: { groupId: string }) {
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [group, setGroup] = useState<{ id: string; name: string; orgnr: string | null; created_at: string | null } | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
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
      const res = await fetch(`/api/superadmin/enterprise/${encodeURIComponent(groupId)}?${qs.toString()}`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResp | null;

      if (!res.ok || !json || (json as any).ok !== true) {
        const e = json as ApiErr | null;
        setErr(e?.message || e?.error || `HTTP ${res.status}`);
        setRid(e?.rid ?? null);
        setGroup(null);
        setCompanies([]);
        setTotal(0);
        return;
      }

      const ok = json as ApiOk;
      setGroup(ok.data.group ?? null);
      setCompanies(ok.data.companies ?? []);
      setTotal(Number(ok.data.total ?? 0));
      setPage(Number(ok.data.page ?? nextPage));
      setRid(ok.rid ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "Kunne ikke hente konsern.");
      setGroup(null);
      setCompanies([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!groupId) return;
    load(page).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{group?.name || "Konsern"}</div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            Orgnr: {group?.orgnr || "-"} | Opprettet: {formatISO(group?.created_at ?? null)}
          </div>
        </div>
        <Link href="/superadmin/enterprise" className="rounded-full border px-3 py-1 text-xs font-semibold">
          Tilbake
        </Link>
      </div>

      {err ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          {err}
          {rid ? <div className="mt-1 text-xs font-mono">RID: {rid}</div> : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4">
        <div className="text-sm font-semibold">Selskaper</div>
        <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Totalt: {total}</div>

        <div className="mt-3 space-y-3">
          {loading ? (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Laster...</div>
          ) : companies.length ? (
            companies.map((c) => (
              <div key={c.id} className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-[rgb(var(--lp-muted))]">{c.id}</div>
                  </div>
                  <div className="text-xs text-[rgb(var(--lp-muted))]">
                    Status: {c.status || "-"} | Lokasjoner: {c.location_count}
                  </div>
                </div>
                <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Orgnr: {c.orgnr || "-"} | Opprettet: {formatISO(c.created_at)}</div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {c.locations.length ? (
                    c.locations.map((l) => (
                      <div key={l.id} className="rounded-xl bg-white p-3 ring-1 ring-[rgb(var(--lp-border))]">
                        <div className="text-sm font-semibold">{l.name || "Lokasjon"}</div>
                        <div className="text-xs text-[rgb(var(--lp-muted))]">{l.address || "-"}</div>
                        <div className="text-xs text-[rgb(var(--lp-muted))]">Status: {l.status || "-"}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-[rgb(var(--lp-muted))]">Ingen lokasjoner registrert.</div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen selskaper funnet.</div>
          )}
        </div>
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
