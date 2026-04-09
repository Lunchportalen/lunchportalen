import Link from "next/link";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { backofficeEntityActionPrimaryClass } from "@/components/backoffice/backofficeEntityActionStyles";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { listElementTypeDefinitions } from "@/lib/cms/schema/elementTypeDefinitions";

export const metadata = {
  title: "Element types — Innstillinger",
};

/**
 * U96 — Element Types (Umbraco-lignende): eksplisitt lag over block entries (content + settings + editor-identitet).
 */
export default function SettingsElementTypesCollectionPage() {
  const elements = listElementTypeDefinitions();
  const withSettings = elements.filter((e) => e.settingsSectionLabels.length > 0).length;

  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "element-types",
    title: "Element types",
    description:
      "Hver rad er en elementtype med samme alias som block entry. Innholdsmodell, settings-seksjoner og property editor-ruting er code-governed; data types refererer tillatte element-alias eksplisitt.",
    routeKind: "collection",
    signals: [
      {
        label: "Elementtyper",
        value: String(elements.length),
        description: "Registrerte block/element-definisjoner i CMS-kontrakten.",
      },
      {
        label: "Med settings-modell",
        value: String(withSettings),
        description: "Elementtyper med eksplisitte settings-seksjoner i skjemaet.",
      },
      {
        label: "Data type-kobling",
        value: "allowlist",
        description: "Block Editor Data Types bruker samme alias som element/block entry.",
      },
    ],
    primaryAction: {
      label: "Block Editor Data Types",
      href: "/backoffice/settings/block-editor-data-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Document types", href: "/backoffice/settings/document-types", look: "secondary" },
      { label: "Schema", href: "/backoffice/settings/schema", look: "outline" },
    ],
    relatedLinks: [{ label: "Content", href: "/backoffice/content", look: "outline" }],
    note: "Element types er code-governed (én sannhet i blockTypeDefinitions). Denne flaten er schema-arbeidsflate og endrer ikke runtime uten kode — i motsetning til Document Types og Block Editor Data Types med persisted overrides.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div
        className="flex items-center justify-between gap-3"
        data-lp-u96-element-types-overview
      >
        <Link href="/backoffice/settings" className="text-sm font-medium text-slate-900 underline underline-offset-4">
          ← Tilbake til innstillinger
        </Link>
      </div>
      <ul className="grid gap-4 lg:grid-cols-2">
        {elements
          .slice()
          .sort((a, b) => a.alias.localeCompare(b.alias, "nb"))
          .map((el) => (
            <li
              key={el.alias}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              data-lp-element-type-row={el.alias}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                    {el.alias}
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{el.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">{el.description}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/backoffice/settings/element-types/workspace/${encodeURIComponent(el.alias)}`}
                    className={backofficeEntityActionPrimaryClass}
                    data-lp-element-type-open-runtime-workspace={el.alias}
                  >
                    Runtime workspace
                  </Link>
                  <Link
                    href={`/backoffice/settings/element-types/${encodeURIComponent(el.alias)}`}
                    className="min-h-10 rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
                    data-lp-element-type-open={el.alias}
                  >
                    Kontrakt (les)
                  </Link>
                </div>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Property editor</dt>
                  <dd className="mt-1 font-mono text-xs text-slate-900">{el.propertyEditorComponent}</dd>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Canvas view</dt>
                  <dd className="mt-1 font-mono text-xs text-slate-900">{el.canvasViewComponent}</dd>
                </div>
              </dl>
            </li>
          ))}
      </ul>
    </BackofficeManagementWorkspaceFrame>
  );
}
