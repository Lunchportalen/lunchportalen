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
      <header className="border-b border-[rgb(var(--lp-border))]/70 pb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="lp-h1 text-[rgb(var(--lp-text))]">AI Control Center</h1>
            <p className="lp-lead mt-2">
              Governance, modulstatus og sporbarhet for AI-flater.
            </p>
          </div>
          <div className="lp-actions lg:justify-end" aria-label="AI Control status">
            <span className="lp-chip lp-chip-neutral">Kontroll & sikkerhet</span>
            <span className="lp-chip lp-chip-neutral">AI Center</span>
            <span className="lp-chip lp-chip-neutral">Styringsplan</span>
            <span className="lp-chip lp-chip-ok">Aktiv / Live</span>
          </div>
        </div>
      </header>

      <div className="mt-8 space-y-7">
        <AiGovernanceOverview />

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
          <AiGovernancePolicyPanel />
          <AiGovernanceSettingsPanel />
        </div>

        <AiGovernanceHumanAndCostPanel />

        <AiControlRunClient />

        <section>
          <div className="lp-section-head">
            <h2 className="lp-h2 text-[rgb(var(--lp-text))]">Hendelseslogg</h2>
            <p className="lp-muted mt-1 text-sm">Siste spor fra autonomikjøring, med RID og payload for revisjon.</p>
          </div>
          <ul className="divide-y divide-[rgb(var(--lp-divider))]/80 overflow-hidden rounded-[24px] border border-[rgb(var(--lp-border))]/85 bg-[rgba(var(--lp-surface-rgb),0.86)] shadow-[var(--lp-shadow-sm)]">
            {logs.length === 0 ? (
              <li className="px-5 py-7 text-sm text-[rgb(var(--lp-muted))]">Ingen rader ennå.</li>
            ) : (
              logs.map((row) => (
                <li key={row.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-black text-[rgb(var(--lp-text))]">{row.entry_type}</span>
                    <time className="text-xs text-[rgb(var(--lp-muted))]" dateTime={row.created_at}>
                      {row.created_at}
                    </time>
                  </div>
                  <p className="lp-rid mt-1">rid: {row.rid}</p>
                  <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-[rgb(var(--lp-surface-alt))] p-3 text-xs text-[rgb(var(--lp-text))]">
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
