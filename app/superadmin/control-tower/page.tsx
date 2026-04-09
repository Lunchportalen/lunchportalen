// app/superadmin/control-tower/page.tsx — Control Tower (superadmin)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getAuthContext } from "@/lib/auth/getAuthContext";
import { collectAutopilotMetrics } from "@/lib/autopilot/collectMetrics";
import { getControlTowerData } from "@/lib/controlTower/aggregator";
import type { ControlTowerData } from "@/lib/controlTower/types";
import { calculatePL } from "@/lib/finance/pl";
import { countRunningCmsExperiments } from "@/lib/investor/experimentsCount";
import { buildInvestorSnapshot } from "@/lib/investor/snapshot";
import { getGtmEngineMetrics } from "@/lib/gtm/stats";
import { buildDominationMetrics } from "@/lib/growth/dominationControlMetrics";
import { buildPlatformPowerMetrics } from "@/lib/growth/platformControlMetrics";
import { buildScaleEngineMetrics } from "@/lib/growth/scaleControlMetrics";
import { getLiveCampaignMetrics } from "@/lib/live/campaignStats";

// Dashboard top: KPIBar, ActionPanel, AIStatus, Card — composed in UnifiedControlSection
import UnifiedControlSection from "../_components/UnifiedControlSection";

import CategoryDominancePanel from "@/components/superadmin/controlTower/CategoryDominancePanel";
import GoLiveEnginePanel from "@/components/superadmin/controlTower/GoLiveEnginePanel";
import DominationStrategyPanel from "@/components/superadmin/controlTower/DominationStrategyPanel";
import ControlTowerClient from "./ControlTowerClient";

export default async function ControlTowerPage() {
  const auth = await getAuthContext();

  if (!auth.ok || auth.role !== "superadmin") {
    return (
      <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 lp-select-text">
        <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen tilgang</p>
      </main>
    );
  }

  let initial: ControlTowerData;
  let investor: ReturnType<typeof buildInvestorSnapshot> | null = null;
  const gtmMetrics = getGtmEngineMetrics();
  const liveMetrics = getLiveCampaignMetrics();
  try {
    initial = await getControlTowerData();
    const [am, expN] = await Promise.all([collectAutopilotMetrics(), countRunningCmsExperiments()]);
    investor = buildInvestorSnapshot({
      controlTower: initial,
      autopilotMetrics: am,
      experimentsRunning: expN,
    });
  } catch {
    const zeroInputs = { revenue: 0, costOfGoods: 0, adSpend: 0 };
    initial = {
      generatedAt: new Date().toISOString(),
      cacheTtlSeconds: 45,
      financialAlerts: {
        triggered: [],
        suppressed: [],
        systemStatus: "degraded",
      },
      finance: {
        pl: calculatePL(zeroInputs),
        inputs: zeroInputs,
        cogsKnown: false,
        adSpendKnown: false,
        explainNb: [
          "Aggregat feilet — ingen P&L-grunnlag.",
          "Varekost og annonsespend er ikke tilgjengelig i denne fallback.",
        ],
        unitEconomics: [],
      },
      revenue: {
        todayTotal: 0,
        weekTotal: 0,
        fromAiAttributed: 0,
        fromAiAttributedToday: 0,
        ordersCountedToday: 0,
        ordersCountedWeek: 0,
        weekTruncated: false,
        dataSource: "unavailable",
      },
      ai: {
        decisions24h: 0,
        approved24h: 0,
        skipped24h: 0,
        lowConfidence24h: 0,
        lastCycleAt: null,
        logAvailable: false,
      },
      performance: {
        topPostId: null,
        topPostRevenue: 0,
        topProductId: null,
        topProductRevenue: 0,
        aiAttributedShareWeek: null,
      },
      system: {
        health: "warning",
        lastHealthCheckAt: new Date().toISOString(),
        aiFailures24h: 0,
        summary: "Kunne ikke laste aggregat.",
      },
      predictive: {
        dataAvailable: false,
        insufficientDataMessage: "Ikke nok data — aggregat feilet.",
        forecast: {
          todayKr: null,
          weekKr: null,
          confidence: 0,
          methodNb: "",
          daysUsed: 0,
          sufficientData: false,
        },
        trend: {
          direction: "flat",
          strength: 0,
          explainNb: "",
        },
        anomalies: [],
        recommendedActions: [],
        basis: {
          lookbackDays: 14,
          seriesTruncated: false,
          conversionDropPercent: null,
        },
      },
      auditCompliance: {
        recent: [],
        suspicious24h: null,
        complianceStatus: "ok",
      },
    } satisfies ControlTowerData;
    investor = null;
  }

  const scaleMetrics = buildScaleEngineMetrics(initial);
  const dominationMetrics = buildDominationMetrics(initial);
  const platformMetrics = buildPlatformPowerMetrics(initial);

  return (
    <main className="mx-auto max-w-[1440px] px-4 pb-16 pt-8 lp-select-text">
      <header className="mb-8">
        <h1 className="font-heading text-2xl font-semibold text-[rgb(var(--lp-fg))]">Kontrolltårn</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Sanntids oversikt — AI, inntekt og systemstatus.</p>
      </header>
      <UnifiedControlSection />
      {investor ? (
        <section className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6">
          <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Revenue Engine</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Sanntids signaler (ordre + session-proxy). API: <code className="text-xs">GET /api/superadmin/investor</code>
          </p>
          <div className="mt-4 grid gap-3 text-sm text-[rgb(var(--lp-fg))] sm:grid-cols-3">
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Omsetning per økt (uke)</div>
              <div className="font-medium tabular-nums">
                {investor.revenuePerSession.toLocaleString("nb-NO", { maximumFractionDigits: 2 })} kr
              </div>
            </div>
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Konverteringsrate (proxy)</div>
              <div className="font-medium tabular-nums">
                {(investor.conversionRate * 100).toLocaleString("nb-NO", { maximumFractionDigits: 2 })} %
              </div>
            </div>
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Aktive eksperiment (CMS)</div>
              <div className="font-medium tabular-nums">{investor.experimentsRunning}</div>
            </div>
          </div>
        </section>
      ) : null}
      {investor ? (
        <section className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6">
          <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">AI Intelligence</h2>
          <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
            Prognoser og loggførte beslutninger — ikke garanterte utfall.
          </p>
          <div className="mt-4 grid gap-3 text-sm text-[rgb(var(--lp-fg))] sm:grid-cols-2">
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Prognostisert konverteringspotensial (0–1)</div>
              <div className="font-medium tabular-nums">
                {investor.predictedLift == null
                  ? "—"
                  : investor.predictedLift.toLocaleString("nb-NO", { maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-[rgb(var(--lp-muted))]">Autonome handlinger (24 t)</div>
              <div className="font-medium tabular-nums">{investor.autonomousActions}</div>
            </div>
          </div>
        </section>
      ) : null}
      <section className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6">
        <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Sales Engine</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          GTM-kjøring (prosessminne siden deploy) — ikke regnskapsgrunnlag.
        </p>
        <div className="mt-4 grid gap-3 text-sm text-[rgb(var(--lp-fg))] sm:grid-cols-3">
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Leads prosessert</div>
            <div className="font-medium tabular-nums">{gtmMetrics.leads}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Deals opprettet</div>
            <div className="font-medium tabular-nums">{gtmMetrics.deals}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Omsetning attribuert (GTM)</div>
            <div className="font-medium tabular-nums">
              {gtmMetrics.revenue.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr
            </div>
          </div>
        </div>
      </section>
      <section className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6">
        <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Live Campaigns</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Sporbarhet (prosessminne siden deploy). Klikk: <code className="text-xs">/api/track/click?to=…&amp;c=…</code> (kun tillatte
          domener).
        </p>
        <div className="mt-4 grid gap-3 text-sm text-[rgb(var(--lp-fg))] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-[rgb(var(--lp-muted))]">E-post sendt (live)</div>
            <div className="font-medium tabular-nums">{liveMetrics.emails}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Sosiale poster (live)</div>
            <div className="font-medium tabular-nums">{liveMetrics.posts}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Klikk (sporet)</div>
            <div className="font-medium tabular-nums">{liveMetrics.clicks}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Omsetning (live teller)</div>
            <div className="font-medium tabular-nums">
              {liveMetrics.revenue.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr
            </div>
          </div>
        </div>
      </section>
      <section className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6">
        <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Scale Engine</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          CAC/LTV er visningsproxy fra Control Tower — ikke full regnskaps-LTV uten churn-kilde.
        </p>
        <div className="mt-4 grid gap-3 text-sm text-[rgb(var(--lp-fg))] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-[rgb(var(--lp-muted))]">CAC (proxy)</div>
            <div className="font-medium tabular-nums">
              {scaleMetrics.cac == null
                ? "—"
                : `${scaleMetrics.cac.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr`}
            </div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">LTV (proxy)</div>
            <div className="font-medium tabular-nums">
              {scaleMetrics.ltv == null
                ? "—"
                : `${scaleMetrics.ltv.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr`}
            </div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Ad spend (uke)</div>
            <div className="font-medium tabular-nums">
              {scaleMetrics.spend.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr
            </div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Omsetning (uke)</div>
            <div className="font-medium tabular-nums">
              {scaleMetrics.revenue.toLocaleString("nb-NO", { maximumFractionDigits: 0 })} kr
            </div>
          </div>
        </div>
        {scaleMetrics.explain.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-[rgb(var(--lp-muted))]">
            {scaleMetrics.explain.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6">
        <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Market Domination</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Markedssignaler — strukturerte proxyer, ikke rå kopier av konkurrentinnhold.
        </p>
        <div className="mt-4 grid gap-3 text-sm text-[rgb(var(--lp-fg))] sm:grid-cols-3">
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Toppformat (proxy)</div>
            <div className="font-medium tabular-nums">{dominationMetrics.topFormat ?? "—"}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Beste innholdsscore (proxy)</div>
            <div className="font-medium tabular-nums">{dominationMetrics.best}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Byer aktive (proxy)</div>
            <div className="font-medium tabular-nums">{dominationMetrics.cities}</div>
          </div>
        </div>
        {dominationMetrics.explain.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-[rgb(var(--lp-muted))]">
            {dominationMetrics.explain.map((line, idx) => (
              <li key={`${idx}-${line}`}>{line}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <DominationStrategyPanel />
      <CategoryDominancePanel />
      <GoLiveEnginePanel />
      <section className="mb-10 rounded-2xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-6">
        <h2 className="font-heading text-lg font-semibold text-[rgb(var(--lp-fg))]">Platform Power</h2>
        <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
          Plattform- og økosystemindeks — aggregerte proxyer (GDPR-minimering).
        </p>
        <div className="mt-4 grid gap-3 text-sm text-[rgb(var(--lp-fg))] sm:grid-cols-3">
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Nettverksverdi (indeks)</div>
            <div className="font-medium tabular-nums">{platformMetrics.network.toLocaleString("nb-NO")}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Datapunkter (proxy)</div>
            <div className="font-medium tabular-nums">{platformMetrics.data.toLocaleString("nb-NO")}</div>
          </div>
          <div>
            <div className="text-[rgb(var(--lp-muted))]">Partnere (register)</div>
            <div className="font-medium tabular-nums">{platformMetrics.partners}</div>
          </div>
        </div>
        {platformMetrics.explain.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-[rgb(var(--lp-muted))]">
            {platformMetrics.explain.map((line, idx) => (
              <li key={`${idx}-${line}`}>{line}</li>
            ))}
          </ul>
        ) : null}
      </section>
      <ControlTowerClient initial={initial} />
    </main>
  );
}
