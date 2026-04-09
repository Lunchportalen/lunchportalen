import Link from "next/link";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import {
  getDocumentTypeGovernanceSummaries,
  getPropertyEditorCoverageGaps,
} from "@/lib/cms/backofficeSchemaSettingsModel";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";

export const metadata = {
  title: "Create policy — Innstillinger",
};

/**
 * U29 — Førsteordens styringsflate for create restrictions og allowlist (read-only, code-sannhet).
 */
export default function SettingsCreatePolicyWorkspacePage() {
  const documentTypes = getDocumentTypeGovernanceSummaries();
  const coverageGaps = getPropertyEditorCoverageGaps();
  const fullyCoveredDocumentTypes = documentTypes.filter((documentType) => documentType.unsupportedBlockTypes.length === 0).length;
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "create-policy",
    title: "Create policy & innholdsfiltre",
    description:
      "Hvor create-valg lever i tre, hvordan blokktyper filtreres, og hvor server håndhever allowlist når envelope har documentType.",
    routeKind: "workspace",
    signals: [
      {
        label: "Tree policy",
        value: String(documentTypes.length),
        description: "Document types eier forelder → barn-reglene som content tree og create-panel følger.",
      },
      {
        label: "Body allowlist",
        value: `${fullyCoveredDocumentTypes}/${documentTypes.length}`,
        description: "Document types med full schema-dekning på blokkallowlisten sin.",
      },
      {
        label: "Posture",
        value: "Code-governed",
        description: "Full persisted policy-designer er fortsatt en replatforming-gap.",
      },
    ],
    primaryAction: {
      label: "Åpne document types",
      href: "/backoffice/settings/document-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Content", href: "/backoffice/content", look: "secondary" },
      { label: "Schema", href: "/backoffice/settings/schema", look: "outline" },
    ],
    relatedLinks: [
      { label: "Governance & bruk", href: "/backoffice/settings/governance-insights", look: "outline" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
    ],
    note:
      "Create policy er en management workspace for å gjøre policy eksplisitt og sporbar. Persisted type-filters i database er fortsatt en replatforming-gap, ikke noe UI-et later som finnes.",
  });
  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Tre / nye sider</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
            <li>
              <strong>Opprett-panel</strong> i Content-workspace: viser kun{" "}
              <code className="text-xs">allowedChildTypes</code> fra forelder/API.
            </li>
            <li>
              Tom liste betyr at du må velge en forelder som tillater barn, eller at konfigurasjon mangler.
            </li>
            <li>
              <Link className="font-medium text-slate-900 underline" href="/backoffice/settings/document-types">
                Document types
              </Link>{" "}
              definerer tillatte barn.
            </li>
          </ul>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Blokker i side (U24)</h2>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-slate-700">
            <li>
              <code className="text-xs">PATCH /api/backoffice/content/pages/[id]</code> validerer{" "}
              <code className="text-xs">block.type</code> mot dokumenttypens{" "}
              <code className="text-xs">allowedBlockTypes</code>.
            </li>
            <li>
              «Legg til blokk» og hurtigplukker filtrerer mot samme liste i editoren.
            </li>
            <li>
              Legacy uten <code className="text-xs">documentType</code> håndhever <strong>ikke</strong> allowlist —
              bruk governance-insights eller batch-normalisering.
            </li>
          </ul>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Document type create policy</h2>
          <p className="mt-1 text-sm text-slate-600">
            Samlet lesing av child-policy og body allowlist per document type. Dette er create-policy som management-read, ikke en ny designer.
          </p>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Document type</th>
                <th className="px-4 py-3">Allowed children</th>
                <th className="px-4 py-3">Allowed blocks</th>
                <th className="px-4 py-3">Configured instances</th>
                <th className="px-4 py-3">Coverage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documentTypes.map((documentType) => (
                <tr key={documentType.alias} className="align-top">
                  <td className="px-4 py-3">
                    <Link
                      href={`/backoffice/settings/document-types/${documentType.alias}`}
                      className="font-medium text-slate-900 hover:text-slate-700"
                    >
                      {documentType.name}
                    </Link>
                    <div className="mt-1 font-mono text-[11px] text-slate-500">{documentType.alias}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {documentType.allowedChildTypes?.length ? documentType.allowedChildTypes.join(", ") : "Ingen"}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{documentType.allowedBlockTypeCount}</td>
                  <td className="px-4 py-3 text-slate-700">{documentType.configuredInstanceCount}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {documentType.unsupportedBlockTypes.length > 0
                      ? `${documentType.unsupportedBlockTypes.length} gap`
                      : "Full schema"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-950">
        <h2 className="font-medium">Replattformering</h2>
        <p className="mt-1">
          Full Umbraco-lignende redigerbare content type filters i database krever replatforming — se{" "}
          <code className="text-xs">docs/umbraco-parity/U25_REPLATFORMING_GAPS.md</code>.
        </p>
        {coverageGaps.length > 0 ? (
          <p className="mt-2">
            Åpne coverage gaps i <Link href="/backoffice/settings/schema" className="font-medium underline">schema-workspacen</Link> før policyen kan hevde full form-paritet.
          </p>
        ) : null}
      </section>
    </BackofficeManagementWorkspaceFrame>
  );
}
