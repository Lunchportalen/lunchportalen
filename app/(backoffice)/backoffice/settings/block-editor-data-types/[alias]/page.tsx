import Link from "next/link";
import { notFound } from "next/navigation";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { getBlockEditorDataType, listBlockEditorDataTypeAliases } from "@/lib/cms/blocks/blockEditorDataTypes";
import { BlockEditorDataTypeDetailClient } from "../_components/BlockEditorDataTypeDetailClient";

type Props = { params: Promise<{ alias: string }> };

export async function generateMetadata({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw);
  const row = getBlockEditorDataType(alias);
  return { title: row ? `${row.title} — Block Editor Data Type` : "Block Editor Data Type" };
}

export default async function SettingsBlockEditorDataTypeDetailPage({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw).trim();
  if (!alias || !listBlockEditorDataTypeAliases().includes(alias)) {
    notFound();
  }
  const baseline = getBlockEditorDataType(alias)!;
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "block-editor-data-types",
    title: baseline.title,
    description: baseline.description,
    routeKind: "detail",
    signals: [
      { label: "Alias", value: alias, description: "Stabil nøkkel i settings og API." },
      {
        label: "Property",
        value: baseline.propertyKey,
        description: "Logisk feltbinding i page workspace.",
      },
      {
        label: "Editor kind",
        value: baseline.editorKind,
        description: "Property editor-stil for blokklisten.",
      },
    ],
    primaryAction: {
      label: "Alle data types",
      href: "/backoffice/settings/block-editor-data-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Innstillinger", href: "/backoffice/settings", look: "secondary" },
      { label: "Content", href: "/backoffice/content", look: "outline" },
    ],
    relatedLinks: [{ label: "Document types", href: "/backoffice/settings/document-types", look: "outline" }],
    note: "Baseline kommer fra kode; ulagrede felt er admin-overrides som merges ved runtime.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="mb-4">
        <Link
          href="/backoffice/settings/block-editor-data-types"
          className="text-sm font-medium text-slate-900 underline underline-offset-4"
        >
          ← Block Editor Data Types
        </Link>
      </div>
      <BlockEditorDataTypeDetailClient alias={alias} />
    </BackofficeManagementWorkspaceFrame>
  );
}
