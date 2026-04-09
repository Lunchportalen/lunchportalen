import { notFound } from "next/navigation";
import { BackofficeManagementWorkspaceFrame } from "@/components/backoffice/BackofficeManagementWorkspaceFrame";
import { buildBackofficeManagementWorkspaceModel } from "@/lib/cms/backofficeSettingsWorkspaceModel";
import { getBaselineCompositionDefinition } from "@/lib/cms/schema/compositionDefinitions";
import { CompositionWorkspaceClient } from "./CompositionWorkspaceClient";

type Props = { params: Promise<{ alias: string }> };

export async function generateMetadata({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw);
  const c = getBaselineCompositionDefinition(alias);
  return { title: c ? `${c.title} — Composition workspace` : "Composition workspace" };
}

export default async function CompositionWorkspacePage({ params }: Props) {
  const { alias: raw } = await params;
  const alias = decodeURIComponent(raw);
  const c = getBaselineCompositionDefinition(alias);
  if (!c) notFound();

  const model = buildBackofficeManagementWorkspaceModel({
    collectionId: "compositions",
    title: c.title,
    description: c.description,
    routeKind: "workspace",
    primaryAction: { label: "Til compositions", href: "/backoffice/settings/compositions", look: "primary" },
    signals: [
      { label: "Alias", value: c.alias, description: "Kanonisk composition-alias." },
      { label: "Grupper", value: String(c.groups.length), description: "Delte grupper/tabs i composition." },
      { label: "Properties", value: String(c.properties.length), description: "Delte properties i composition." },
    ],
  });

  return (
    <BackofficeManagementWorkspaceFrame model={model}>
      <CompositionWorkspaceClient alias={alias} />
    </BackofficeManagementWorkspaceFrame>
  );
}
