import Link from "next/link";
import { notFound } from "next/navigation";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import {
  getFieldKindUsageSummaries,
  getPropertyEditorFlowForKind,
} from "@/lib/cms/backofficeSchemaSettingsModel";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";

type Props = { params: Promise<{ kind: string }> };

export async function generateMetadata({ params }: Props) {
  const { kind: raw } = await params;
  const kind = decodeURIComponent(raw);
  const row = getFieldKindUsageSummaries().find((k) => k.kind === kind);
  return { title: row ? `${row.labelNb} — Data type` : "Data type" };
}

export default async function SettingsDataTypeWorkspacePage({ params }: Props) {
  const { kind: raw } = await params;
  const kind = decodeURIComponent(raw);
  const row = getFieldKindUsageSummaries().find((k) => k.kind === kind);
  if (!row) notFound();
  const propertyFlow = getPropertyEditorFlowForKind(row.kind);
  const configuredInstances = propertyFlow?.configuredInstances ?? [];
  const presets = propertyFlow?.presets ?? [];
  const uiMappings = propertyFlow?.uiMappings ?? [];
  const relatedDocumentTypes = propertyFlow?.documentTypes ?? [];
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "data-types",
    title: row.labelNb,
    description: row.contractRoleNb,
    routeKind: "detail",
    signals: [
      {
        label: "Kind",
        value: row.kind,
        description: "Stabil kontraktnøkkel brukt i schema-governance.",
      },
      {
        label: "Configured instances",
        value: String(configuredInstances.length),
        description: "Antall schemafelter som bruker denne data typen i property editor-systemet.",
      },
      {
        label: "Document types",
        value: String(row.documentTypeAliases.length),
        description: "Document types som får denne data typen via blokkfeltene sine.",
      },
      {
        label: "UI mappings",
        value: String(uiMappings.length),
        description: "Editor-UI som eksplisitt støtter denne data typen.",
      },
    ],
    primaryAction: {
      label: "Åpne schema",
      href: "/backoffice/settings/schema",
      look: "primary",
    },
    secondaryActions: [
      { label: "Data types", href: "/backoffice/settings/data-types", look: "secondary" },
      { label: "Management read", href: "/backoffice/settings/management-read", look: "outline" },
    ],
    relatedLinks: [
      { label: "Document types", href: "/backoffice/settings/document-types", look: "outline" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
    ],
    note:
      "Denne data typen er fortsatt code-governed. Settings-workspacen gjør objektet eksplisitt og sporbar, men later ikke som persisted CRUD finnes.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings/data-types" className="hover:text-slate-900">
          ← Data types
        </Link>
      </nav>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        Kind: <code className="text-xs">{row.kind}</code>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Kontraktsrolle</h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">{row.contractRoleNb}</p>
          <p className="mt-4 text-sm text-slate-600">
            Implementasjon: <code className="text-xs">blockFieldSchemas.ts</code> +{" "}
            <code className="text-xs">SchemaDrivenBlockForm</code>.
          </p>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Block types</dt>
              <dd className="mt-1 text-slate-900">{row.blockTypes.length}</dd>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Presets</dt>
              <dd className="mt-1 text-slate-900">{presets.length}</dd>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">UI mapping</dt>
              <dd className="mt-1 text-slate-900">{uiMappings.map((mapping) => mapping.labelNb).join(", ") || "Ingen"}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Property editor flow</h2>
          <p className="mt-1 text-sm text-slate-600">
            Denne data typen er ikke bare en label. Den kobler schema, configured instances, editor-UI og document types.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">1. Schema</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{row.kind}</p>
              <p className="mt-1 text-sm text-slate-600">Feltkinden er kontraktnøkkelen som blokk-skjemaene peker på.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">2. Configured instances</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{configuredInstances.length} felt i bruk</p>
              <p className="mt-1 text-sm text-slate-600">Dette er de konkrete blokkfeltene som bruker data typen.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">3. Editor UI</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {uiMappings.length > 0 ? uiMappings.map((mapping) => mapping.labelNb).join(", ") : "Ingen UI-mapping"}
              </p>
              <p className="mt-1 text-sm text-slate-600">UI-mapping forteller hvor editoren faktisk renderer denne typen.</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">4. Management objects</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{relatedDocumentTypes.length} document types</p>
              <p className="mt-1 text-sm text-slate-600">Settings bruker disse koblingene som samme first-class flyt som content workspace leser.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Configured instances</h2>
          <p className="mt-1 text-sm text-slate-600">
            Felt som bruker <code className="text-xs">{row.kind}</code> som data type i dagens property editor-system.
          </p>
        </header>
        {configuredInstances.length > 0 ? (
          <div className="grid gap-3 p-4">
            {configuredInstances.map((instance) => (
              <article key={instance.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{instance.fieldLabel}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {instance.blockLabel} · <span className="font-mono">{instance.fieldKey}</span>
                    </p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                    {instance.required ? "Påkrevd" : "Valgfritt"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Default</p>
                    <p className="mt-1">{instance.defaultValueLabel ?? "Ingen"}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">UI mapping</p>
                    <p className="mt-1">{instance.uiLabelNb}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Document types</p>
                    <p className="mt-1">{instance.documentTypeAliases.join(", ") || "Ingen"}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="px-6 py-5 text-sm text-slate-600">Ingen configured instances bruker denne data typen enda.</p>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Document types</h2>
          <p className="mt-1 text-sm text-slate-600">
            Disse management-objektene får denne data typen gjennom blokk- og feltsammensetningen sin.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {relatedDocumentTypes.length > 0 ? (
              relatedDocumentTypes.map((documentType) => (
                <Link
                  key={documentType.alias}
                  href={`/backoffice/settings/document-types/${documentType.alias}`}
                  className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  {documentType.name}
                </Link>
              ))
            ) : (
              <span className="text-sm text-slate-500">Ingen document types registrert.</span>
            )}
          </div>
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Block coverage</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {row.blockTypes.map((blockType) => (
                <span
                  key={blockType}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                >
                  {blockType}
                </span>
              ))}
            </div>
          </div>
        </article>

        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Presets og UI</h2>
          <p className="mt-1 text-sm text-slate-600">
            Presets viser default-verdier som treffer denne data typen. UI-mapping viser hvor editoren faktisk rendres.
          </p>
          <div className="mt-4 space-y-3">
            {uiMappings.map((mapping) => (
              <div key={mapping.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-sm font-semibold text-slate-900">{mapping.labelNb}</p>
                <p className="mt-1 text-sm text-slate-600">{mapping.descriptionNb}</p>
              </div>
            ))}
            {uiMappings.length === 0 ? <p className="text-sm text-slate-500">Ingen UI-mapping registrert.</p> : null}
          </div>
          <div className="mt-5 space-y-3">
            {presets.length > 0 ? (
              presets.map((preset) => (
                <div key={preset.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">{preset.blockLabel}</p>
                    <span className="text-xs text-slate-500">{preset.defaultValueCount} defaults</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {preset.defaults.map((entry) => (
                      <span
                        key={`${preset.id}-${entry.key}`}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700"
                      >
                        {entry.key}: {entry.valueLabel}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">Ingen presets er knyttet til denne data typen enda.</p>
            )}
          </div>
        </article>
      </section>
    </BackofficeManagementWorkspaceFrame>
  );
}
