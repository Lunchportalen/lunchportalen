import Link from "next/link";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import {
  getDocumentTypeGovernanceSummaries,
  getFieldKindUsageSummaries,
  getPropertyEditorSystemModel,
} from "@/lib/cms/backofficeSchemaSettingsModel";
import {
  backofficeSettingsFlowLabel,
  backofficeSettingsObjectClassLabel,
  buildBackofficeManagementWorkspaceModel,
} from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { BACKOFFICE_SETTINGS_COLLECTIONS } from "@/lib/cms/backofficeExtensionRegistry";

export const metadata = {
  title: "Management read (code registry) — Innstillinger",
};

/**
 * U26 — Read-only management-paritet: samme sannhet som kode, uten CRUD eller ny API-plattform.
 */
export default function BackofficeSettingsManagementReadPage() {
  const documentTypes = getDocumentTypeGovernanceSummaries();
  const fieldKinds = getFieldKindUsageSummaries();
  const propertyEditorSystem = getPropertyEditorSystemModel();
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "management-read",
    title: "Management read (code registry)",
    description:
      "Speiler management-objektene som lesing fra kode og registries. Denne workspacen viser hvilke collections som finnes, hvordan de flyter, og hva governance-registry faktisk eksponerer.",
    routeKind: "workspace",
    signals: [
      {
        label: "Collections",
        value: String(BACKOFFICE_SETTINGS_COLLECTIONS.length),
        description: "Førsteordens settings collections med eksplisitt object class og flow-kind.",
      },
      {
        label: "Configured instances",
        value: String(propertyEditorSystem.configuredInstances.length),
        description: "Property editor-systemet eksponeres nå som lesbar management-model.",
      },
      {
        label: "JSON endpoint",
        value: "/api/backoffice/content/governance-registry",
        description: "Samler document types, data types, presets og propertyEditorSystem i ett read-only payload.",
      },
    ],
    primaryAction: {
      label: "Åpne JSON-endepunkt",
      href: "/api/backoffice/content/governance-registry",
      look: "primary",
    },
    secondaryActions: [
      { label: "Schema", href: "/backoffice/settings/schema", look: "secondary" },
      { label: "Document types", href: "/backoffice/settings/document-types", look: "outline" },
    ],
    relatedLinks: [
      { label: "Data types", href: "/backoffice/settings/data-types", look: "outline" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
    ],
    note:
      "Dette er en management-read workspace. Den skal være sterk på sporbarhet og kobling til kildene, men forblir read-only.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <nav className="text-sm">
        <Link href="/backoffice/settings" className="text-slate-600 hover:text-slate-900">
          ← Innstillinger
        </Link>
      </nav>
      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-800">
        <h2 className="font-medium text-slate-900">Collections og flyt</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-white text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2">Collection</th>
                <th className="px-3 py-2">Object class</th>
                <th className="px-3 py-2">Flow</th>
                <th className="px-3 py-2">Href</th>
              </tr>
            </thead>
            <tbody>
              {BACKOFFICE_SETTINGS_COLLECTIONS.map((collection) => (
                <tr key={collection.id} className="border-t border-slate-200/80">
                  <td className="px-3 py-2 font-medium text-slate-900">{collection.label}</td>
                  <td className="px-3 py-2 text-slate-700">{backofficeSettingsObjectClassLabel(collection.objectClass)}</td>
                  <td className="px-3 py-2 text-slate-700">{backofficeSettingsFlowLabel(collection.flowKind)}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{collection.href}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-800">
        <h2 className="font-medium text-slate-900">Registry payload</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Document types</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{documentTypes.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Data types</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{fieldKinds.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Presets</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{propertyEditorSystem.presets.length}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">UI mappings</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{propertyEditorSystem.uiMappings.length}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          JSON-endepunktet returnerer fortsatt locked API-kontrakt med <code className="text-xs">{"{ ok, rid, data }"}</code>,
          men <code className="text-xs">data</code> inneholder nå også <code className="text-xs">propertyEditorSystem</code>.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-800">
        <h2 className="font-medium text-slate-900">Kildesporing</h2>
        <ul className="mt-2 space-y-2 text-sm text-slate-700">
          <li>
            <code className="text-xs">lib/cms/contentDocumentTypes.ts</code> eier document types og tree/create-policy.
          </li>
          <li>
            <code className="text-xs">blockFieldSchemas.ts</code> + <code className="text-xs">SchemaDrivenBlockForm.tsx</code>{" "}
            eier property editor-schema og UI-dekning.
          </li>
          <li>
            <Link href="/backoffice/settings/schema" className="font-medium text-slate-900 underline underline-offset-4">
              Schema og presets
            </Link>{" "}
            viser relasjonene mellom disse kildene som én samlet management-workspace.
          </li>
        </ul>
      </section>
    </BackofficeManagementWorkspaceFrame>
  );
}
