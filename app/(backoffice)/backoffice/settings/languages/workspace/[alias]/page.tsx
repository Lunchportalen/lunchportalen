import { LanguageWorkspaceClient } from "./LanguageWorkspaceClient";

export default async function LanguageWorkspacePage({
  params,
}: {
  params: Promise<{ alias: string }>;
}) {
  const { alias } = await params;
  const decoded = decodeURIComponent(alias ?? "").trim();
  return <LanguageWorkspaceClient alias={decoded} />;
}
