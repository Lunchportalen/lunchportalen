// app/superadmin/companies/companies-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDateTimeNO } from "@/lib/date/format";

type CompanyStatus = "pending" | "active" | "paused" | "closed";
type SortKey = "updated_at" | "created_at" | "name";
type SortDir = "asc" | "desc";
type CompanyView = "active" | "archived";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus | null;
  planLabel?: string | null;
  employeesCount?: number | null;
  adminsCount?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  archivedAt?: string | null;
};

type AgreementSnapshot = {
  agreementId: string | null;
  status: string | null;
  planTier: string | null;
  planLabel: string | null;
  pricePerCuvertNok: number | null;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string | null;
};

type CompanyDetail = {
  company: {
    id: string;
    name: string;
    orgnr: string | null;
    status: CompanyStatus | string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  counts: {
    employeesCount: number;
    adminsCount: number;
  };
  agreement: AgreementSnapshot | null;
  source?: {
    companies?: string;
    profiles?: string;
    agreement?: string;
  };
};

type ApiOk = {
  ok: true;
  rid: string;
  data: {
    items: CompanyRow[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    source?: {
      companies?: string;
      profiles?: string;
      agreement?: string;
    };
    filters?: {
      q?: string | null;
      status?: string | null;
      includeClosed?: boolean;
      sort?: SortKey | string | null;
      dir?: SortDir | string | null;
    };
  };
};

type ApiErr = { ok: false; rid?: string; error: string; message?: string; status?: number; detail?: any };
type ApiRes = ApiOk | ApiErr;

function safeStr(v: any) {
  return String(v ?? "").trim();
}

const ALLOWED_LIMITS = [10, 25, 50, 100] as const;
type AllowedLimit = (typeof ALLOWED_LIMITS)[number];
function normalizeLimit(v: any) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 25;
  const i = Math.floor(n);
  return ALLOWED_LIMITS.includes(i as AllowedLimit) ? i : 25;
}

function normStatus(v: any): CompanyStatus {
  const s = String(v ?? "pending").toLowerCase().trim();
  if (s === "active") return "active";
  if (s === "paused") return "paused";
  if (s === "closed") return "closed";
  return "pending";
}

function clampInt(v: any, fallback: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function fmtTs(ts?: string | null) {
  if (!ts) return "—";
  return formatDateTimeNO(ts);
}

function badgeClass(status: CompanyStatus) {
  if (status === "active") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  if (status === "paused") return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
  if (status === "closed") return "bg-red-50 text-red-800 ring-1 ring-red-200";
  return "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";
}

function statusLabel(status: CompanyStatus) {
  if (status === "active") return "Aktiv";
  if (status === "paused") return "Pauset";
  if (status === "closed") return "Stengt";
  return "Venter";
}

function isSortKey(v: any): v is SortKey {
  return v === "updated_at" || v === "created_at" || v === "name";
}
function isSortDir(v: any): v is SortDir {
  return v === "asc" || v === "desc";
}

function buildQueryString(q: {
  q: string;
  status: "" | CompanyStatus;
  include_closed: boolean;
  page: number;
  limit: number;
  sort: SortKey;
  dir: SortDir;
  view: CompanyView;
}) {
  const sp = new URLSearchParams();
  if (q.view === "archived") sp.set("view", "archived");
  if (q.q) sp.set("q", q.q);
  if (q.status) sp.set("status", q.status);
  if (q.include_closed) sp.set("include_closed", "1");
  sp.set("page", String(q.page));
  sp.set("limit", String(q.limit));
  sp.set("sort", q.sort);
  sp.set("dir", q.dir);
  return sp.toString();
}

async function readJsonSafe(res: Response): Promise<any | null> {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/**
 * API-endepunkt
 * - /api/superadmin/companies
 */
async function fetchCompanies(qs: string, signal?: AbortSignal): Promise<ApiRes> {
  const r = await fetch(`/api/superadmin/companies?${qs}`, {
    cache: "no-store",
    signal,
    headers: { "Cache-Control": "no-store" },
  });
  const body = await readJsonSafe(r);

  if (r.ok && body) return body as ApiRes;

  return {
    ok: false,
    rid: body?.rid,
    error: body?.error || "HTTP_ERROR",
    message: body?.message || `HTTP ${r.status}`,
    status: r.status,
    detail: body?.detail ?? body,
  } as ApiErr;
}

async function fetchArchivedCompanies(qs: string, signal?: AbortSignal): Promise<ApiRes> {
  const r = await fetch(`/api/superadmin/companies?${qs}`, {
    cache: "no-store",
    signal,
    headers: { "Cache-Control": "no-store" },
  });
  const body = await readJsonSafe(r);

  if (r.ok && body) return body as ApiRes;

  return {
    ok: false,
    rid: body?.rid,
    error: body?.error || "HTTP_ERROR",
    message: body?.message || `HTTP ${r.status}`,
    status: r.status,
    detail: body?.detail ?? body,
  } as ApiErr;
}
async function fetchCompanyDetail(companyId: string, signal?: AbortSignal): Promise<{ ok: true; rid: string; data: CompanyDetail } | ApiErr> {
  const r = await fetch(`/api/superadmin/companies/${encodeURIComponent(companyId)}`, {
    cache: "no-store",
    signal,
    headers: { "Cache-Control": "no-store" },
  });
  const body = await readJsonSafe(r);

  if (r.ok && body?.ok === true) return body as { ok: true; rid: string; data: CompanyDetail };

  return {
    ok: false,
    rid: body?.rid,
    error: body?.error || "HTTP_ERROR",
    message: body?.message || `HTTP ${r.status}`,
    status: r.status,
    detail: body?.detail ?? body,
  } as ApiErr;
}

/**
 * Status-endepunkt
 * - primær: POST /api/superadmin/companies/status
 * - fallback: POST /api/superadmin/firms/status
 */
async function postCompanyStatus(companyId: string, status: CompanyStatus): Promise<{ ok: true } | ApiErr> {
  const tryPost = async (url: string) => {
    const r = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ companyId, status }),
    });
    const body = await readJsonSafe(r);

    if (r.ok && body && body.ok === true) return { ok: true as const };

    if (r.status === 404) return { ok: false, error: "NOT_FOUND", message: "404", detail: { url } } as ApiErr;

    return {
      ok: false,
      rid: body?.rid,
      error: body?.error || "HTTP_ERROR",
      message: body?.message || `HTTP ${r.status}`,
      detail: body?.detail ?? body,
    } as ApiErr;
  };

  const primary = await tryPost("/api/superadmin/companies/status");
  if ((primary as any).ok === true) return { ok: true };

  const e1 = primary as ApiErr;
  if (e1?.error === "NOT_FOUND") {
    const fallback = await tryPost("/api/superadmin/firms/status");
    if ((fallback as any).ok === true) return { ok: true };

    const e2 = fallback as ApiErr;
    return {
      ok: false,
      error: "API_MISSING",
      message: "Fant ikke API-endepunkt for statusendring.",
      detail: { primary: e1?.detail, fallback: e2?.detail },
    };
  }

  return e1;
}

export default function CompaniesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // ---- Read initial state from URL
  const initial = useMemo(() => {
    const q = safeStr(searchParams.get("q"));
    const statusRaw = safeStr(searchParams.get("status")).toLowerCase();
    const viewRaw = safeStr(searchParams.get("view")).toLowerCase();
    const archivedRaw = safeStr(searchParams.get("archived"));
    const tabRaw = safeStr(searchParams.get("tab")).toLowerCase();
    const status: "" | CompanyStatus =
      statusRaw === "pending" || statusRaw === "active" || statusRaw === "paused" || statusRaw === "closed"
        ? (statusRaw as CompanyStatus)
        : "";
    const view: CompanyView =
      archivedRaw === "1" || archivedRaw === "true" || tabRaw === "archived" || viewRaw === "archived"
        ? "archived"
        : "active";

    const include_closed = safeStr(searchParams.get("include_closed")) === "1";

    const page = clampInt(searchParams.get("page"), 1, 1, 9999);
    const limit = normalizeLimit(searchParams.get("limit"));

    const sortRaw = safeStr(searchParams.get("sort"));
    const dirRaw = safeStr(searchParams.get("dir"));
    const sort: SortKey = isSortKey(sortRaw) ? sortRaw : "updated_at";
    const dir: SortDir = isSortDir(dirRaw) ? dirRaw : "desc";

    return { q, status, include_closed, page, limit, sort, dir, view };
  }, [searchParams]);

  const [qText, setQText] = useState(initial.q);
  const [view, setView] = useState<CompanyView>(initial.view);
  const [status, setStatus] = useState<"" | CompanyStatus>(initial.status);
  const [includeClosed, setIncludeClosed] = useState(initial.include_closed);
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(initial.limit);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [dir, setDir] = useState<SortDir>(initial.dir);

  // Data state
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [systemTruth, setSystemTruth] = useState<{
    rid?: string;
    source?: { companies?: string; profiles?: string; agreement?: string };
    filters?: { q?: string | null; status?: string | null; includeClosed?: boolean; sort?: string | null; dir?: string | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);

  // Status change UI
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmPayload = useRef<{ id: string; name: string; next: CompanyStatus } | null>(null);

  // Detail panel
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailErr, setDetailErr] = useState<ApiErr | null>(null);
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [detailRid, setDetailRid] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const reqSeq = useRef(0);
  const detailAbortRef = useRef<AbortController | null>(null);

  // Debounce søk
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qText]);

  // URL sync (uten å spamme historikk)
  const qs = useMemo(() => {
    return buildQueryString({
      q: safeStr(qText),
      status,
      include_closed: includeClosed,
      page,
      limit,
      sort,
      dir,
      view,
    });
  }, [qText, status, includeClosed, page, limit, sort, dir, view]);

  useEffect(() => {
    const current = searchParams.toString();
    if (current === qs) return;
    startTransition(() => {
      router.replace(`/superadmin/companies?${qs}`);
    });
  }, [qs, router, startTransition, searchParams]);

  // Data fetch
  useEffect(() => {
    const seq = ++reqSeq.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr(null);
    setStatusErr(null);

    const fetcher = view === "archived" ? fetchArchivedCompanies : fetchCompanies;

    fetcher(qs, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        if (seq !== reqSeq.current) return;

        if (!res || (res as any).ok !== true) {
          setRows([]);
          setTotal(null);
          setPages(null);
          setSystemTruth(null);
          setErr((res as ApiErr) ?? { ok: false, error: "UNKNOWN", message: "Ukjent feil" });
          return;
        }

        const ok = res as ApiOk;
        const list = Array.isArray(ok.data?.items) ? ok.data.items : [];
        const normalized: CompanyRow[] = list
          .map((x: any) => ({
            id: safeStr(x?.id),
            name: safeStr(x?.name) || "Ukjent firma",
            orgnr: x?.orgnr ?? null,
            status: normStatus(x?.status),
            planLabel: x?.planLabel ?? x?.plan ?? null,
            employeesCount: Number.isFinite(Number(x?.employeesCount))
              ? Number(x?.employeesCount)
              : Number.isFinite(Number(x?.employees_count))
              ? Number(x?.employees_count)
              : null,
            adminsCount: Number.isFinite(Number(x?.adminsCount)) ? Number(x?.adminsCount) : null,
            createdAt: x?.createdAt ?? x?.created_at ?? null,
            updatedAt: x?.updatedAt ?? x?.updated_at ?? null,
            archivedAt: x?.archivedAt ?? x?.archived_at ?? x?.deleted_at ?? null,
          }))
          .filter((x: CompanyRow) => !!x.id);

        setRows(normalized);
        setTotal(Number.isFinite(Number(ok.data?.total)) ? Number(ok.data.total) : null);
        setPages(Number.isFinite(Number(ok.data?.totalPages)) ? Number(ok.data.totalPages) : null);
        setSystemTruth({
          rid: ok.rid,
          source: ok.data?.source,
          filters: ok.data?.filters,
        });
        setErr(null);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setRows([]);
        setTotal(null);
        setPages(null);
        setSystemTruth(null);
        setErr({ ok: false, error: "FETCH_FAILED", message: e?.message || "Fetch feilet", detail: e });
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setLoading(false);
      });

    return () => ac.abort();
  }, [qs, view]);

  useEffect(() => {
    if (!detailId) return;
    detailAbortRef.current?.abort();
    const ac = new AbortController();
    detailAbortRef.current = ac;

    setDetailLoading(true);
    setDetailErr(null);

    fetchCompanyDetail(detailId, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        if (!res || (res as any).ok !== true) {
          setDetail(null);
          setDetailRid((res as any)?.rid ?? null);
          setDetailErr((res as ApiErr) ?? { ok: false, error: "UNKNOWN", message: "Ukjent feil" });
          return;
        }
        const ok = res as { ok: true; rid: string; data: CompanyDetail };
        setDetail(ok.data);
        setDetailRid(ok.rid ?? null);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setDetail(null);
        setDetailRid(null);
        setDetailErr({ ok: false, error: "FETCH_FAILED", message: e?.message || "Kunne ikke hente detaljer", detail: e });
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setDetailLoading(false);
      });

    return () => ac.abort();
  }, [detailId]);

  const canPrev = page > 1;
  const canNext = pages ? page < pages : rows.length === limit;

  function openConfirm(row: CompanyRow, next: CompanyStatus) {
    confirmPayload.current = { id: row.id, name: row.name, next };
    setConfirmOpen(true);
    setStatusErr(null);
  }

  function closeConfirm() {
    setConfirmOpen(false);
    confirmPayload.current = null;
  }

  function openDetail(row: CompanyRow) {
    setDetailId(row.id);
  }

  function closeDetail() {
    setDetailId(null);
    setDetail(null);
    setDetailErr(null);
    setDetailRid(null);
  }

  function applyLocalStatus(id: string, next: CompanyStatus) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, status: next } : r)));
  }

  function doChangeStatus() {
    const p = confirmPayload.current;
    if (!p) return;

    setStatusBusyId(p.id);
    setStatusErr(null);

    startTransition(async () => {
      const res = await postCompanyStatus(p.id, p.next);
      if ((res as any).ok !== true) {
        const e = res as ApiErr;
        setStatusErr(e.message || "Kunne ikke oppdatere status.");
        setStatusBusyId(null);
        return;
      }

      applyLocalStatus(p.id, p.next);
      setStatusBusyId(null);
      closeConfirm();
    });
  }

  return (
    <div className="mt-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight md:text-2xl">Firmaoversikt</h2>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Søk, filtrer og åpne firma for avtale, status, ansatte og audit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/superadmin"
            className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50"
          >
            Dashboard
          </Link>
          <Link
            href="/superadmin/system"
            className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50"
          >
            System
          </Link>

          <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
            {loading ? "Laster…" : `Viser ${rows.length}${typeof total === "number" ? ` av ${total}` : ""}`}
          </span>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
            Side {page}
            {pages ? ` / ${pages}` : ""}
          </span>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setView("active");
            setPage(1);
          }}
          className={[
            "rounded-full border px-3 py-1 text-xs",
            view === "active" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50",
          ].join(" ")}
        >
          Aktive
        </button>
        <button
          type="button"
          onClick={() => {
            setView("archived");
            setStatus("");
            setIncludeClosed(false);
            setPage(1);
          }}
          className={[
            "rounded-full border px-3 py-1 text-xs",
            view === "archived" ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-50",
          ].join(" ")}
        >
          Slettet (Arkiv)
        </button>
      </div>

      {/* Controls */}
      <section className="mt-6 rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <label className="block text-xs text-[rgb(var(--lp-muted))]">Søk</label>
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Navn, org.nr …"
              className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

          {view === "active" ? (
            <div className="md:col-span-3">
              <label className="block text-xs text-[rgb(var(--lp-muted))]">Status</label>
              <select
                value={status}
                onChange={(e) => {
                  setPage(1);
                  setStatus((e.target.value as any) || "");
                }}
                className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm"
              >
                <option value="">Alle</option>
                <option value="pending">Venter</option>
                <option value="active">Aktiv</option>
                <option value="paused">Pauset</option>
                <option value="closed">Stengt</option>
              </select>
            </div>
          ) : null}

          <div className="md:col-span-2">
            <label className="block text-xs text-[rgb(var(--lp-muted))]">Limit</label>
            <select
              value={String(limit)}
              onChange={(e) => {
                setPage(1);
                setLimit(normalizeLimit(e.target.value));
              }}
              className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm"
            >
              {ALLOWED_LIMITS.map((n) => (
                <option key={n} value={String(n)}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-[rgb(var(--lp-muted))]">Sortering</label>
            <div className="mt-1 flex gap-2">
              <select
                value={sort}
                onChange={(e) => {
                  setPage(1);
                  setSort(isSortKey(e.target.value) ? (e.target.value as SortKey) : "updated_at");
                }}
                className="w-full rounded-2xl border bg-white px-3 py-2 text-sm"
              >
                <option value="updated_at">Sist endret</option>
                <option value="created_at">Opprettet</option>
                <option value="name">Navn</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  setPage(1);
                  setDir((d) => (d === "asc" ? "desc" : "asc"));
                }}
                className="rounded-2xl border bg-white px-3 py-2 text-sm"
                aria-label="Bytt retning"
                title="Bytt retning"
              >
                {dir === "asc" ? "↑" : "↓"}
              </button>
            </div>
          </div>

          <div className="md:col-span-12">
            {view === "active" ? (
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={includeClosed}
                  onChange={(e) => {
                    setPage(1);
                    setIncludeClosed(e.target.checked);
                  }}
                />
                <span>Inkluder stengte firma</span>
              </label>
            ) : null}

            {isPending ? <span className="ml-3 text-xs text-[rgb(var(--lp-muted))]">Oppdaterer…</span> : null}
          </div>
        </div>

      </section>

      {/* Error */}
      {err ? (
        <section className="mt-4 rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold text-red-700">Kunne ikke hente firmaoversikt</div>
          <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            {err.message || "Ukjent feil."}{" "}
            {err.rid ? <span className="ml-2 text-xs">rid: {err.rid}</span> : null}
          </div>
          {err.detail ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm">Tekniske detaljer</summary>
              <pre className="mt-2 whitespace-pre-wrap text-xs">{JSON.stringify(err.detail, null, 2)}</pre>
            </details>
          ) : null}
        </section>
      ) : null}

      {!err && !loading && typeof total === "number" && total === 0 ? (
        <section className="mt-4 rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">System truth</div>
          <div className="mt-1 text-sm font-semibold text-[rgb(var(--lp-text))]">0 firma i kilde</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            {systemTruth?.rid ? `rid: ${systemTruth.rid}` : "rid: (mangler)"}
          </div>
          <div className="mt-3 grid gap-2 text-xs text-[rgb(var(--lp-muted))] md:grid-cols-2">
            <div>
              <div className="font-semibold text-[rgb(var(--lp-text))]">Kilde</div>
              <div>companies: {systemTruth?.source?.companies ?? "companies"}</div>
              <div>profiles: {systemTruth?.source?.profiles ?? "profiles"}</div>
              <div>agreement: {systemTruth?.source?.agreement ?? "company_current_agreement"}</div>
            </div>
            <div>
              <div className="font-semibold text-[rgb(var(--lp-text))]">Filtre</div>
              <div>q: {systemTruth?.filters?.q ?? "—"}</div>
              <div>status: {systemTruth?.filters?.status ?? "all"}</div>
              <div>includeClosed: {String(systemTruth?.filters?.includeClosed ?? false)}</div>
              <div>sort: {systemTruth?.filters?.sort ?? "updated_at"} / {systemTruth?.filters?.dir ?? "desc"}</div>
            </div>
          </div>
          <div className="mt-3 text-xs text-[rgb(var(--lp-muted))]">
            Vurdering: Ingen firma i databasen for valgt kilde og filter. Hvis du forventer data, er det sannsynlig feil
            datakilde eller tomt miljø.
          </div>
        </section>
      ) : null}

      {/* Status confirm modal */}
      {confirmOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50 grid place-items-center bg-black/25 p-4 backdrop-blur-sm">
              <div className="w-[min(92vw,520px)] rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-[0_20px_60px_rgba(0,0,0,0.18)] ring-1 ring-neutral-200 transition-[transform,opacity] duration-150 ease-out">
                <div className="text-xs font-bold text-neutral-500">Bekreft</div>
                <div className="mt-1 text-lg font-semibold text-neutral-950">Endre firmastatus</div>

                <p className="mt-2 text-sm text-neutral-700">
                  Du er i ferd med å endre status for{" "}
                  <span className="font-semibold">{confirmPayload.current?.name ?? "firma"}</span> til{" "}
                  <span className="font-semibold">{statusLabel(confirmPayload.current?.next ?? "pending")}</span>.
                </p>

                {statusErr ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                    {statusErr}
                  </div>
                ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="rounded-full border bg-white px-4 py-2 text-sm hover:bg-neutral-50"
                onClick={closeConfirm}
                disabled={!!statusBusyId}
              >
                Avbryt
              </button>
              <button
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-60"
                onClick={doChangeStatus}
                disabled={!!statusBusyId}
              >
                {statusBusyId ? "Oppdaterer…" : "Bekreft"}
              </button>
            </div>
          </div>
        </div>,
            document.body
          )
        : null}

      {/* Detail drawer */}
      {detailId ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-black/20"
            onClick={closeDetail}
            aria-label="Lukk detaljer"
          />
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-xl ring-1 ring-neutral-200">
            <div className="flex items-start justify-between border-b border-[rgb(var(--lp-border))] px-5 py-4">
              <div>
                <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Firma</div>
                <div className="mt-1 text-lg font-semibold text-[rgb(var(--lp-text))]">
                  {detail?.company?.name ?? "Laster..."}
                </div>
                {detailRid ? <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">rid: {detailRid}</div> : null}
              </div>
              <button className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50" onClick={closeDetail}>
                Lukk
              </button>
            </div>

            <div className="h-[calc(100%-64px)] overflow-y-auto px-5 py-4">
                  {detailLoading ? (
                    <div className="text-sm text-[rgb(var(--lp-muted))]">Laster detaljer...</div>
                  ) : detailErr ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <div className="font-semibold">Kunne ikke hente detaljer</div>
                  <div className="mt-1 text-xs">
                    {detailErr.message || "Ukjent feil."} {detailErr.rid ? `rid: ${detailErr.rid}` : ""}
                  </div>
                </div>
              ) : detail ? (
                <div className="space-y-4">
                  <section className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
                    <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Firma</div>
                    <div className="mt-1 text-sm font-semibold text-[rgb(var(--lp-text))]">{detail.company.name}</div>
                    <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                      Org.nr: {detail.company.orgnr ?? "—"} • Status: {statusLabel(normStatus(detail.company.status))}
                    </div>
                    <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">ID: {detail.company.id}</div>
                  </section>

                  <section className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
                    <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Tellinger</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-2xl border bg-white px-3 py-2">
                        <div className="text-xs text-[rgb(var(--lp-muted))]">Ansatte</div>
                        <div className="text-base font-semibold">{detail.counts.employeesCount}</div>
                      </div>
                      <div className="rounded-2xl border bg-white px-3 py-2">
                        <div className="text-xs text-[rgb(var(--lp-muted))]">Company admins</div>
                        <div className="text-base font-semibold">{detail.counts.adminsCount}</div>
                      </div>
                    </div>
                  </section>

                  <section className="rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
                    <div className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Avtale</div>
                    {detail.agreement ? (
                      <div className="mt-2 text-sm text-[rgb(var(--lp-text))]">
                        <div>Plan: {detail.agreement.planLabel ?? "—"}</div>
                        <div>Plan-tier: {detail.agreement.planTier ?? "—"}</div>
                        <div>Status: {detail.agreement.status ?? "—"}</div>
                        <div>Start: {detail.agreement.startDate ?? "—"}</div>
                        <div>Slutt: {detail.agreement.endDate ?? "—"}</div>
                        <div>Sist oppdatert: {detail.agreement.updatedAt ?? "—"}</div>
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen aktiv avtale.</div>
                    )}
                  </section>
                </div>
              ) : (
                <div className="text-sm text-[rgb(var(--lp-muted))]">Ingen data.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <section className="mt-6 rounded-3xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="border-b border-[rgb(var(--lp-border))] px-5 py-4">
          <div className="text-sm font-semibold">Firma</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Klikk et firma for detaljer og avtale.</div>
          {statusBusyId ? (
            <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Oppdaterer status…</div>
          ) : null}
        </div>

        {statusErr && !confirmOpen ? (
          <div className="border-b border-[rgb(var(--lp-border))] px-5 py-3 text-sm font-semibold text-red-700">
            {statusErr}
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-white/70 text-xs text-[rgb(var(--lp-muted))]">
              <tr className="border-b border-[rgb(var(--lp-border))]">
                <th className="px-5 py-3">Firma</th>
                <th className="px-5 py-3">Org.nr</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Plan</th>
                <th className="px-5 py-3">Ansatte</th>
                <th className="px-5 py-3">{view === "archived" ? "Arkivert" : "Sist endret"}</th>
                <th className="px-5 py-3 text-right">Handling</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-[rgb(var(--lp-muted))]" colSpan={7}>
                    Laster…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-5 py-6 text-sm text-[rgb(var(--lp-muted))]" colSpan={7}>
                    Ingen treff.
                  </td>
                </tr>
              ) : (
                rows.map((c, idx) => {
                  const st = normStatus(c.status);
                  const busy = statusBusyId === c.id;

                  return (
                    <tr
                      key={c.id}
                      className={[
                        "border-b border-[rgb(var(--lp-border))] last:border-b-0 cursor-pointer",
                        idx % 2 === 0 ? "bg-white/30" : "bg-white/10",
                      ].join(" ")}
                      onClick={() => openDetail(c)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDetail(c);
                        }
                      }}
                      aria-label={`Åpne ${c.name}`}
                    >
                  <td className="px-5 py-4">
                    <div className="font-medium">{c.name}</div>
                    <div className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">{c.id}</div>
                  </td>
                  <td className="px-5 py-4">{c.orgnr ?? "—"}</td>
                  <td className="px-5 py-4">
                    <span className={["inline-flex rounded-full px-2.5 py-1 text-xs", badgeClass(st)].join(" ")}>
                      {statusLabel(st)}
                    </span>
                  </td>
                  <td className="px-5 py-4">{safeStr(c.planLabel) || "—"}</td>
                  <td className="px-5 py-4">
                    {Number.isFinite(Number(c.employeesCount)) ? String(c.employeesCount) : "—"}
                  </td>
                      <td className="px-5 py-4">{fmtTs(view === "archived" ? c.archivedAt ?? c.updatedAt : c.updatedAt)}</td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          {view === "active" ? (
                            <>
                              <button
                                className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-40"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfirm(c, "active");
                                }}
                                title="Sett firma aktivt"
                              >
                                Aktivér
                              </button>
                              <button
                                className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-40"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfirm(c, "paused");
                                }}
                                title="Sett firma på pause"
                              >
                                Pause
                              </button>
                              <button
                                className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-40"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openConfirm(c, "closed");
                                }}
                                title="Steng firma"
                              >
                                Steng
                              </button>
                            </>
                          ) : null}

                          <Link
                            className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50"
                            href={`/superadmin/companies/${c.id}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Åpne
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between gap-2 border-t border-[rgb(var(--lp-border))] px-5 py-4">
          <div className="text-xs text-[rgb(var(--lp-muted))]">{typeof total === "number" ? `Totalt: ${total}` : " "}</div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-2xl border bg-white px-3 py-2 text-xs disabled:opacity-40"
              disabled={!canPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Forrige
            </button>

            <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
              Side {page}
              {pages ? ` / ${pages}` : ""}
            </span>

            <button
              className="rounded-2xl border bg-white px-3 py-2 text-xs disabled:opacity-40"
              disabled={!canNext || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Neste
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}









