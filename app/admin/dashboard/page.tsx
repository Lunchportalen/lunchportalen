// app/admin/dashboard/page.tsx
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Card } from "@/components/ui/card";
import { motionClasses } from "@/lib/ui/motionTokens";
import Sparkline from "./Sparkline";
import { supabaseServer } from "@/lib/supabase/server";

function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

type Metrics = {
  ok: boolean;
  companyId: string;
  period: { today: string; from30: string; from14: string };
  company: {
    id: string;
    name: string;
    status: string;
    plan_tier: string | null;
    price_per_portion_ex_vat: number | null;
  };
  active_users_30d: number;
  orders_14d: number;
  cancellations_before_0800: number;
  waste_estimate: number | null;
  cost_estimate: number | null;
  meta?: { note?: string | null };
};

type DailyPoint = {
  date: string;
  orders: number;
  cancelled: number;
  cancelled_before_0800: number;
};

type DailyResponse = {
  ok: boolean;
  companyId: string;
  from: string;
  to: string;
  days: number;
  series: DailyPoint[];
  totals: { orders: number; cancelled: number; cancelled_before_0800: number };
};

async function fetchJSON<T>(path: string, cookieHeader: string): Promise<T> {
  // Same-origin fetch (Next server). Cookie header carries Supabase session.
  const res = await fetch(path, {
    method: "GET",
    headers: {
      cookie: cookieHeader,
      "content-type": "application/json",
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.message ?? `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

function money(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "–";
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" }).format(Number(v));
}

function int(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "–";
  return new Intl.NumberFormat("nb-NO").format(Number(v));
}

function pct(n: number, d: number) {
  if (!d) return "–";
  const v = (n / d) * 100;
  return `${v.toFixed(1).replace(".", ",")}%`;
}

export default async function CompanyAdminDashboardPage() {
  const supabase = await supabaseServer();

  // Auth gate (server-side)
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;
  if (!user) redirect("/login?next=/admin/dashboard");

  const role = String(user.user_metadata?.role ?? "employee");
  if (role !== "company_admin") redirect("/admin");

  // Next 15: headers() is async
  const cookieHeader = (await headers()).get("cookie") ?? "";

  let m: Metrics | null = null;
  let d: DailyResponse | null = null;
  let err: string | null = null;

  try {
    m = await fetchJSON<Metrics>("/api/admin/metrics", cookieHeader);
    d = await fetchJSON<DailyResponse>("/api/admin/metrics/daily?days=14", cookieHeader);
  } catch (e: any) {
    err = String(e?.message ?? "Kunne ikke hente data");
  }

  const ordersSeries = (d?.series ?? []).map((x) => Number(x.orders ?? 0));
  const cancSeries = (d?.series ?? []).map((x) => Number(x.cancelled ?? 0));
  const before0800Series = (d?.series ?? []).map((x) => Number(x.cancelled_before_0800 ?? 0));

  const cancRate = d ? pct(d.totals.cancelled, d.totals.orders) : "–";
  const beforeRate = d ? pct(d.totals.cancelled_before_0800, d.totals.cancelled) : "–";

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-2">
        <div className="text-xs text-[rgb(var(--lp-muted))]">Firmaadmin</div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[rgb(var(--lp-muted))]">Status og nøkkeltall for de siste 14 og 30 dagene.</p>
      </div>

      {err ? (
        <div className="lp-error-outline rounded-card p-5">
          <div className="text-sm font-medium text-red-600">Kunne ikke laste data</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{err}</div>
          <div className="mt-4 text-xs text-[rgb(var(--lp-muted))]">
            Tips: Sjekk at firma er <span className="font-medium">active</span> og at du er logget inn som{" "}
            <span className="font-medium">company_admin</span>.
          </div>
        </div>
      ) : !m ? (
        <div className="lp-state-soft rounded-card p-5">
          <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
        </div>
      ) : (
        <>
          {/* Header */}
          <Card variant="glass" className="mb-6 rounded-card p-6">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-[rgb(var(--lp-muted))]">Firma</div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-lg font-semibold">{m.company?.name ?? "Ditt firma"}</div>
                <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-xs text-white">
                  {String(m.company?.status ?? "").toUpperCase()}
                </span>
                {m.company?.plan_tier ? (
                  <span className="inline-flex items-center rounded-full bg-[rgb(var(--lp-surface))] px-3 py-1 text-xs text-[rgb(var(--lp-text))] ring-1 ring-[rgb(var(--lp-border))]">
                    Plan: {m.company.plan_tier}
                  </span>
                ) : null}
              </div>

              <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
                Periode: {m.period.from14} → {m.period.today} (14d) · {m.period.from30} → {m.period.today} (30d)
              </div>

              {m.meta?.note ? (
                <div className="mt-3 rounded-xl bg-[rgb(var(--lp-surface))] p-3 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
                  {m.meta.note}
                </div>
              ) : null}
            </div>
          </Card>

          {/* Trends */}
          {d ? (
            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <TrendCard
                title="Ordrer – 14 dager"
                value={int(d.totals.orders)}
                subtitle={`${d.from} → ${d.to}`}
                spark={<Sparkline values={ordersSeries} />}
              />
              <TrendCard
                title="Avbestilt – 14 dager"
                value={int(d.totals.cancelled)}
                subtitle={`Avbestillingsrate: ${cancRate}`}
                spark={<Sparkline values={cancSeries} />}
              />
              <TrendCard
                title="Avbestilt før 08:00"
                value={int(d.totals.cancelled_before_0800)}
                subtitle={`Andel av avbest.: ${beforeRate}`}
                spark={<Sparkline values={before0800Series} />}
              />
            </section>
          ) : null}

          {/* KPI */}
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <KpiCard title="Aktive brukere (30 dager)" value={int(m.active_users_30d)} hint="Unike ansatte i perioden." />
            <KpiCard title="Ordrer (14 dager)" value={int(m.orders_14d)} hint="Basert på leveringsdato." />
            <KpiCard title="Avbestilt før 08:00" value={int(m.cancellations_before_0800)} hint="Cut-off Oslo." />
            <KpiCard title="Kostnadsestimat (14 dager)" value={money(m.cost_estimate)} hint="Krever pris per kuvert." />
            <KpiCard title="Matsvinn-estimat" value={money(m.waste_estimate)} hint="Forenklet MVP-beregning." />
            <KpiCard
              title="Pris per kuvert"
              value={m.company?.price_per_portion_ex_vat ? money(m.company.price_per_portion_ex_vat) : "–"}
              hint="Settes på company."
            />
          </section>

          {/* Actions */}
          <Card variant="outline" className="mt-6 rounded-card p-6">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold">Hurtigvalg</div>
              <div className="text-sm text-[rgb(var(--lp-muted))]">Gå til ansatteoversikt eller egne ordrer.</div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/orders"
                  className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
                >
                  Se egne ordrer
                </Link>
                <Link
                  href="/admin/users"
                  className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-medium text-[rgb(var(--lp-text))] ring-1 ring-[rgb(var(--lp-border))] hover:bg-[rgb(var(--lp-surface))]"
                >
                  Ansatte
                </Link>
              </div>
            </div>
          </Card>
        </>
      )}
    </main>
  );
}

function TrendCard(props: { title: string; value: string; subtitle: string; spark: React.ReactNode }) {
  return (
    <Card variant="soft" className={cn("rounded-card p-5", motionClasses.hoverLift)}>
      <div className="text-xs text-[rgb(var(--lp-muted))]">{props.title}</div>
      <div className="mt-2 flex items-center justify-between gap-4">
        <div>
          <div className="text-2xl font-semibold tracking-tight">{props.value}</div>
          <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{props.subtitle}</div>
        </div>
        <div className="text-[rgb(var(--lp-text))]">{props.spark}</div>
      </div>
    </Card>
  );
}

function KpiCard(props: { title: string; value: string; hint?: string }) {
  return (
    <Card variant="soft" className={cn("rounded-card p-5", motionClasses.hoverLift)}>
      <div className="text-xs text-[rgb(var(--lp-muted))]">{props.title}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{props.value}</div>
      {props.hint ? <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{props.hint}</div> : null}
    </Card>
  );
}
