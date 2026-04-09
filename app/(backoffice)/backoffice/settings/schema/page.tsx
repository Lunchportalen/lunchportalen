import Link from "next/link";
import {
  getDocumentTypeGovernanceSummaries,
  getFieldKindUsageSummaries,
  getPropertyEditorSystemModel,
} from "@/lib/cms/backofficeSchemaSettingsModel";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";

export const metadata = {
  title: "Dokumenttyper og data types — Innstillinger",
};

/**
 * U23 — Read-only schema governance (Umbraco document type / data type-paritet på UX-lag).
 */
export default function BackofficeSettingsSchemaPage() {
  const documentTypes = getDocumentTypeGovernanceSummaries();
  const fieldKinds = getFieldKindUsageSummaries();
  const propertyEditorSystem = getPropertyEditorSystemModel();
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "schema",
    title: "Schema og presets",
    description:
      "Samlet read-model for document types, configured instances, editor-UI og presets. Denne workspacen viser schema → configured instance → UI → preset som én management-sannhet, uten å late som en persisted type-database finnes.",
    routeKind: "workspace",
    signals: [
      {
        label: "Document types",
        value: String(documentTypes.length),
        description: "Kanoniske typer som styrer tree-policy, body-envelope og document-governance.",
      },
      {
        label: "Configured instances",
        value: String(propertyEditorSystem.configuredInstances.length),
        description: "Eksplisitte felter i property editor-systemet på tvers av blokktyper og document types.",
      },
      {
        label: "Coverage gaps",
        value: String(propertyEditorSystem.unsupportedCreateOptions.length),
        description: "Create options som ennå ikke har full schema-driven UI-dekning.",
      },
    ],
    primaryAction: {
      label: "Åpne document types",
      href: "/backoffice/settings/document-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Data types", href: "/backoffice/settings/data-types", look: "secondary" },
      { label: "Create policy", href: "/backoffice/settings/create-policy", look: "outline" },
    ],
    relatedLinks: [
      { label: "Management read", href: "/backoffice/settings/management-read", look: "outline" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
    ],
    note:
      "Schema/presets er fortsatt code-governed. Denne flaten skal være en first-class management read, ikke et falskt designerverktøy.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Systemmodell</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configured instances</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{propertyEditorSystem.configuredInstances.length}</p>
            <p className="mt-2 text-sm text-slate-600">
              Hvert felt i blokk-skjemaene er nå lesbart som en eksplisitt configured instance.
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">UI mappings</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{propertyEditorSystem.uiMappings.length}</p>
            <p className="mt-2 text-sm text-slate-600">
              SchemaDrivenBlockForm og FieldRenderer er koblet inn som navngitte UI-surfaces i modellen.
            </p>
          </article>
          <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Presets</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{propertyEditorSystem.presets.length}</p>
            <p className="mt-2 text-sm text-slate-600">
              Default-verdier vises som presets per blokk, knyttet tilbake til document types og field kinds.
            </p>
          </article>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Innholdstyper (document types)</h2>
        <p className="text-sm text-slate-600">
          Alias, tillatte barn og tillatte blokktyper styres av <code className="text-xs">contentDocumentTypes.ts</code>,
          men denne workspacen viser nå også configured instances, field kinds og UI-gap per document type.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Alias</th>
                <th className="px-3 py-2">Navn</th>
                <th className="px-3 py-2">Allowed blocks</th>
                <th className="px-3 py-2">Configured instances</th>
                <th className="px-3 py-2">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {documentTypes.map((dt) => (
                <tr key={dt.alias} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/backoffice/settings/document-types/${dt.alias}`} className="hover:text-slate-900">
                      {dt.alias}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{dt.name}</td>
                  <td className="max-w-[280px] px-3 py-2 text-slate-700">{dt.allowedBlockTypeCount}</td>
                  <td className="px-3 py-2 text-slate-700">{dt.configuredInstanceCount}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {dt.unsupportedBlockTypes.length > 0 ? `${dt.unsupportedBlockTypes.length} UI-gap` : "Full schema"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Felt-typer (data type / property editor kind)</h2>
        <p className="text-sm text-slate-600">
          Property editor-kinds leses nå som first-class management-objekter med instanser, presets og document-type-rekkevidde.
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Etikett</th>
                <th className="px-3 py-2">Instances</th>
                <th className="px-3 py-2">Presets</th>
                <th className="px-3 py-2">Document types</th>
              </tr>
            </thead>
            <tbody>
              {fieldKinds.map((row) => (
                <tr key={row.kind} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link href={`/backoffice/settings/data-types/${encodeURIComponent(row.kind)}`} className="hover:text-slate-900">
                      {row.kind}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.labelNb}</td>
                  <td className="px-3 py-2 text-slate-700">{row.configuredInstanceCount}</td>
                  <td className="px-3 py-2 text-slate-700">{row.presetCount}</td>
                  <td className="px-3 py-2 text-slate-700">{row.documentTypeAliases.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Coverage gaps</h2>
        <p className="text-sm text-slate-600">
          Disse create options finnes i editorens blokkvalg, men mangler fortsatt full schema-driven property-editor-dekning.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {propertyEditorSystem.unsupportedCreateOptions.map((gap) => (
            <li
              key={gap.id}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <div className="font-medium text-slate-900">{gap.blockLabel}</div>
              <div className="font-mono text-xs text-slate-500">{gap.blockType}</div>
              <div className="mt-1 text-xs text-slate-600">{gap.reasonNb}</div>
              <div className="mt-2 text-[11px] text-slate-500">
                Document types: {gap.documentTypeAliases.join(", ") || "Ingen registrert"}
              </div>
            </li>
          ))}
        </ul>
        {propertyEditorSystem.unsupportedCreateOptions.length === 0 ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-900">
            Ingen coverage gaps registrert i property editor-systemet.
          </p>
        ) : null}
      </section>
    </BackofficeManagementWorkspaceFrame>
  );
}
