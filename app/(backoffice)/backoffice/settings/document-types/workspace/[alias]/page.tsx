import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { getBaselineDocumentTypeDefinition, listDocumentTypeAliases } from "@/lib/cms/schema/documentTypeDefinitions";
import { DocumentTypeWorkspaceClient } from "./DocumentTypeWorkspaceClient";

type Props = { params: Promise<{ alias: string }> };

export async function generateMetadata({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw);
  const dt = getBaselineDocumentTypeDefinition(alias);
  return { title: dt ? `${dt.title} — Document type workspace` : "Document type workspace" };
}

/**
 * U96 — Persistert Document Type / Property Type workspace (merge med baseline).
 */
export default async function SettingsDocumentTypeRuntimeWorkspacePage({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw).trim();
  if (!alias || !listDocumentTypeAliases().includes(alias)) {
    notFound();
  }
  const baseline = getBaselineDocumentTypeDefinition(alias)!;
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "document-types",
    title: `${baseline.title} (runtime)`,
    description:
      "Rediger tittel, beskrivelse, gruppefaner, property-metadata og Data Type-binding. Endringer lagres i global settings og brukes av content-editoren.",
    routeKind: "detail",
    signals: [
      { label: "Alias", value: alias, description: "Stabil dokumenttype-nøkkel." },
      {
        label: "Body property",
        value: baseline.properties.find((p) => p.alias === "body")?.dataTypeAlias ?? "—",
        description: "Aktiv Block Editor Data Type for body-feltet.",
      },
      {
        label: "Grupper",
        value: String(baseline.groups.length),
        description: "Tabs/grupper i document type-skjemaet.",
      },
    ],
    primaryAction: {
      label: "Document types",
      href: "/backoffice/settings/document-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Les-only detail", href: `/backoffice/settings/document-types/${encodeURIComponent(alias)}`, look: "secondary" },
      { label: "Block Editor Data Types", href: "/backoffice/settings/block-editor-data-types", look: "outline" },
    ],
    relatedLinks: [
      { label: "Element types", href: "/backoffice/settings/element-types", look: "outline" },
      { label: "Content", href: "/backoffice/content", look: "outline" },
    ],
    note: "Baseline kommer fra kode; ulagrede felt er admin-overrides som merges ved runtime (samme mønster som Block Editor Data Types).",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/backoffice/settings/document-types" className="text-sm font-medium text-slate-900 underline underline-offset-4">
          ← Document types
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-slate-600">Laster workspace…</p>}>
        <DocumentTypeWorkspaceClient alias={alias} />
      </Suspense>
    </BackofficeManagementWorkspaceFrame>
  );
}
