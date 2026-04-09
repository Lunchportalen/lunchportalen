export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { PageContainer } from "@/components/layout/PageContainer";
import { buildEnterpriseDashboardPayload } from "@/lib/ai/enterprise/buildDashboardPayload";
import { fetchRecentEnterpriseLogs } from "@/lib/ai/enterprise/enterpriseLog";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { makeRid } from "@/lib/http/respond";

function fmt(n: number, d = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(d);
}

export default async function EnterpriseDashboardPage() {
  const auth = await getAuthContext();
  const rid = makeRid("enterprise_view");
  let payload: Awaited<ReturnType<typeof buildEnterpriseDashboardPayload>> | null = null;
  let loadError: string | null = null;
  try {
    payload = await buildEnterpriseDashboardPayload({
      rid,
      persistLog: auth.ok,
      actor_user_id: auth.ok && auth.user ? auth.user.id : null,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Kunne ikke laste enterprise-data.";
  }
  const logs = await fetchRecentEnterpriseLogs(40);

  return (
    <PageContainer className="max-w-[1440px] py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Enterprise — inntekt og margin</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Proxy-baserte signaler for margin, prisforslag (kun forslag), segmenter og konvertering. Ingen automatisk
        fakturering eller prisendring.
      </p>

      {loadError ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Data ikke tilgjengelig: {loadError}
        </div>
      ) : null}

      {payload ? <p className="mt-2 font-mono text-xs text-slate-500">RID: {payload.rid}</p> : null}

      {payload ? (
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Margin / profit (proxy)</h2>
          <ul className="mt-3 space-y-1 text-sm text-slate-700">
            <li>Margin: {fmt(payload.profit.margin * 100, 1)} %</li>
            <li>Profit per kunde-proxy: {fmt(payload.profit.profitPerCustomer, 4)}</li>
            <li>Profit per selskap-proxy: {fmt(payload.profit.profitPerCompany, 4)}</li>
            <li>Høyverdi-segmenter: {payload.profit.highValueSegments.join(", ") || "—"}</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Pris (kun forslag)</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {payload.pricing.map((p, i) => (
              <li key={i} className="rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                <span className="font-medium">{p.type}</span> · tillit {fmt(p.confidence * 100, 0)}% · risiko{" "}
                {fmt(p.risk * 100, 0)}%
                <p className="mt-1 text-xs text-slate-600">{p.explain}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Segmenter (selskap)</h2>
          <ul className="mt-3 max-h-64 space-y-2 overflow-auto text-sm">
            {payload.segments.length === 0 ? (
              <li className="text-slate-500">Ingen segmentdata.</li>
            ) : (
              payload.segments.slice(0, 24).map((s) => (
                <li key={s.companyId} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1">
                  <span className="font-medium text-slate-800">{s.companyName}</span>
                  <span className="text-slate-600">{s.segment}</span>
                  <span className="w-full text-xs text-slate-500">{s.reason}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Konvertering</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {payload.conversion.map((c, i) => (
              <li key={i}>
                <span className="font-medium">{c.action}</span> · {c.explain}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Churn / retention</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {payload.retention.map((r, i) => (
              <li key={i}>
                {r.scope}: score {fmt(r.riskScore * 100, 0)}% · varsle admin: {r.notifyAdmin ? "ja" : "nei"}
                <ul className="ml-4 list-disc text-xs text-slate-600">
                  {r.suggestions.map((s, j) => (
                    <li key={j}>{s}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Eksperiment-forslag (inntekt)</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {payload.experimentHints.map((h, i) => (
              <li key={i} className="rounded-lg border border-slate-100 p-2">
                <span className="font-medium">{h.title}</span> · hypotese +{fmt(h.revenueImpactHypothesis * 100, 1)} %
                <p className="text-xs text-slate-600">{h.explain}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Attributt (proxy)</h2>
          <p className="mt-2 text-sm text-slate-600">
            Eksperimentinntekt 7d: {fmt(payload.attribution.experimentRevenue7d, 2)} · forrige 7d:{" "}
            {fmt(payload.attribution.experimentRevenuePrior7d, 2)}
          </p>
          <p className="mt-1 text-xs text-slate-500">{payload.attribution.explain.join(" · ")}</p>
        </section>
      </div>
      ) : null}

      <section className="mt-10">
        <h2 className="text-sm font-semibold text-slate-900">Siste logger</h2>
        <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white text-sm">
          {logs.length === 0 ? (
            <li className="px-4 py-4 text-slate-500">Ingen logger.</li>
          ) : (
            logs.map((row) => (
              <li key={row.id} className="px-4 py-2">
                <span className="font-medium">{row.entry_type}</span>
                <span className="ml-2 text-xs text-slate-500">{row.created_at}</span>
              </li>
            ))
          )}
        </ul>
      </section>
    </PageContainer>
  );
}
