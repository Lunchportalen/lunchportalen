import Link from "next/link";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { listBlockEditorDataTypeAliases } from "@/lib/cms/blocks/blockEditorDataTypes";
import { BlockEditorDataTypesListClient } from "./_components/BlockEditorDataTypesListClient";

export const metadata = {
  title: "Block Editor Data Types — Innstillinger",
};

/**
 * U95 — Persistert data type-lag for blokkeditoren (baseline i kode + admin override i settings).
 */
export default function SettingsBlockEditorDataTypesPage() {
  const count = listBlockEditorDataTypeAliases().length;
  const workspaceModel = buildBackofficeManagementWorkspaceModel({
    collectionId: "block-editor-data-types",
    title: "Block Editor Data Types",
    description:
      "Konfigurer allowlist, grupper, min/maks og create-label for blokkeditoren. Endringer lagres i publisert settings og brukes i content-workspace uten deploy.",
    routeKind: "collection",
    signals: [
      {
        label: "Data types",
        value: String(count),
        description: "Registrerte block editor data types med kode-baseline.",
      },
      {
        label: "Persistence",
        value: "Settings global",
        description: "Admin-overrides lagres under blockEditorDataTypeOverrides og publiseres sammen med settings.",
      },
      {
        label: "Runtime",
        value: "Merge",
        description: "Content-editoren henter merged definisjon via API og kontekst — samme merge som server-validering.",
      },
    ],
    primaryAction: {
      label: "Document types",
      href: "/backoffice/settings/document-types",
      look: "primary",
    },
    secondaryActions: [
      { label: "Data types (kinds)", href: "/backoffice/settings/data-types", look: "secondary" },
      { label: "Content", href: "/backoffice/content", look: "outline" },
    ],
    relatedLinks: [
      { label: "Schema", href: "/backoffice/settings/schema", look: "outline" },
      { label: "Governance & bruk", href: "/backoffice/settings/governance-insights", look: "outline" },
    ],
    note:
      "Block entry-definisjoner (hva en blokk er) forblir i kode. Denne flaten eier kun data type-konfigurasjon: hvor blokker kan brukes og hvordan biblioteket presenteres.",
  });

  return (
    <BackofficeManagementWorkspaceFrame model={workspaceModel}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link href="/backoffice/settings" className="text-sm font-medium text-slate-900 underline underline-offset-4">
          ← Tilbake til innstillinger
        </Link>
      </div>
      <BlockEditorDataTypesListClient />
    </BackofficeManagementWorkspaceFrame>
  );
}
