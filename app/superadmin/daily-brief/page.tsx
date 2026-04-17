// app/superadmin/daily-brief/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";

import { osloTodayISODate } from "@/lib/date/oslo";
import { loadDailyOperationalBrief } from "@/lib/server/superadmin/loadDailyOperationalBrief";
import type { ProductionReadinessLevel } from "@/lib/server/superadmin/loadProductionReadiness";

type SP = Record<string, string | string[] | undefined>;

function sp1(v: string | string[] | undefined) {
  if (!v) return "";
  return Array.isArray(v) ? (v[0] ?? "") : v;
}

function levelPillClass(level: ProductionReadinessLevel) {
  if (level === "READY") return "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200";
  if (level === "READY_WITH_WARNINGS") return "bg-amber-50 text-amber-950 ring-1 ring-amber-200";
  if (level === "BLOCKED_GLOBAL_CLOSED") return "bg-red-50 text-red-900 ring-1 ring-red-200";
  if (level === "NOT_DELIVERY_DAY") return "bg-neutral-100 text-neutral-800 ring-1 ring-neutral-200";
  return "bg-rose-50 text-rose-900 ring-1 ring-rose-200";
}

function formatAuditWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("nb-NO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

export default async function DailyBriefPage(props: { searchParams?: SP | Promise<SP> }) {
  const sp = (await Promise.resolve(props.searchParams ?? {})) as SP;
  const raw = sp1(sp.date);
  const dateISO = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : osloTodayISODate();
  const b = await loadDailyOperationalBrief(dateISO);
  const p = b.production;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Morgenoversikt</h1>
          <p className="mt-1 text-sm text-neutral-600 max-w-2xl">
            Ett read-only startpunkt for dagen: samme produksjonsstatus som produksjonssjekk, telling av materialiserte operative snapshots for datoen, og siste operative revisjonshendelser. Ingen ny driftmotor.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get" action="/superadmin/daily-brief">
          <label className="text-xs font-semibold text-neutral-600">
            Dato
            <input
              type="date"
              name="date"
              defaultValue={dateISO}
              className="mt-1 block h-10 rounded-xl border border-black/10 bg-white px-3 text-sm"
            />
          </label>
          <button type="submit" className="lp-btn lp-btn--secondary h-10">
            Vis
          </button>
        </form>
      </div>

      <div className={`inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ${levelPillClass(p.level)}`}>{p.headline}</div>

      <p className="text-sm text-neutral-700">{p.detail}</p>

      <div className="rounded-2xl border border-black/5 bg-neutral-50/80 p-4 text-sm text-neutral-800">
        <span className="font-semibold">Frozen snapshot (operative): </span>
        {b.snapshot_company_count > 0 ? (
          <span>
            Materialisert for <span className="font-mono text-xs">{dateISO}</span> —{" "}
            <span className="font-semibold tabular-nums">{b.snapshot_company_count}</span> firma-rad(er) i{" "}
            <span className="font-mono text-xs">production_operative_snapshots</span>.
          </span>
        ) : (
          <span>
            Ingen rader funnet for <span className="font-mono text-xs">{dateISO}</span> (eller tabell utilgjengelig). Kjøkken/driver leser snapshot når den finnes.
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Operative ordre</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900">{p.operative_orders}</div>
          <div className="mt-1 text-xs text-neutral-600">Fra canonical produksjonslesing</div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Dekning</div>
          <div className="mt-2 text-lg font-semibold tabular-nums text-neutral-900">
            {p.operative_companies} firma · {p.operative_locations} lokasjoner
          </div>
          <div className="mt-1 text-xs text-neutral-600">Rå aktive ordre: {p.orders_active_raw}</div>
        </div>
        <div className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Avvik (sum modell)</div>
          <div className="mt-2 text-3xl font-semibold tabular-nums text-neutral-900">{b.anomaly_total}</div>
          <div className="mt-1 text-xs text-neutral-600">Sum av fire canonical avvikstyper under</div>
        </div>
      </div>

      {Object.keys(p.slot_counts).length > 0 ? (
        <div className="rounded-2xl border border-black/5 bg-neutral-50/80 p-4 text-sm">
          <span className="font-semibold text-neutral-800">Ordre per vindu: </span>
          <span className="text-neutral-700">
            {Object.entries(p.slot_counts)
              .sort(([a], [b]) => a.localeCompare(b, "nb"))
              .map(([k, v]) => `${k}: ${v}`)
              .join(" · ")}
          </span>
        </div>
      ) : null}

      <div className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Avvik per type</div>
        <ul className="mt-2 space-y-1 text-sm text-neutral-800">
          <li>Mangler scope: {p.anomalies.orders_missing_scope}</li>
          <li>Aktiv ordre / kansellert dagvalg: {p.anomalies.ghost_active_orders_with_cancelled_day_choice}</li>
          <li>Operativ uten outbox-rad: {p.anomalies.operative_orders_missing_outbox}</li>
          <li>Outbox set uten matchende aktiv ordre: {p.anomalies.outbox_order_set_without_active_order}</li>
        </ul>
      </div>

      {p.global_closed_reason ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">{p.global_closed_reason}</div>
      ) : null}

      <div className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-900">Siste operative revisjonshendelser</h2>
        <p className="mt-1 text-xs text-neutral-600">Samme filter som revisjon (operative strøm). Nyeste først.</p>
        {b.audit_tail.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-600">Ingen rader å vise.</p>
        ) : (
          <ul className="mt-3 divide-y divide-black/5">
            {b.audit_tail.map((row) => (
              <li key={row.id} className="py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-xs font-medium text-neutral-500">{formatAuditWhen(row.created_at)}</span>
                  <Link href={`/superadmin/audit/${row.id}`} className="text-sm font-semibold text-neutral-900 underline-offset-2 hover:underline">
                    Åpne detalj
                  </Link>
                </div>
                <div className="mt-1 text-sm text-neutral-800">
                  <span className="font-mono text-xs">{row.action ?? "—"}</span>
                  {row.summary ? <span className="ml-2">{row.summary}</span> : null}
                </div>
                {row.entity_type || row.entity_id ? (
                  <div className="mt-1 text-xs text-neutral-600">
                    {row.entity_type ?? "—"} {row.entity_id ? <span className="font-mono">· {row.entity_id}</span> : null}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4">
          <Link href="/superadmin/audit" className="text-sm font-semibold text-neutral-900 underline-offset-2 hover:underline">
            Hele revisjonslisten →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/superadmin/production-check?date=${encodeURIComponent(dateISO)}`} className="lp-btn lp-btn--primary">
          Produksjonssjekk (detalj)
        </Link>
        <Link href="/kitchen" className="lp-btn lp-btn--secondary">
          Kjøkken
        </Link>
        <Link href="/driver" className="lp-btn lp-btn--secondary">
          Sjåfør
        </Link>
        <Link href={p.links.operations} className="lp-btn lp-btn--secondary">
          Operasjoner
        </Link>
        <Link href={p.links.outbox} className="lp-btn lp-btn--secondary">
          Outbox
        </Link>
      </div>
    </div>
  );
}
