export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AiGovernanceHumanAndCostPanel } from "@/components/backoffice/AiGovernanceHumanAndCostPanel";
import { AiGovernanceOverview } from "@/components/backoffice/AiGovernanceOverview";
import { AiGovernancePolicyPanel } from "@/components/backoffice/AiGovernancePolicyPanel";
import { AiGovernanceSettingsPanel } from "@/components/backoffice/AiGovernanceSettingsPanel";
import { PageContainer } from "@/components/layout/PageContainer";
import { fetchRecentAutonomyLogs } from "@/lib/ai/autonomy/autonomyLog";
import { AiControlRunClient } from "./AiControlRunClient";

function formatPayload(p: Record<string, unknown>): string {
  try {
    const s = JSON.stringify(p);
    return s.length > 420 ? `${s.slice(0, 420)}…` : s;
  } catch {
    return "—";
  }
}

export default async function AiControlTowerPage() {
  const logs = await fetchRecentAutonomyLogs(100);

  return (
    <PageContainer className="max-w-[1440px] py-8">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">AI Control Center</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        Governance, modulposture og sporbarhet — samme prinsipper som Umbraco AI (stabil CMS, fleksibel AI, menneskelig
        kontroll). Autonom kjøring under er begrenset og loggført; ingen skjult publisering.
      </p>

      <div className="mt-8 space-y-8">
        <AiGovernanceOverview />

        <AiGovernancePolicyPanel />

        <AiGovernanceSettingsPanel />

        <AiGovernanceHumanAndCostPanel />

        <AiControlRunClient />

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Hendelseslogg</h2>
          <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {logs.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500">Ingen rader ennå.</li>
            ) : (
              logs.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-slate-900">{row.entry_type}</span>
                    <time className="text-xs text-slate-500" dateTime={row.created_at}>
                      {row.created_at}
                    </time>
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">rid: {row.rid}</p>
                  <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words text-xs text-slate-700">
                    {formatPayload(row.payload)}
                  </pre>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </PageContainer>
  );
}
