import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";

export const metadata = {
  title: "AI governance — Innstillinger",
};

export default function SettingsAiGovernancePage() {
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "ai-governance",
    title: "AI governance",
    description:
      "Styring av AI-posture, operatoransvar og sikre koblinger til AI Center, system-toggle og content workspaces. Ingen ny AI-orchestrator introduseres her.",
    routeKind: "workspace",
    signals: [
      {
        label: "Control plane",
        value: "AI Center",
        description: "Strategi, policy og operatorflyt eies fortsatt av eksisterende AI Center.",
      },
      {
        label: "Runtime toggle",
        value: "System & drift",
        description: "Runtime-nære AI-brytere og posture lever i eksisterende system-surface.",
      },
      {
        label: "Editorial linkage",
        value: "Content workspace",
        description: "Editor-AI, governance og review følger samme Bellissima workspace-host som resten av content.",
      },
    ],
    primaryAction: {
      label: "Åpne AI Center",
      href: "/backoffice/ai-control",
      look: "primary",
    },
    secondaryActions: [
      { label: "System & drift", href: "/backoffice/settings/system", look: "secondary" },
      { label: "Governance & bruk", href: "/backoffice/settings/governance-insights", look: "outline" },
    ],
    relatedLinks: [
      { label: "Content", href: "/backoffice/content", look: "outline" },
      { label: "Management read", href: "/backoffice/settings/management-read", look: "outline" },
      { label: "Runtime", href: "/backoffice/runtime", look: "outline" },
    ],
    note:
      "AI governance-workspacen samler policy og koblinger, men lar eksisterende kontrollflater eie faktisk runtime-atferd. Dette er management-read og safe routing, ikke en ny orkestreringsmotor.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <section className="grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Operatoransvar</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
            <li>AI-forslag skal forbli menneskegjennomgått før publisering.</li>
            <li>Ingen skjult publisering eller ny AI-motor innføres i denne fasen.</li>
            <li>Module posture må fortsatt være ærlig: LIVE, LIMITED, DRY_RUN, STUB eller INTERNAL_ONLY.</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Koblinger</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
            <li>`/backoffice/ai-control` er fortsatt kontrollsenteret for AI policy og arbeidsflyt.</li>
            <li>`/backoffice/settings/system` holder runtime-nære toggles og driftsinnstillinger.</li>
            <li>Content workspace bruker eksisterende AI surfaces, men nå under tydeligere shared workspace ownership.</li>
          </ul>
        </article>
      </section>
    </BackofficeManagementWorkspaceFrame>
  );
}
