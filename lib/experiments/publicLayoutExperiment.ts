import "server-only";

import { getRunningExperimentAssignmentForPage } from "@/lib/experiments/overlayRunningExperiment";
import { isLocalCmsRuntimeEnabled } from "@/lib/localRuntime/runtime";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

function slugFromPathname(pathname: string): string {
  const p = (pathname ?? "/").trim() || "/";
  if (p === "/" || p === "") return "home";
  const seg = p.replace(/^\/+/, "").split("/")[0];
  return seg ? seg.trim().toLowerCase() : "home";
}

/**
 * Resolve running traffic experiment assignment for the current public path (prod only — never preview CMS).
 */
export async function getPublicLayoutExperimentAssignment(pathname: string): Promise<{
  experimentId: string;
  variantId: string;
} | null> {
  if (isLocalCmsRuntimeEnabled()) {
    return null;
  }
  try {
    const slug = slugFromPathname(pathname);
    const supabase = supabaseAdmin();
    const { data: page, error } = await supabase
      .from("content_pages")
      .select("id")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      opsLog("growth.layout_experiment.page_error", { pathname, slug, message: error.message });
      return null;
    }
    if (!page?.id) return null;

    const assignment = await getRunningExperimentAssignmentForPage({
      pageId: page.id as string,
      preview: false,
    });
    if (assignment) {
      opsLog("growth.layout_experiment.assignment", {
        pathname,
        slug,
        pageId: page.id,
        experimentId: assignment.experimentId,
        variantId: assignment.variantId,
      });
    }
    return assignment;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    opsLog("growth.layout_experiment.unavailable", { pathname, message });
    return null;
  }
}
