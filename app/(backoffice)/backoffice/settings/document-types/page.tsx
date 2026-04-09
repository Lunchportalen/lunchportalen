import Link from "next/link";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { BellissimaEntityActionMenu } from "@/components/backoffice/BellissimaEntityActionMenu";
import { backofficeEntityActionPrimaryClass } from "@/components/backoffice/backofficeEntityActionStyles";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { getDocumentTypeGovernanceSummaries } from "@/lib/cms/backofficeSchemaSettingsModel";
import { workspaceActionLabel } from "@/lib/cms/backofficeWorkspaceContextModel";

export const metadata = {
  title: "Document types — Innstillinger",
};

/**
 * U29 — Collection view: én rad per dokumenttype (Umbraco-lignende liste).
 */
export default function SettingsDocumentTypesCollectionPage() {
  const documentTypes = getDocumentTypeGovernanceSummaries();
  const governedCount = documentTypes.filter((dt) => dt.allowedBlockTypeCount > 0).length;
  const treePolicyCount = documentTypes.filter((dt) => (dt.allowedChildTypes?.length ?? 0) > 0).length;
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "document-types",
    title: "Document types",
    description:
      "Collection for den kanoniske typemodellen. Hver type åpner egen workspace med tree-policy, envelope-posture og blokkallowlist.",
    routeKind: "collection",
    signals: [
      {
        label: "Typer",
        value: String(documentTypes.length),
        description: "Registrerte dokumenttyper i den aktive CMS-kontrakten.",
      },
      {
        label: "Governed body",
        value: String(governedCount),
        description: "Typer med eksplisitt blokkallowlist for innholdsbody.",
      },
      {
        label: "Tree policy",
        value: String(treePolicyCount),
        description: "Typer med eksplisitt policy for tillatte undernoder.",
      },
    ],
    primaryAction: {
      label: "Åpne content",
      href: "/backoffice/content",
      look: "primary",
    },
    secondaryActions: [
      { label: "Create policy", href: "/backoffice/settings/create-policy", look: "secondary" },
      { label: "Compositions", href: "/backoffice/settings/compositions", look: "secondary" },
      { label: "Schema", href: "/backoffice/settings/schema", look: "outline" },
    ],
    relatedLinks: [
      { label: "Management read", href: "/backoffice/settings/management-read", look: "outline" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
    ],
    note:
      "Les-only detail viser code-governed policy. For persisted Document Type / Property Type (tabs, titler, Data Type-binding) bruk «Schema workspace (runtime)» på hver type.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div
        className="flex items-center justify-between gap-3"
        data-lp-u96-document-types-overview
      >
        <Link href="/backoffice/settings" className="text-sm font-medium text-slate-900 underline underline-offset-4">
          ← Tilbake til innstillinger
        </Link>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {documentTypes.map((dt) => {
          const actions = [
            {
              id: "document_type_runtime" as const,
              label: "Schema workspace (runtime)",
              enabled: true,
              placement: "entity" as const,
              href: `/backoffice/settings/document-types/workspace/${encodeURIComponent(dt.alias)}`,
              description: "Rediger document type, grupper og property → Data Type (persistert).",
            },
            {
              id: "edit" as const,
              label: workspaceActionLabel("edit"),
              enabled: true,
              placement: "entity" as const,
              href: `/backoffice/settings/document-types/${encodeURIComponent(dt.alias)}`,
              description: "Åpne detail-workspace for denne dokumenttypen.",
            },
            {
              id: "schema" as const,
              label: workspaceActionLabel("schema"),
              enabled: true,
              placement: "entity" as const,
              href: "/backoffice/settings/schema",
              description: "Åpne property editor-systemet og schema-read.",
            },
            {
              id: "settings" as const,
              label: "Innstillinger",
              enabled: true,
              placement: "entity" as const,
              href: "/backoffice/settings/create-policy",
              description: "Åpne create policy og tree-governance.",
            },
            {
              id: "management" as const,
              label: workspaceActionLabel("management"),
              enabled: true,
              placement: "entity" as const,
              href: "/backoffice/settings/management-read",
              description: "Åpne management-read og JSON-koblinger for denne typen.",
            },
          ];

          return (
            <li key={dt.alias} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                      {dt.alias}
                    </span>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Code-governed</span>
                    {dt.unsupportedBlockTypes.length > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
                        UI-gap
                      </span>
                    ) : null}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{dt.name}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {dt.description ?? "Kanonisk dokumenttype i den aktive CMS-modellen."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/backoffice/settings/document-types/workspace/${encodeURIComponent(dt.alias)}`}
                    className={backofficeEntityActionPrimaryClass}
                    data-lp-document-type-open-runtime-workspace={dt.alias}
                  >
                    Schema workspace (runtime)
                  </Link>
                  <Link
                    href={`/backoffice/settings/document-types/${encodeURIComponent(dt.alias)}`}
                    className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    {workspaceActionLabel("edit")}
                  </Link>
                  <BellissimaEntityActionMenu
                    actions={actions}
                    summaryLabel="Handlinger"
                    buttonClassName="min-h-10 px-3 text-sm"
                  />
                </div>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tillatte barn</dt>
                  <dd className="mt-1 text-slate-900">
                    {dt.allowedChildTypes?.length ? dt.allowedChildTypes.join(", ") : "Ingen eksplisitt policy"}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Field kinds</dt>
                  <dd className="mt-1 text-slate-900">
                    {dt.fieldKinds.length ? dt.fieldKinds.join(", ") : "Ingen schema-driven felt ennå"}
                  </dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Configured instances</dt>
                  <dd className="mt-1 text-slate-900">{dt.configuredInstanceCount}</dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Schema coverage</dt>
                  <dd className="mt-1 text-slate-900">
                    {dt.unsupportedBlockTypes.length > 0
                      ? `${dt.unsupportedBlockTypes.length} blokktype(r) uten schema-driven UI`
                      : "Collection -> detail -> schema"}
                  </dd>
                </div>
              </dl>

              {dt.workspaceHint ? (
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{dt.workspaceHint}</p>
              ) : null}
              {dt.unsupportedBlockTypes.length > 0 ? (
                <p className="mt-3 text-sm text-amber-900">
                  Mangler schema-driven UI for: <code className="text-xs">{dt.unsupportedBlockTypes.join(", ")}</code>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </BackofficeManagementWorkspaceFrame>
  );
}
