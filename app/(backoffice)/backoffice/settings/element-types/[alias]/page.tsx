import Link from "next/link";
import { notFound } from "next/navigation";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { getElementTypeDefinition } from "@/lib/cms/schema/elementTypeDefinitions";

type Props = { params: Promise<{ alias: string }> };

export async function generateMetadata({ params }: Props) {
  const { alias } = await params;
  const el = getElementTypeDefinition(decodeURIComponent(alias));
  return { title: el ? `${el.title} — Element type` : "Element type" };
}

/**
 * U96 — Element type detail (code-sannhet): felter, settings-modell og editor-identitet.
 */
export default async function SettingsElementTypeDetailPage({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw).trim();
  const el = getElementTypeDefinition(alias);
  if (!el) notFound();

  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "element-types",
    title: el.title,
    description: el.description,
    routeKind: "detail",
    signals: [
      { label: "Alias", value: el.alias, description: "Samme nøkkel som block entry og data type allowlist." },
      {
        label: "Content-felt",
        value: String(el.fieldRefs.filter((f) => f.layer === "content").length),
        description: "Felter i innholdsmodellen.",
      },
      {
        label: "Settings-seksjoner",
        value: String(el.settingsSectionLabels.length),
        description: "Eksplisitte settings-grupper i skjemaet.",
      },
    ],
    primaryAction: {
      label: "Alle element types",
      href: "/backoffice/settings/element-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Block Editor Data Types", href: "/backoffice/settings/block-editor-data-types", look: "secondary" },
    ],
    relatedLinks: [{ label: "Document types (runtime)", href: "/backoffice/settings/document-types", look: "outline" }],
    note: "Endringer i elementtypen krever kode (blockTypeDefinitions). Data types styrer hvilke element-alias som er tillatt per property.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings/element-types" className="hover:text-slate-900">
          ← Element types
        </Link>
      </nav>

      <div
        className="mt-4 space-y-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        data-lp-element-type-detail={alias}
        data-lp-element-type-alias={alias}
      >
        <header>
          <p className="font-mono text-[11px] text-slate-500">{el.alias}</p>
          <h2 className="text-lg font-semibold text-slate-900">Kontrakt og felter</h2>
          <p className="mt-2 text-sm text-slate-600">{el.shortTitle}</p>
        </header>

        <section>
          <h2 className="text-sm font-semibold text-slate-900">Editor-kontrakt</h2>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <dt className="text-[11px] font-semibold uppercase text-slate-500">Property editor</dt>
              <dd className="mt-1 font-mono text-xs">{el.propertyEditorComponent}</dd>
            </div>
            <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
              <dt className="text-[11px] font-semibold uppercase text-slate-500">Custom view</dt>
              <dd className="mt-1 font-mono text-xs">{el.canvasViewComponent}</dd>
            </div>
          </dl>
        </section>

        <section data-lp-element-type-content-fields>
          <h2 className="text-sm font-semibold text-slate-900">Innholdsfelt</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {el.fieldRefs
              .filter((f) => f.layer === "content")
              .map((f) => (
                <li key={f.key} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <span className="font-medium text-slate-900">{f.label}</span>{" "}
                  <span className="font-mono text-xs text-slate-500">{f.key}</span> · {f.kind}
                </li>
              ))}
          </ul>
        </section>

        <section data-lp-element-type-settings-model>
          <h2 className="text-sm font-semibold text-slate-900">Settings-modell</h2>
          <p className="mt-2 text-sm text-slate-600">
            Seksjoner: {el.settingsSectionLabels.length ? el.settingsSectionLabels.join(", ") : "Ingen eksplisitte seksjoner"}
          </p>
        </section>

        {el.validationRuleIds.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Validering</h2>
            <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
              {el.validationRuleIds.map((id) => (
                <li key={id} className="font-mono text-xs">
                  {id}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </BackofficeManagementWorkspaceFrame>
  );
}
