import Link from "next/link";
import { notFound } from "next/navigation";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { getDocType } from "@/lib/cms/contentDocumentTypes";
import {
  getPropertyEditorFlowForDocumentType,
} from "@/lib/cms/backofficeSchemaSettingsModel";

type Props = { params: Promise<{ alias: string }> };

export async function generateMetadata({ params }: Props) {
  const { alias } = await params;
  const dt = getDocType(decodeURIComponent(alias));
  return { title: dt ? `${dt.name} — Document type` : "Document type" };
}

/**
 * U29 — Document type detail workspace (read-only, code-sannhet).
 */
export default async function SettingsDocumentTypeWorkspacePage({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw);
  const dt = getDocType(alias);
  if (!dt) notFound();

  const propertyFlow = getPropertyEditorFlowForDocumentType(alias);
  const summary = propertyFlow?.documentType ?? null;
  const configuredInstances = propertyFlow?.configuredInstances ?? [];
  const presets = propertyFlow?.presets ?? [];
  const coverageGaps = propertyFlow?.coverageGaps ?? [];
  const uiMappings = propertyFlow?.uiMappings ?? [];
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "document-types",
    title: dt.name,
    description: dt.description ?? "Kanonisk dokumenttype i content-seksjonen.",
    routeKind: "detail",
    signals: [
      {
        label: "Tillatte barn",
        value: String(dt.allowedChildTypes?.length ?? 0),
        description:
          dt.allowedChildTypes?.length
            ? dt.allowedChildTypes.join(", ")
            : "Ingen eksplisitte child-typer definert.",
      },
      {
        label: "Configured instances",
        value: String(configuredInstances.length),
        description:
          configuredInstances.length > 0
            ? "Schema-driven felt koblet til denne dokumenttypen."
            : "Ingen schema-driven blokkfelt registrert for denne typen ennå.",
      },
      {
        label: "Posture",
        value: "Code-governed workspace",
        description:
          "Runtime leser denne typen gjennom content envelope og tree-policy, ikke via separat CRUD.",
      },
      {
        label: "Coverage gaps",
        value: String(coverageGaps.length),
        description:
          coverageGaps.length > 0
            ? "Create options som mangler schema-driven editorflatespor."
            : "Ingen kjente schema-driven coverage gaps for denne typen.",
      },
    ],
    primaryAction: {
      label: "Åpne content",
      href: "/backoffice/content",
      look: "primary",
    },
    secondaryActions: [
      {
        label: "Schema workspace (runtime)",
        href: `/backoffice/settings/document-types/workspace/${encodeURIComponent(alias)}`,
        look: "secondary",
      },
      { label: "Document types", href: "/backoffice/settings/document-types", look: "outline" },
      { label: "Create policy", href: "/backoffice/settings/create-policy", look: "outline" },
    ],
    relatedLinks: [
      { label: "Schema", href: "/backoffice/settings/schema", look: "outline" },
      { label: "Data types", href: "/backoffice/settings/data-types", look: "outline" },
      { label: "Management read", href: "/backoffice/settings/management-read", look: "outline" },
      { label: "AI governance", href: "/backoffice/settings/ai-governance", look: "outline" },
    ],
    note:
      "Dette er les-only code-governed oversikt. Persisterte titler, grupper og property → Data Type redigeres i «Schema workspace (runtime)».",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <nav className="text-sm text-slate-600">
        <Link href="/backoffice/settings/document-types" className="hover:text-slate-900">
          ← Document types
        </Link>
      </nav>
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
        Alias: <code className="text-xs">{dt.alias}</code>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Management flow</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Denne arbeidsflaten gjør document type-objektet lesbart som samme styringskjede editoren bruker:
            schema, configured instances, editor-UI og defaults.
          </p>
          <div className="mt-4 grid gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">1. Document type</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{dt.name}</p>
              <p className="mt-1 text-sm text-slate-600">
                Tillater {dt.allowedChildTypes?.length ?? 0} child-typer og{" "}
                {summary?.allowedBlockTypeCount ?? dt.allowedBlockTypes?.length ?? 0} blokktyper i envelope-governance.
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">2. Configured instances</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{configuredInstances.length} feltbindinger</p>
              <p className="mt-1 text-sm text-slate-600">
                Schemafelter knytter blokk- og feltkontrakter til data types for akkurat denne dokumenttypen.
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">3. Editor UI</p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {uiMappings.length > 0 ? uiMappings.map((mapping) => mapping.labelNb).join(", ") : "Ingen UI-mapping"}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Content workspace viser disse feltene gjennom samme schema-drevne editorflate som settings forklarer.
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">4. Presets / defaults</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{presets.length} preset-kilder</p>
              <p className="mt-1 text-sm text-slate-600">
                Defaults følger create-flyten og viser hvilke startverdier editoren faktisk arver.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Tree og create policy</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Opprett under-node i content-treet respekterer <code className="text-xs">allowedChildTypes</code> når denne
            dokumenttypen er aktiv.
          </p>
          <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-700">
            <li>
              <strong>Tillatte barn:</strong>{" "}
              {dt.allowedChildTypes?.length ? dt.allowedChildTypes.join(", ") : "Ingen eksplisitt child-policy"}
            </li>
            <li>{dt.createPolicyNote ?? "Tree-policy styres av dokumenttypen og den aktive content tree-kontrakten."}</li>
            <li>Ved degradert tree låses mutasjoner i stedet for å late som policy fortsatt er fullstendig kjent.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Blokkallowlist (body)</h2>
          <p className="mt-2 text-sm text-slate-600">
            Når envelope har <code className="text-xs">documentType: {alias}</code>, validerer lagring mot denne listen.
          </p>
          <p className="mt-3 font-mono text-xs leading-relaxed text-slate-800">
            {summary?.allowedBlockTypes?.length
              ? summary.allowedBlockTypes.join(", ")
              : "Alle editor-blokktyper (satt eksplisitt i documentTypes.ts)"}
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Property editor usage</h2>
          {configuredInstances.length > 0 ? (
            <div className="mt-4 grid gap-3">
              {configuredInstances.map((instance) => (
                <article key={instance.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{instance.fieldLabel}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {instance.blockLabel} · <span className="font-mono">{instance.fieldKey}</span>
                      </p>
                    </div>
                    <Link
                      href={`/backoffice/settings/data-types/${encodeURIComponent(instance.kind)}`}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-mono text-slate-900 hover:bg-slate-100"
                    >
                      {instance.kind}
                    </Link>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-slate-700 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Påkrevd</p>
                      <p className="mt-1">{instance.required ? "Ja" : "Nei"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Default</p>
                      <p className="mt-1">{instance.defaultValueLabel ?? "Ingen"}</p>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">UI mapping</p>
                      <p className="mt-1">{instance.uiLabelNb}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-600">Ingen schema-driven configured instances funnet for denne typen.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Presets og dekning</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Hvilke defaults som faktisk finnes, og hvilke create options som fortsatt mangler schema-driven editorflyt.
          </p>
          <div className="mt-4 space-y-3">
            {presets.length > 0 ? (
              <ul className="space-y-3">
                {presets.map((preset) => (
                  <li key={preset.id} className="rounded-lg border border-slate-100 bg-slate-50/70 p-3">
                    <p className="font-medium text-slate-900">{preset.blockLabel}</p>
                    <p className="mt-1 font-mono text-[11px] text-slate-500">{preset.blockType}</p>
                    <p className="mt-2 text-sm text-slate-700">
                      {preset.defaults.map((entry) => `${entry.key}=${entry.valueLabel}`).join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Ingen eksplisitte defaults registrert for blokktyper under denne dokumenttypen.</p>
            )}
            {coverageGaps.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-sm text-amber-950">
                <p className="font-medium">Coverage gap</p>
                <p className="mt-1">{coverageGaps.map((gap) => gap.blockType).join(", ")}</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Workspace-kobling</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {dt.workspaceHint ??
              "Denne dokumenttypen brukes i den ordinære sideeditoren og følger samme workspace-host, footer apps og history posture som resten av content-seksjonen."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link
              href="/backoffice/content"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
            >
              Åpne content workspace
            </Link>
            <Link
              href="/backoffice/settings/schema"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
            >
              Se schema-kjede
            </Link>
          </div>
          {summary?.fieldKinds.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {summary.fieldKinds.map((kind) => (
                <Link
                  key={kind}
                  href={`/backoffice/settings/data-types/${encodeURIComponent(kind)}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 hover:bg-slate-100"
                >
                  {kind}
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Relaterte arbeidsflater</h2>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link
              href="/backoffice/settings/schema"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
            >
              Schema (samlet)
            </Link>
            <Link
              href="/backoffice/settings/create-policy"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
            >
              Create policy
            </Link>
            <Link
              href="/backoffice/content"
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-900 hover:bg-slate-100"
            >
              Content section
            </Link>
          </div>
        </section>
      </div>
    </BackofficeManagementWorkspaceFrame>
  );
}
