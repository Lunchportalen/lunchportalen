// app/superadmin/companies/companies-client.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CompanyStatus = "pending" | "active" | "paused" | "closed";
type SortKey = "updated_at" | "created_at" | "name";
type SortDir = "asc" | "desc";

type CompanyRow = {
  id: string;
  name: string;
  orgnr: string | null;
  status: CompanyStatus | null;
  plan?: string | null;
  employees_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type Stats = {
  companiesTotal?: number;
  companiesPending?: number;
  companiesActive?: number;
  companiesPaused?: number;
  companiesClosed?: number;
};

type ApiOk = {
  ok: true;
  rid?: string;
  companies: CompanyRow[];
  page?: number;
  limit?: number;
  total?: number;
  pages?: number;
  stats?: Stats;
};

type ApiErr = { ok: false; rid?: string; error: string; message?: string; detail?: any };
type ApiRes = ApiOk | ApiErr;

function safeStr(v: any) {
  return String(v ?? "").trim();
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
  try {
    return new Date(ts).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(ts);
  }
}

function badgeClass(status: CompanyStatus) {
  if (status === "active") return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  if (status === "paused") return "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
  if (status === "closed") return "bg-red-50 text-red-800 ring-1 ring-red-200";
  return "bg-neutral-50 text-neutral-700 ring-1 ring-neutral-200";
}

function statusLabel(status: CompanyStatus) {
  if (status === "active") return "Aktiv";
  if (status === "paused") return "Pauser";
  if (status === "closed") return "Stengt";
  return "Pending";
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
}) {
  const sp = new URLSearchParams();
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
 * - primær: /api/superadmin/companies
 * - fallback: /api/superadmin/firms
 */
async function fetchCompanies(qs: string, signal?: AbortSignal): Promise<ApiRes> {
  const tryFetch = async (url: string) => {
    const r = await fetch(url, { cache: "no-store", signal, headers: { "Cache-Control": "no-store" } });
    const body = await readJsonSafe(r);

    if (r.ok && body) return body as ApiRes;

    // Hvis 404, la caller prøve fallback
    if (r.status === 404) return { ok: false, error: "NOT_FOUND", message: "404", detail: { url } } as ApiErr;

    return {
      ok: false,
      rid: body?.rid,
      error: body?.error || "HTTP_ERROR",
      message: body?.message || `HTTP ${r.status}`,
      detail: body?.detail ?? body,
    } as ApiErr;
  };

  const primary = await tryFetch(`/api/superadmin/companies?${qs}`);
  if (primary && (primary as any).ok === true) return primary;

  // fallback bare hvis primær ser ut til å mangle
  const maybeErr = primary as ApiErr;
  if (maybeErr?.error === "NOT_FOUND") {
    const fallback = await tryFetch(`/api/superadmin/firms?${qs}`);
    if (fallback && (fallback as any).ok === true) return fallback;

    const err2 = fallback as ApiErr;
    return {
      ok: false,
      error: "API_MISSING",
      message: "Fant ikke API-endepunkt for firmaoversikt.",
      detail: { primary: maybeErr?.detail, fallback: err2?.detail },
    };
  }

  return primary as ApiRes;
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
    const status: "" | CompanyStatus =
      statusRaw === "pending" || statusRaw === "active" || statusRaw === "paused" || statusRaw === "closed"
        ? (statusRaw as CompanyStatus)
        : "";

    const include_closed = safeStr(searchParams.get("include_closed")) === "1";

    const page = clampInt(searchParams.get("page"), 1, 1, 9999);
    const limit = clampInt(searchParams.get("limit"), 50, 1, 500);

    const sortRaw = safeStr(searchParams.get("sort"));
    const dirRaw = safeStr(searchParams.get("dir"));
    const sort: SortKey = isSortKey(sortRaw) ? sortRaw : "updated_at";
    const dir: SortDir = isSortDir(dirRaw) ? dirRaw : "desc";

    return { q, status, include_closed, page, limit, sort, dir };
  }, [searchParams]);

  const [qText, setQText] = useState(initial.q);
  const [status, setStatus] = useState<"" | CompanyStatus>(initial.status);
  const [includeClosed, setIncludeClosed] = useState(initial.include_closed);
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(initial.limit);
  const [sort, setSort] = useState<SortKey>(initial.sort);
  const [dir, setDir] = useState<SortDir>(initial.dir);

  // Data state
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<ApiErr | null>(null);

  // Status change UI
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmPayload = useRef<{ id: string; name: string; next: CompanyStatus } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const reqSeq = useRef(0);

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
    });
  }, [qText, status, includeClosed, page, limit, sort, dir]);

  useEffect(() => {
    startTransition(() => {
      router.replace(`/superadmin/companies?${qs}`);
    });
  }, [qs, router, startTransition]);

  // Data fetch
  useEffect(() => {
    const seq = ++reqSeq.current;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);
    setErr(null);
    setStatusErr(null);

    fetchCompanies(qs, ac.signal)
      .then((res) => {
        if (ac.signal.aborted) return;
        if (seq !== reqSeq.current) return;

        if (!res || (res as any).ok !== true) {
          setRows([]);
          setStats(null);
          setTotal(null);
          setPages(null);
          setErr((res as ApiErr) ?? { ok: false, error: "UNKNOWN", message: "Ukjent feil" });
          return;
        }

        const ok = res as ApiOk;

        // Tolerant parsing (i tilfelle API returnerer litt andre feltnavn)
        const list = Array.isArray((ok as any).companies)
          ? (ok as any).companies
          : Array.isArray((ok as any).rows)
          ? (ok as any).rows
          : Array.isArray((ok as any).data)
          ? (ok as any).data
          : [];

        const normalized: CompanyRow[] = list
          .map((x: any) => ({
            id: safeStr(x?.id),
            name: safeStr(x?.name) || "Ukjent firma",
            orgnr: x?.orgnr ?? null,
            status: normStatus(x?.status),
            plan: x?.plan ?? x?.plan_tier ?? null,
            employees_count: Number.isFinite(Number(x?.employees_count))
              ? Number(x?.employees_count)
              : Number.isFinite(Number(x?.employee_count))
              ? Number(x?.employee_count)
              : null,
            created_at: x?.created_at ?? null,
            updated_at: x?.updated_at ?? null,
          }))
          .filter((x: CompanyRow) => !!x.id);

        setRows(normalized);
        setStats(ok.stats ?? null);
        setTotal(Number.isFinite(Number((ok as any).total)) ? Number((ok as any).total) : null);
        setPages(Number.isFinite(Number((ok as any).pages)) ? Number((ok as any).pages) : null);
        setErr(null);
      })
      .catch((e) => {
        if (ac.signal.aborted) return;
        setRows([]);
        setStats(null);
        setTotal(null);
        setPages(null);
        setErr({ ok: false, error: "FETCH_FAILED", message: e?.message || "Fetch feilet", detail: e });
      })
      .finally(() => {
        if (ac.signal.aborted) return;
        setLoading(false);
      });

    return () => ac.abort();
  }, [qs]);

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
    <main className="lp-select-text mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Firmaoversikt</h1>
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

      {/* Controls */}
      <section className="mt-6 rounded-3xl bg-white/70 p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="grid gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-5">
            <label className="block text-xs text-[rgb(var(--lp-muted))]">Søk</label>
            <input
              value={qText}
              onChange={(e) => setQText(e.target.value)}
              placeholder="Navn, orgnr…"
              className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm outline-none"
            />
          </div>

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
              <option value="pending">Pending</option>
              <option value="active">Aktiv</option>
              <option value="paused">Pauser</option>
              <option value="closed">Stengt</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-[rgb(var(--lp-muted))]">Limit</label>
            <select
              value={String(limit)}
              onChange={(e) => {
                setPage(1);
                setLimit(clampInt(e.target.value, 50, 1, 500));
              }}
              className="mt-1 w-full rounded-2xl border bg-white px-3 py-2 text-sm"
            >
              {[25, 50, 100, 200, 300, 500].map((n) => (
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

            {isPending ? <span className="ml-3 text-xs text-[rgb(var(--lp-muted))]">Oppdaterer…</span> : null}
          </div>
        </div>

        {/* Stats row (hvis API leverer) */}
        {stats ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {typeof stats.companiesTotal === "number" ? (
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
                Totalt: {stats.companiesTotal}
              </span>
            ) : null}
            {typeof stats.companiesPending === "number" ? (
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
                Pending: {stats.companiesPending}
              </span>
            ) : null}
            {typeof stats.companiesActive === "number" ? (
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
                Aktiv: {stats.companiesActive}
              </span>
            ) : null}
            {typeof stats.companiesPaused === "number" ? (
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
                Paus: {stats.companiesPaused}
              </span>
            ) : null}
            {typeof stats.companiesClosed === "number" ? (
              <span className="rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-[rgb(var(--lp-border))]">
                Stengt: {stats.companiesClosed}
              </span>
            ) : null}
          </div>
        ) : null}
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

      {/* Status confirm modal */}
      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-xl ring-1 ring-neutral-200">
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
                className="rounded-2xl border bg-white px-4 py-2 text-sm hover:bg-neutral-50"
                onClick={closeConfirm}
                disabled={!!statusBusyId}
              >
                Avbryt
              </button>
              <button
                className="rounded-2xl bg-neutral-900 px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-60"
                onClick={doChangeStatus}
                disabled={!!statusBusyId}
              >
                {statusBusyId ? "Oppdaterer…" : "Bekreft"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Table */}
      <section className="mt-6 overflow-hidden rounded-3xl bg-white/70 ring-1 ring-[rgb(var(--lp-border))]">
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
                <th className="px-5 py-3">Sist endret</th>
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
                        "border-b border-[rgb(var(--lp-border))] last:border-b-0",
                        idx % 2 === 0 ? "bg-white/30" : "bg-white/10",
                      ].join(" ")}
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
                      <td className="px-5 py-4">{safeStr(c.plan) || "—"}</td>
                      <td className="px-5 py-4">
                        {Number.isFinite(Number(c.employees_count)) ? String(c.employees_count) : "—"}
                      </td>
                      <td className="px-5 py-4">{fmtTs(c.updated_at)}</td>

                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-40"
                            disabled={busy}
                            onClick={() => openConfirm(c, "active")}
                            title="Sett firma aktivt"
                          >
                            Aktivér
                          </button>
                          <button
                            className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-40"
                            disabled={busy}
                            onClick={() => openConfirm(c, "paused")}
                            title="Sett firma på pause"
                          >
                            Pause
                          </button>
                          <button
                            className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50 disabled:opacity-40"
                            disabled={busy}
                            onClick={() => openConfirm(c, "closed")}
                            title="Steng firma"
                          >
                            Steng
                          </button>

                          <Link
                            className="rounded-2xl border bg-white px-3 py-2 text-xs hover:bg-neutral-50"
                            href={`/superadmin/companies/${encodeURIComponent(c.id)}`}
                          >
                            Åpne →
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
              ← Forrige
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
              Neste →
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
