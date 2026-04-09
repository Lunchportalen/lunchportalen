import Link from "next/link";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { Icon } from "@/components/ui/Icon";
import {
  backofficeSettingsHonestyLabel,
  backofficeSettingsKindLabel,
  buildBackofficeManagementWorkspaceModel,
} from "@/lib/cms/backofficeSettingsWorkspaceModel";
import {
  getDocumentTypeGovernanceSummaries,
  getFieldKindUsageSummaries,
  getPropertyEditorSystemModel,
} from "@/lib/cms/backofficeSchemaSettingsModel";
import { BACKOFFICE_SETTINGS_COLLECTIONS } from "@/lib/cms/backofficeExtensionRegistry";

export default function BackofficeSettingsHubPage() {
  const propertyEditorSystem = getPropertyEditorSystemModel();
  const documentTypeCount = getDocumentTypeGovernanceSummaries().length;
  const dataTypeCount = getFieldKindUsageSummaries().length;
  const configuredInstanceCount = propertyEditorSystem.configuredInstances.length;
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "overview",
    title: "Innstillinger",
    description:
      "Førsteordens management-seksjon for document types, data types, schema/configured instances, create policy, AI governance og systemnære settings-flater.",
    routeKind: "overview",
    signals: [
      {
        label: "Document types",
        value: String(documentTypeCount),
        description: "Kanoniske typer som styrer tree-policy, body-envelope og blokkgovnering.",
      },
      {
        label: "Data types",
        value: String(dataTypeCount),
        description: "Property editor-kinds med eksplisitt usage, UI-kobling og presets.",
      },
      {
        label: "Configured instances",
        value: String(configuredInstanceCount),
        description: "Block-field registreringer der schema, UI og defaults faktisk møtes.",
      },
    ],
    primaryAction: {
      label: "Åpne document types",
      href: "/backoffice/settings/document-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Compositions", href: "/backoffice/settings/compositions", look: "secondary" },
      { label: "Data types", href: "/backoffice/settings/data-types", look: "secondary" },
      { label: "Create policy", href: "/backoffice/settings/create-policy", look: "outline" },
    ],
    relatedLinks: [
      { label: "Schema og presets", href: "/backoffice/settings/schema", look: "outline" },
      { label: "Governance & bruk", href: "/backoffice/settings/governance-insights", look: "outline" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
      { label: "System & drift", href: "/backoffice/settings/system", look: "outline" },
    ],
    note:
      "Settings eier management objects og control-plane-lesing. Kode-styrt sannhet er fortsatt lovlig, men skal fremstå som first-class objekter i UI med eksplisitt schema -> configured instance -> UI -> preset-flyt.",
  });
  const cards = BACKOFFICE_SETTINGS_COLLECTIONS.filter((item) => item.id !== "overview").map((item) => ({
    href: item.href,
    title: item.label,
    body: item.description,
    icon:
      item.id === "document-types"
        ? ("template" as const)
        : item.id === "element-types"
          ? ("form" as const)
          : item.id === "data-types"
          ? ("content" as const)
          : item.id === "create-policy"
            ? ("form" as const)
            : item.id === "ai-governance"
              ? ("ai" as const)
              : item.id === "system"
                ? ("company" as const)
                : ("shield" as const),
    honesty: backofficeSettingsHonestyLabel(item.honesty),
    kind: backofficeSettingsKindLabel(item.kind),
  }));

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <ul className="grid gap-5 sm:grid-cols-2">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="lp-motion-card group flex h-full min-h-[170px] flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-800 group-hover:border-pink-300/40">
                  <Icon name={card.icon} size="md" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-slate-900">{card.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{card.body}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                  {card.kind}
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-slate-700">
                  {card.honesty}
                </span>
              </div>
              <span className="mt-6 text-sm font-semibold text-slate-900">Åpne management object →</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Collection til workspace</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Hver arbeidsflate skal kunne nås som et tydelig management object: collection, detail workspace, property-editor system workspace eller runtime-read workspace.
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <li>
              <Link href="/backoffice/settings/compositions" className="font-medium text-slate-900 underline underline-offset-4">
                Compositions
              </Link>
            </li>
            <li>
              <Link href="/backoffice/settings/document-types" className="font-medium text-slate-900 underline underline-offset-4">
                Document types
              </Link>
            </li>
            <li>
              <Link href="/backoffice/settings/element-types" className="font-medium text-slate-900 underline underline-offset-4">
                Element types
              </Link>
            </li>
            <li>
              <Link href="/backoffice/settings/data-types" className="font-medium text-slate-900 underline underline-offset-4">
                Data types
              </Link>
            </li>
            <li>
              <Link href="/backoffice/settings/schema" className="font-medium text-slate-900 underline underline-offset-4">
                Schema og presets
              </Link>
            </li>
            <li>
              <Link href="/backoffice/settings/create-policy" className="font-medium text-slate-900 underline underline-offset-4">
                Create policy
              </Link>
            </li>
            <li>
              <Link
                href="/backoffice/settings/management-read"
                className="font-medium text-slate-900 underline underline-offset-4"
              >
                Management read
              </Link>
            </li>
            <li>
              <Link href="/backoffice/settings/ai-governance" className="font-medium text-slate-900 underline underline-offset-4">
                AI governance
              </Link>
            </li>
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Section posture</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Settings er styringsplanet. Runtime, auth og transaksjonell sannhet eies fortsatt av operativ runtime, men kobles hit med ærlig språk og trygge lenker.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Truth model</dt>
              <dd className="mt-1 text-slate-900">
                Kode-styrt registry, eksplisitt property-editor systemmodell og runtime-lesing der nødvendig
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">CRUD posture</dt>
              <dd className="mt-1 text-slate-900">Ingen falsk CRUD. Mutasjoner vises bare der backend og kontrakt faktisk tillater det.</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Primary workflow</dt>
              <dd className="mt-1 text-slate-900">Oversikt → collection → detail/workspace → trygg runtime-ruting ved behov</dd>
            </div>
          </dl>
        </article>
      </section>
    </BackofficeManagementWorkspaceFrame>
  );
}
