"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fmtCo2e, fmtKg, fmtNok, fmtNum } from "@/lib/esg/format";

type Item = {
  company_id: string;
  company_name: string | null;
  company_status: string | null;

  year: number;
  stability_score: string | null;

  ordered_count: number;
  cancelled_in_time_count: number;

  waste_meals: number;
  waste_kg: number;
  waste_co2e_kg: number;

  cost_saved_nok: number;
  cost_waste_nok: number;
  cost_net_nok: number;

  waste_rate: number | null; // 0..1
};

type ApiOk = {
  ok: true;
  year: number;
  total: number;
  page: number;
  limit: number;
  items: Item[];
};

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) throw new Error(`Tom respons (HTTP ${res.status})`);
  try {
    return JSON.parse(t);
  } catch {
    throw new Error(`Ugyldig JSON (HTTP ${res.status})`);
  }
}

function osloYear(): number {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric" });
  return Number(fmt.format(new Date()));
}

function badge(score: string | null) {
  const s = (score ?? "").toUpperCase();
  const base = "inline-flex items-center rounded-full px-2 py-1 text-xs font-extrabold ring-1";
  if (s === "A") return <span className={`${base} bg-emerald-50 text-emerald-800 ring-emerald-200`}>A</span>;
  if (s === "B") return <span className={`${base} bg-lime-50 text-lime-800 ring-lime-200`}>B</span>;
  if (s === "C") return <span className={`${base} bg-amber-50 text-amber-900 ring-amber-200`}>C</span>;
  if (s === "D") return <span className={`${base} bg-rose-50 text-rose-900 ring-rose-200`}>D</span>;
  return <span className={`${base} bg-white/60 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))]`}>—</span>;
}

export default function SuperadminEsgBenchmarkClient() {
  const [year, setYear] = useState<number>(osloYear());
  const [score, setScore] = useState<string>("ALL");
  const [q, setQ] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const limit = 50;

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<ApiOk | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const queryUrl = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("year", String(year));
    sp.set("score", score);
    if (q.trim()) sp.set("q", q.trim());
    sp.set("page", String(page));
    sp.set("limit", String(limit));
    return `/api/superadmin/esg/benchmark?${sp.toString()}`;
  }, [year, score, q, page]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const res = await fetch(queryUrl, { cache: "no-store" });
        const j: any = await readJson(res);

        if (!alive) return;

        if (!j?.ok) {
          const msg = j?.message ?? j?.error ?? `Ukjent feil (HTTP ${res.status})`;
          throw new Error(String(msg));
        }

        setData(j as ApiOk);
        setErr(null);
      } catch (e: any) {
        if (!alive) return;
        setErr(String(e?.message ?? e));
        setData(null);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [queryUrl]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="rounded-2xl bg-white/60 p-4 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-bold text-[rgb(var(--lp-muted))]">År</div>
            <input
              value={year}
              onChange={(e) => {
                const v = Number(e.target.value);
                setYear(Number.isFinite(v) ? v : osloYear());
                setPage(1);
              }}
              className="w-24 rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-[rgb(var(--lp-border))]"
              inputMode="numeric"
            />

            <div className="ml-2 text-xs font-bold text-[rgb(var(--lp-muted))]">Score</div>
            <select
              value={score}
              onChange={(e) => {
                setScore(e.target.value);
                setPage(1);
              }}
              className="rounded-xl bg-white px-3 py-2 text-sm font-bold ring-1 ring-[rgb(var(--lp-border))]"
            >
              <option value="ALL">Alle</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>

          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Søk firma, status eller id…"
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold ring-1 ring-[rgb(var(--lp-border))] md:w-80"
          />
        </div>
      </div>

      {/* Error */}
      {err && (
        <div className="rounded-2xl bg-white/60 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-extrabold text-rose-700">Kunne ikke hente ESG benchmark</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{err}</div>
        </div>
      )}

      {/* List */}
      <section className="rounded-2xl bg-white/60 ring-1 ring-[rgb(var(--lp-border))]">
        <div className="flex items-center justify-between gap-3 px-6 py-4">
          <div className="text-sm font-extrabold">
            {loading ? "Laster…" : `Firma (${fmtNum(data?.total ?? 0)})`}
          </div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">
            Sortert: score → lavest svinnrate → høyest spart
          </div>
        </div>

        <div className="divide-y divide-black/5">
          {(data?.items ?? []).map((r) => {
            const wasteRate = r.waste_rate === null ? "—" : `${fmtNum(r.waste_rate * 100, 1)} %`;
            const name = r.company_name || "Uten navn";

            return (
              <Link
                key={r.company_id}
                href={`/superadmin/esg/${r.company_id}`}
                className="block px-6 py-4 transition hover:bg-white/40"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-extrabold">{name}</div>
                      {badge(r.stability_score)}
                      {r.company_status && (
                        <span className="rounded-full bg-white/70 px-2 py-1 text-xs font-bold ring-1 ring-[rgb(var(--lp-border))]">
                          {r.company_status}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 truncate text-xs font-mono text-[rgb(var(--lp-muted))]">{r.company_id}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-6">
                    <div>
                      <div className="text-xs text-[rgb(var(--lp-muted))]">Svinnrate</div>
                      <div className="text-sm font-extrabold">{wasteRate}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[rgb(var(--lp-muted))]">Svinn</div>
                      <div className="text-sm font-extrabold">{fmtKg(r.waste_kg)}</div>
                      <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{fmtCo2e(r.waste_co2e_kg)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[rgb(var(--lp-muted))]">Spart</div>
                      <div className="text-sm font-extrabold">{fmtNok(r.cost_saved_nok)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[rgb(var(--lp-muted))]">Bestillinger</div>
                      <div className="text-sm font-extrabold">{fmtNum(r.ordered_count)}</div>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}

          {!loading && (data?.items?.length ?? 0) === 0 && (
            <div className="px-6 py-10 text-sm text-[rgb(var(--lp-muted))]">Ingen treff.</div>
          )}
        </div>
      </section>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-[rgb(var(--lp-muted))]">
          Side {page} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || loading}
            className="rounded-xl bg-white px-3 py-2 text-sm font-extrabold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-60"
          >
            Forrige
          </button>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || loading}
            className="rounded-xl bg-white px-3 py-2 text-sm font-extrabold ring-1 ring-[rgb(var(--lp-border))] disabled:opacity-60"
          >
            Neste
          </button>
        </div>
      </div>
    </div>
  );
}
