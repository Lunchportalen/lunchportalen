import Link from "next/link";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { backofficeEntityActionPrimaryClass } from "@/components/backoffice/backofficeEntityActionStyles";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { getMergedCompositionDefinitionsRecord } from "@/lib/cms/schema/compositionDefinitionMerged.server";

export const metadata = {
  title: "Compositions — Innstillinger",
};

export default function SettingsCompositionsCollectionPage() {
  const compositions = Object.values(getMergedCompositionDefinitionsRecord());
  const propertyCount = compositions.reduce((sum, c) => sum + c.properties.length, 0);
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "compositions",
    title: "Compositions",
    description: "Gjenbrukbare metadata- og feltsamlinger som injiseres i document types.",
    routeKind: "collection",
    signals: [
      { label: "Compositions", value: String(compositions.length), description: "Aktive composition-definisjoner." },
      { label: "Shared fields", value: String(propertyCount), description: "Totalt antall delte properties." },
      {
        label: "Posture",
        value: "Runtime managed",
        description: "Metadata kan redigeres i workspace og persisteres til settings.",
      },
    ],
    primaryAction: { label: "Åpne document types", href: "/backoffice/settings/document-types", look: "primary" },
    secondaryActions: [{ label: "Schema", href: "/backoffice/settings/schema", look: "secondary" }],
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="flex items-center justify-between gap-3">
        <Link href="/backoffice/settings" className="text-sm font-medium text-slate-900 underline underline-offset-4">
          ← Tilbake til innstillinger
        </Link>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2" data-lp-compositions-overview>
        {compositions.map((c) => (
          <li key={c.alias} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] text-slate-500">{c.alias}</p>
                <h2 className="text-lg font-semibold text-slate-900">{c.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{c.description}</p>
              </div>
              <Link
                href={`/backoffice/settings/compositions/workspace/${encodeURIComponent(c.alias)}`}
                className={backofficeEntityActionPrimaryClass}
              >
                Workspace
              </Link>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Grupper</dt>
                <dd className="mt-1 text-slate-900">{c.groups.length}</dd>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Properties</dt>
                <dd className="mt-1 text-slate-900">{c.properties.length}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </BackofficeManagementWorkspaceFrame>
  );
}
