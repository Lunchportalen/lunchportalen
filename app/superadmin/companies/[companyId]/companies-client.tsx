// STATUS: KEEP

// app/superadmin/companies/[companyId]/companies-client.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { formatDateTimeNO } from "@/lib/date/format";

type CompanyStatus = "pending" | "active" | "paused" | "closed";

type LastEvent = {
  created_at: string;
  actor_email: string | null;
  actor_role: string | null;
  summary: string | null;
  detail: any | null;
} | null;

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus;
  created_at: string;
  updated_at: string;
  last_event?: LastEvent;
};

type Stats = {
  companiesTotal: number;
  companiesPending: number;
  companiesActive: number;
  companiesPaused: number;
  companiesClosed: number;
};

type ApiOk = {
  ok: true;
  rid?: string;
  page: number;
  limit: number;
  total: number;
  q: string | null;
  status: CompanyStatus | null;
  include_closed: boolean;
  sort: "updated_at" | "created_at" | "name";
  dir: "asc" | "desc";
  stats?: Stats;
  companies: Array<CompanyRow & { last_event?: LastEvent }>;
};

type ApiErr = {
  ok: false;
  rid?: string;
  error: string;
  message: string;
  detail?: any;
};

type ApiRes = ApiOk | ApiErr;

type Props = {
  // Valgfritt: kan fylles fra server-side page.tsx for å unngå “blank” først
  initial?: Partial<ApiOk>;
};

function isOk(x: ApiRes): x is ApiOk {
  return (x as any)?.ok === true;
}

function fmtTs(ts: string | null | undefined) {
  if (!ts) return "—";
  return formatDateTimeNO(ts);
}

function badgeClass(status: CompanyStatus) {
  // match enterprise-ish palette (no surprises)
  if (status === "active") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "paused") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (status === "closed") return "bg-rose-50 text-rose-800 ring-rose-200";
  return "bg-neutral-50 text-neutral-700 ring-neutral-200";
}

function statusLabel(status: CompanyStatus) {
  if (status === "active") return "ACTIVE";
  if (status === "paused") return "PAUSED";
  if (status === "closed") return "CLOSED";
  return "PENDING";
}

function statCardClass(active: boolean) {
  return [
    "lp-motion-card rounded-2xl border p-4 shadow-sm",
    active ? "border-neutral-900 bg-neutral-50" : "border-neutral-200 bg-white hover:bg-neutral-50",
  ].join(" ");
}

function btnClass(variant: "primary" | "ghost" | "danger" | "muted" = "ghost", disabled?: boolean) {
  const base =
    "lp-motion-btn inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm font-medium ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-offset-2";
  const v =
    variant === "primary"
      ? "bg-neutral-900 text-white ring-neutral-900 hover:bg-neutral-800 focus:ring-neutral-900"
      : variant === "danger"
      ? "bg-rose-600 text-white ring-rose-600 hover:bg-rose-500 focus:ring-rose-600"
      : variant === "muted"
      ? "bg-neutral-100 text-neutral-700 ring-neutral-200 hover:bg-neutral-200 focus:ring-neutral-400"
      : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50 focus:ring-neutral-400";
  const dis = disabled ? "opacity-50 pointer-events-none" : "";
  return `${base} ${v} ${dis}`;
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

function buildListUrl(opts: {
  q: string;
  status: CompanyStatus | "ALL";
  includeClosed: boolean;
  page: number;
  limit: number;
  sort: "updated_at" | "created_at" | "name";
  dir: "asc" | "desc";
}) {
  const p = new URLSearchParams();
  if (opts.q.trim()) p.set("q", opts.q.trim());
  if (opts.status !== "ALL") p.set("status", opts.status);
  if (opts.includeClosed) p.set("include_closed", "1");
  p.set("page", String(opts.page));
  p.set("limit", String(opts.limit));
  p.set("sort", opts.sort);
  p.set("dir", opts.dir);
  p.set("include_last", "1");
  p.set("include_stats", "1");
  return `/api/superadmin/companies?${p.toString()}`;
}

/**
 * STATUS API — canonical: POST /api/superadmin/companies/set-status { companyId, status }
 */
async function setStatusViaApi(companyId: string, status: CompanyStatus, reason?: string) {
  const res = await fetch(`/api/superadmin/companies/set-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    cache: "no-store",
    body: JSON.stringify({ companyId, status, reason: reason?.trim() || null }),
  });

  const json = await readJsonSafe(res);
  if (res.ok && json && json.ok === true) return { ok: true as const, json };

  return {
    ok: false as const,
    json,
    status: res.status,
    message: (json && (json.message || json.error)) || `HTTP ${res.status}`,
  };
}

export default function CompaniesClient({ initial }: Props) {
  // Query state
  const [q, setQ] = useState(initial?.q ?? "");
  const [status, setStatus] = useState<CompanyStatus | "ALL">((initial?.status as any) ?? "ALL");
  const [includeClosed, setIncludeClosed] = useState<boolean>(initial?.include_closed ?? false);

  const [sort, setSort] = useState<"updated_at" | "created_at" | "name">(initial?.sort ?? "updated_at");
  const [dir, setDir] = useState<"asc" | "desc">(initial?.dir ?? "desc");

  const [page, setPage] = useState<number>(initial?.page ?? 1);
  const [limit, setLimit] = useState<number>(initial?.limit ?? 50);

  // Data state
  const [rows, setRows] = useState<CompanyRow[]>(initial?.companies ?? []);
  const [stats, setStats] = useState<Stats | null>((initial?.stats as any) ?? null);
  const [total, setTotal] = useState<number>(initial?.total ?? 0);

  // UI state
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState<boolean>(!initial?.companies);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Debounce search + abort in-flight
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<any>(null);
  const seqRef = useRef(0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / (limit || 50))), [total, limit]);

  const activeFiltersLabel = useMemo(() => {
    const bits: string[] = [];
    if (q.trim()) bits.push(`Søk: “${q.trim()}”`);
    if (status !== "ALL") bits.push(`Status: ${statusLabel(status)}`);
    if (includeClosed) bits.push("Vis arkiverte");
    return bits.length ? bits.join(" · ") : "Ingen filtre";
  }, [q, status, includeClosed]);

  async function fetchList(next?: Partial<Parameters<typeof buildListUrl>[0]>) {
    const opts = {
      q,
      status,
      includeClosed,
      page,
      limit,
      sort,
      dir,
      ...next,
    } as any;

    const url = buildListUrl(opts);

    // cancel previous
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const mySeq = ++seqRef.current;

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(url, { cache: "no-store", signal: ac.signal, headers: { "Cache-Control": "no-store" } });
      const json = (await readJsonSafe(res)) as ApiRes | null;

      if (ac.signal.aborted) return;
      if (mySeq !== seqRef.current) return;

      if (!json) {
        setRows([]);
        setStats(null);
        setTotal(0);
        setErr(`Tom/ugyldig respons (HTTP ${res.status})`);
        setLoading(false);
        return;
      }

      if (!isOk(json)) {
        setRows([]);
        setStats(null);
        setTotal(0);
        setErr(json?.message ?? "Ukjent feil");
        setLoading(false);
        return;
      }

      setRows(json.companies ?? []);
      setStats(json.stats ?? null);
      setTotal(json.total ?? 0);
      setLoading(false);
    } catch (e: any) {
      if (ac.signal.aborted) return;
      setRows([]);
      setStats(null);
      setTotal(0);
      setErr(String(e?.message ?? e));
      setLoading(false);
    }
  }

  // First load (if no initial)
  useEffect(() => {
    if (initial?.companies) return;
    fetchList().catch((e) => setErr(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch on filters (debounced for q)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Reset til side 1 ved filter-endring
      startTransition(() => setPage(1));
      fetchList({ page: 1 }).catch((e) => setErr(String(e?.message ?? e)));
    }, 350);

    return () => debounceRef.current && clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, includeClosed, sort, dir, limit]);

  // Re-fetch on page change (no debounce)
  useEffect(() => {
    fetchList().catch((e) => setErr(String(e?.message ?? e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function setCompanyStatus(companyId: string, nextStatus: CompanyStatus, reason?: string) {
    setErr(null);
    setNotice(null);

    // Optimistic UI (local)
    const prev = rows;
    setRows((r) => r.map((x) => (x.id === companyId ? { ...x, status: nextStatus } : x)));

    try {
      const r = await setStatusViaApi(companyId, nextStatus, reason);

      if (!r.ok) {
        setRows(prev);
        setErr(r.message || "Kunne ikke endre status.");
        return;
      }

      setNotice(`Status oppdatert → ${statusLabel(nextStatus)}`);
      fetchList().catch(() => {});
    } catch (e: any) {
      setRows(prev);
      setErr(String(e?.message ?? e));
    }
  }

  function quickFilter(next: CompanyStatus | "ALL") {
    startTransition(() => setStatus(next));
  }

  function toggleArchived() {
    startTransition(() => setIncludeClosed((v) => !v));
  }

  const chips = [
    { key: "ALL", label: "Alle", value: "ALL" as const },
    { key: "active", label: "Active", value: "active" as const },
    { key: "paused", label: "Paused", value: "paused" as const },
    { key: "pending", label: "Pending", value: "pending" as const },
    { key: "closed", label: "Closed", value: "closed" as const },
  ];

  function chipClass(active: boolean) {
    return [
      "lp-motion-btn inline-flex items-center rounded-full px-3 py-1 text-sm ring-1 ring-inset",
      active ? "bg-neutral-900 text-white ring-neutral-900" : "bg-white text-neutral-800 ring-neutral-200 hover:bg-neutral-50",
    ].join(" ");
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lp-select-text">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Firma</h1>
          <p className="text-sm text-neutral-600">{activeFiltersLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className={btnClass("muted", isPending || loading)}
            onClick={() => fetchList().catch(() => {})}
            title="Oppdater"
          >
            Oppdater
          </button>

          <button
            className={btnClass(includeClosed ? "primary" : "ghost", isPending || loading)}
            onClick={toggleArchived}
            title="Vis/skjul arkiverte"
          >
            {includeClosed ? "Viser arkiverte" : "Skjul arkiverte"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <button className={statCardClass(status === "ALL")} onClick={() => quickFilter("ALL")} disabled={loading}>
          <div className="text-xs text-neutral-500">Total</div>
          <div className="mt-1 text-xl font-semibold">{stats?.companiesTotal ?? "—"}</div>
        </button>

        <button className={statCardClass(status === "active")} onClick={() => quickFilter("active")} disabled={loading}>
          <div className="text-xs text-neutral-500">Active</div>
          <div className="mt-1 text-xl font-semibold">{stats?.companiesActive ?? "—"}</div>
        </button>

        <button className={statCardClass(status === "paused")} onClick={() => quickFilter("paused")} disabled={loading}>
          <div className="text-xs text-neutral-500">Paused</div>
          <div className="mt-1 text-xl font-semibold">{stats?.companiesPaused ?? "—"}</div>
        </button>

        <button className={statCardClass(status === "pending")} onClick={() => quickFilter("pending")} disabled={loading}>
          <div className="text-xs text-neutral-500">Pending</div>
          <div className="mt-1 text-xl font-semibold">{stats?.companiesPending ?? "—"}</div>
        </button>

        <button className={statCardClass(status === "closed")} onClick={() => quickFilter("closed")} disabled={loading}>
          <div className="text-xs text-neutral-500">Closed</div>
          <div className="mt-1 text-xl font-semibold">{stats?.companiesClosed ?? "—"}</div>
        </button>
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <div className="w-full md:max-w-sm">
            <label className="sr-only">Søk</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Søk på firmanavn eller orgnr…"
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none ring-offset-2 focus:ring-2 focus:ring-neutral-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <button
                key={c.key}
                className={chipClass(status === c.value)}
                onClick={() => quickFilter(c.value)}
                disabled={isPending || loading}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            value={`${sort}:${dir}`}
            onChange={(e) => {
              const [s, d] = e.target.value.split(":");
              setSort((s as any) || "updated_at");
              setDir((d as any) || "desc");
            }}
          >
            <option value="updated_at:desc">Sist oppdatert (nyest)</option>
            <option value="updated_at:asc">Sist oppdatert (eldst)</option>
            <option value="created_at:desc">Opprettet (nyest)</option>
            <option value="created_at:asc">Opprettet (eldst)</option>
            <option value="name:asc">Navn (A–Å)</option>
            <option value="name:desc">Navn (ŖA)</option>
          </select>

          <select
            className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm"
            value={String(limit)}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value="20">20 / side</option>
            <option value="50">50 / side</option>
            <option value="100">100 / side</option>
            <option value="200">200 / side</option>
          </select>
        </div>
      </div>

      {/* Messages */}
      {err ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="font-medium">Feil</div>
          <div className="mt-1 opacity-90">{err}</div>
        </div>
      ) : null}

      {notice ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <div className="font-medium">OK</div>
          <div className="mt-1 opacity-90">{notice}</div>
        </div>
      ) : null}

      {/* Table */}
      <div className="mt-5 rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
          <div className="text-sm text-neutral-600">{loading ? "Laster…" : `Viser ${rows.length} av ${total}`}</div>

          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>
              Side <span className="font-medium text-neutral-900">{page}</span> / {totalPages}
            </span>
            <button className={btnClass("ghost", !canPrev || loading)} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Forrige
            </button>
            <button className={btnClass("ghost", !canNext || loading)} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Neste
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Firma</th>
                <th className="px-4 py-3">Org.nr</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Sist endret</th>
                <th className="px-4 py-3">Oppdatert</th>
                <th className="px-4 py-3 text-right">Handling</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200">
              {rows.map((c) => {
                const last = c.last_event ?? null;
                const lastWho = last?.actor_email ?? last?.actor_role ?? "—";

                return (
                  <tr key={c.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <Link href={`/superadmin/companies/${c.id}`} className="font-medium text-neutral-900 hover:underline">
                          {c.name}
                        </Link>
                        <div className="mt-0.5 text-xs text-neutral-500">{c.id}</div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-neutral-700">{c.orgnr ?? "—"}</td>

                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${badgeClass(c.status)}`}>
                        {statusLabel(c.status)}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <div className="text-neutral-900">{fmtTs(last?.created_at ?? null)}</div>
                        <div className="text-xs text-neutral-500">{last ? lastWho : "—"}</div>
                      </div>
                    </td>

                    <td className="px-4 py-3 text-neutral-700">{fmtTs(c.updated_at)}</td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        {c.status === "pending" ? (
                          <>
                            <button className={btnClass("primary", isPending || loading)} onClick={() => setCompanyStatus(c.id, "active")}>
                              Aktiver
                            </button>
                            <button className={btnClass("danger", isPending || loading)} onClick={() => setCompanyStatus(c.id, "closed", "Arkivert fra Pending")}>
                              Arkiver
                            </button>
                          </>
                        ) : c.status === "active" ? (
                          <>
                            <button className={btnClass("muted", isPending || loading)} onClick={() => setCompanyStatus(c.id, "paused")}>
                              Pause
                            </button>
                            <button className={btnClass("danger", isPending || loading)} onClick={() => setCompanyStatus(c.id, "closed", "Arkivert")}>
                              Arkiver
                            </button>
                          </>
                        ) : c.status === "paused" ? (
                          <>
                            <button className={btnClass("primary", isPending || loading)} onClick={() => setCompanyStatus(c.id, "active")}>
                              Gjenoppta
                            </button>
                            <button className={btnClass("danger", isPending || loading)} onClick={() => setCompanyStatus(c.id, "closed", "Arkivert fra Paused")}>
                              Arkiver
                            </button>
                          </>
                        ) : (
                          <>
                            <button className={btnClass("primary", isPending || loading)} onClick={() => setCompanyStatus(c.id, "active", "Gjenåpnet")}>
                              Gjenåpne
                            </button>
                            <button className={btnClass("ghost", isPending || loading)} onClick={() => setIncludeClosed(true)}>
                              Vis i liste
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-600">
                    Ingen treff.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* Footer pagination */}
        <div className="flex flex-col gap-2 border-t border-neutral-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-neutral-600">
            {total ? (
              <>
                Side <span className="font-medium text-neutral-900">{page}</span> av{" "}
                <span className="font-medium text-neutral-900">{totalPages}</span>
              </>
            ) : (
              "—"
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button className={btnClass("ghost", !canPrev || loading)} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Forrige
            </button>
            <button className={btnClass("ghost", !canNext || loading)} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              Neste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
