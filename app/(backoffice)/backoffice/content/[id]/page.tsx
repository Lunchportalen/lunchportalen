import { redirect } from "next/navigation";
import ContentWorkspace from "../_workspace/ContentWorkspace";
import { isContentPageId, getPageIdBySlug } from "@/lib/cms/public/getPageIdBySlug";
import CreateMissingPageClient from "./_components/CreateMissingPageClient";

type Props = { params: Promise<{ id: string }> };

function getSuggestedTitleForSlug(slug: string): string {
  if (slug === "home") return "Hjem";
  if (slug === "app-overlay-week") return "Week (overlay)";
  if (slug === "app-overlay-dashboard") return "Dashboard (overlay)";
  if (slug === "app-overlay-company-admin") return "Company Admin (overlay)";
  if (slug === "app-overlay-superadmin") return "Superadmin (overlay)";
  if (slug === "app-overlay-kitchen") return "Kitchen (overlay)";
  if (slug === "app-overlay-driver") return "Driver (overlay)";
  return `Side: ${slug}`;
}

export default async function ContentIdPage({ params }: Props) {
  const { id } = await params;

  // UUID: render editor directly.
  if (isContentPageId(id)) {
    return <ContentWorkspace selectedNodeId={id} />;
  }

  // Slug: try to resolve to UUID and redirect.
  const pageId = await getPageIdBySlug(id);
  if (pageId) {
    redirect(`/backoffice/content/${pageId}`);
  }

  const normalizedSlug = id.trim();
  const suggestedTitle = getSuggestedTitleForSlug(normalizedSlug);

  // Fail-closed: clear message when slug cannot be resolved, with explicit create option.
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold text-slate-900">Node ikke funnet</h1>
      <p className="mt-2 text-sm text-slate-600">
        Finner ingen side med slug <code>{normalizedSlug}</code>.
      </p>
      <CreateMissingPageClient slug={normalizedSlug} suggestedTitle={suggestedTitle} />
    </div>
  );
}
