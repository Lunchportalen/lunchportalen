import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { ElementTypeWorkspaceClient } from "./ElementTypeWorkspaceClient";

type Props = { params: Promise<{ alias: string }> };

export async function generateMetadata({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw);
  const d = getBlockTypeDefinition(alias);
  return { title: d ? `${d.title} — Element type workspace` : "Element type workspace" };
}

/**
 * U96B — Persistert Element Type runtime workspace (title/description/editor help).
 */
export default async function SettingsElementTypeRuntimeWorkspacePage({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw).trim();
  const canon = getBlockTypeDefinition(alias);
  if (!alias || !canon) notFound();

  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "element-types",
    title: `${canon.title} (runtime)`,
    description:
      "Rediger visningstittel, beskrivelse og editor-hjelp. Endringer lagres i global settings og brukes i block library og inspektør.",
    routeKind: "detail",
    signals: [
      { label: "Alias", value: alias, description: "Element / block entry-nøkkel." },
      { label: "Property editor", value: canon.propertyEditorComponent, description: "Code-governed routing." },
      { label: "Canvas view", value: canon.canvasViewComponent, description: "Code-governed canvas." },
    ],
    primaryAction: {
      label: "Element types",
      href: "/backoffice/settings/element-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Les-only kontrakt", href: `/backoffice/settings/element-types/${encodeURIComponent(alias)}`, look: "secondary" },
    ],
    relatedLinks: [
      { label: "Document types (runtime)", href: "/backoffice/settings/document-types", look: "outline" },
      { label: "Content", href: "/backoffice/content", look: "outline" },
    ],
    note: "Baseline kommer fra kode; feltene her er admin-overrides som merges i content-editoren.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="mb-4">
        <Link href="/backoffice/settings/element-types" className="text-sm font-medium text-slate-900 underline underline-offset-4">
          ← Element types
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-600">Laster workspace…</p>}>
        <ElementTypeWorkspaceClient alias={alias} />
      </Suspense>
    </BackofficeManagementWorkspaceFrame>
  );
}
