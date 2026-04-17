"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CategoryDominancePayload = {
  generatedAt: string;
  ownershipScore: number;
  categoryStrength: number;
  positionClarity: number;
  distributionCoverage: number;
  moatStrength: number;
  explain: string[];
  alertItems: Array<{ id: string; label: string }>;
  engineReasons: string[];
};

type ApiOk = { ok: true; rid: string; data: CategoryDominancePayload };
type ApiErr = { ok: false; rid?: string; message?: string };
type ApiResp = ApiOk | ApiErr;

type ActionLink = { href: string; labelNb: string };

const ACTIONS: ActionLink[] = [
  { href: "/superadmin/growth/social", labelNb: "Forbedre posisjon" },
  { href: "/superadmin/growth/social", labelNb: "Utvid distribusjon" },
];

export default function CategoryDominancePanel() {
  const [data, setData] = useState<CategoryDominancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchJson = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/superadmin/control-tower/monopoly", {
        credentials: "include",
        cache: "no-store",
      });
      const j = (await r.json()) as ApiResp;
      if (j?.ok === true && j.data) {
        setData(j.data);
      } else {
        setErr((j as ApiErr)?.message ?? "Kunne ikke laste kategori-eierskap.");
        setData(null);
      }
    } catch {
      setErr("Nettverksfeil.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJson();
  }, [fetchJson]);

  return (
    <section
      className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6"
      id="kategori-dominans"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Kategori-dominans</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Eierskap til kategori — klarhet, posisjon, dekning og vollgrav (ingen auto-utførelse).
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchJson()}
          disabled={loading}
          className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm text-[rgb(var(--lp-fg))] hover:bg-[rgb(var(--lp-muted))]/10 disabled:opacity-50"
        >
          {loading ? "Oppdaterer…" : "Oppdater"}
        </button>
      </div>

      {err ? <p className="mt-4 text-sm text-red-600">{err}</p> : null}

      {loading && !data ? (
        <p className="mt-6 text-sm text-[rgb(var(--lp-muted))]">Laster…</p>
      ) : null}

      {data ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 text-sm text-[rgb(var(--lp-fg))] sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Kategori (styrke)</div>
              <div className="font-medium tabular-nums">{data.categoryStrength}/100</div>
            </div>
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Posisjon (klarhet)</div>
              <div className="font-medium tabular-nums">{data.positionClarity}/100</div>
            </div>
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Distribusjon (dekning)</div>
              <div className="font-medium tabular-nums">{data.distributionCoverage}/100</div>
            </div>
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Vollgrav (styrke)</div>
              <div className="font-medium tabular-nums">{data.moatStrength}/100</div>
            </div>
          </div>

          <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]/40 px-4 py-3">
            <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Samlet eierskap
            </div>
            <div className="mt-1 font-heading text-2xl font-semibold tabular-nums text-[rgb(var(--lp-fg))]">
              {data.ownershipScore}/100
            </div>
          </div>

          {data.alertItems.length > 0 || data.engineReasons.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Varsler</h3>
              <ul className="mt-2 space-y-2">
                {data.alertItems.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-lg border border-amber-600/35 bg-amber-600/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100"
                  >
                    {a.label}
                  </li>
                ))}
              </ul>
              {data.engineReasons.length > 0 ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[rgb(var(--lp-muted))]">
                  {data.engineReasons.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen nye varsler siden forrige kjøring.</p>
          )}

          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--lp-fg))]">Tiltak</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {ACTIONS.map((a) => (
                <Link
                  key={a.labelNb}
                  href={a.href}
                  className="rounded-full border border-[rgb(var(--lp-border))] px-3 py-1.5 text-sm text-[rgb(var(--lp-fg))] hover:bg-[rgb(var(--lp-muted))]/10"
                >
                  {a.labelNb}
                </Link>
              ))}
            </div>
          </div>

          <details className="text-xs text-[rgb(var(--lp-muted))]">
            <summary className="cursor-pointer select-none">Forklaring (vektet snitt)</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {data.explain.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>

          <p className="text-xs text-[rgb(var(--lp-muted))]">
            Data: {new Date(data.generatedAt).toLocaleString("nb-NO", { timeZone: "Europe/Oslo" })}
          </p>
        </div>
      ) : null}
    </section>
  );
}
