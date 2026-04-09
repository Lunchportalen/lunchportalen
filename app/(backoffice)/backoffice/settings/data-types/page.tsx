import Link from "next/link";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { BellissimaEntityActionMenu } from "@/components/backoffice/BellissimaEntityActionMenu";
import { getFieldKindUsageSummaries } from "@/lib/cms/backofficeSchemaSettingsModel";
import { backofficeEntityActionPrimaryClass } from "@/components/backoffice/backofficeEntityActionStyles";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { workspaceActionLabel } from "@/lib/cms/backofficeWorkspaceContextModel";

export const metadata = {
  title: "Data types — Innstillinger",
};

/**
 * U29 — Collection view for property editor kinds (data type-lag).
 */
export default function SettingsDataTypesCollectionPage() {
  const kinds = getFieldKindUsageSummaries();
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "data-types",
    title: "Data types",
    description:
      "Property editor-kinds brukt i blokk-skjemaene. Hver rad åpner en detail-workspace med kontraktsrolle, workspace-kobling og related actions.",
    routeKind: "collection",
    signals: [
      {
        label: "Kinds",
        value: String(kinds.length),
        description: "Registrerte property editor-kinds i den aktive CMS-kontrakten.",
      },
      {
        label: "Workspace flow",
        value: "Kind → detail",
        description: "Hver kind åpner en detail-workspace i settings-seksjonen.",
      },
      {
        label: "Honesty",
        value: "Code-governed",
        description: "Disse data types speiler kode, ikke en separat persisted settings-motor.",
      },
    ],
    primaryAction: {
      label: "Åpne schema",
      href: "/backoffice/settings/schema",
      look: "primary",
    },
    secondaryActions: [
      { label: "Management read", href: "/backoffice/settings/management-read", look: "secondary" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
    ],
    relatedLinks: [
      { label: "Document types", href: "/backoffice/settings/document-types", look: "outline" },
      { label: "Create policy", href: "/backoffice/settings/create-policy", look: "outline" },
    ],
    note:
      "Data types er management-objects for property editor-kontrakter. Endring skjer fortsatt i kode og deploy, men arbeidsflyten i settings skal være like eksplisitt som for document types.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="flex items-center justify-between gap-3">
        <Link href="/backoffice/settings" className="text-sm font-medium text-slate-900 underline underline-offset-4">
          ← Tilbake til innstillinger
        </Link>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {kinds.map((k) => {
          const href = `/backoffice/settings/data-types/${encodeURIComponent(k.kind)}`;
          const actions = [
            {
              id: "edit" as const,
              label: workspaceActionLabel("edit"),
              enabled: true,
              placement: "entity" as const,
              href,
              description: "Åpne detail-workspace for denne data typen.",
            },
            {
              id: "schema" as const,
              label: workspaceActionLabel("schema"),
              enabled: true,
              placement: "entity" as const,
              href: "/backoffice/settings/schema",
              description: "Åpne samlet schema-read for denne kontrakten.",
            },
            {
              id: "management" as const,
              label: workspaceActionLabel("management"),
              enabled: true,
              placement: "entity" as const,
              href: "/backoffice/settings/management-read",
              description: "Åpne management-read og JSON-koblinger for denne data typen.",
            },
          ];
          return (
            <li key={k.kind} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-700">
                      {k.kind}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Code-governed</span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      {k.configuredInstanceCount} instanser
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{k.labelNb}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{k.contractRoleNb}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={href} className={backofficeEntityActionPrimaryClass}>
                    {workspaceActionLabel("edit")}
                  </Link>
                  <BellissimaEntityActionMenu
                    actions={actions}
                    summaryLabel="Handlinger"
                    buttonClassName="min-h-10 px-3 text-sm"
                  />
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Block types</dt>
                  <dd className="mt-1 text-slate-900">{k.blockTypes.length || 0}</dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Document types</dt>
                  <dd className="mt-1 text-slate-900">{k.documentTypeAliases.length || 0}</dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Presets</dt>
                  <dd className="mt-1 text-slate-900">{k.presetCount}</dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </BackofficeManagementWorkspaceFrame>
  );
}
