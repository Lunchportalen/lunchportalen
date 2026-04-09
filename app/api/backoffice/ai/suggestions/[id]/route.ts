import type { NextRequest } from "next/server";
import { unwrapAiSuggestionStoredFields } from "@/lib/ai/insertAiSuggestionRow";
import { jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return withApiAiEntrypoint(request, "GET", async () => {
    const { scopeOr401, requireRoleOr403 } = await import("@/lib/http/routeGuard");
    const gate = await scopeOr401(request);
    if (gate.ok === false) return gate.res;
    const ctx = gate.ctx;
    const deny = requireRoleOr403(ctx, ["superadmin"]);
    if (deny) return deny;

    const { id } = await context.params;
    if (!id?.trim()) return jsonErr(ctx.rid, "Mangler suggestion id.", 400, "BAD_REQUEST");

    try {
      const { supabaseAdmin } = await import("@/lib/supabase/admin");
      const supabase = supabaseAdmin();
      const { data, error } = await supabase
        .from("ai_suggestions")
        .select("id, tool, status, created_at, environment, locale, page_id, variant_id, input, output")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        return jsonErr(ctx.rid, "Kunne ikke hente AI-forslag.", 500, "AI_SUGGESTION_GET_FAILED", error);
      }

      if (!data) {
        return jsonErr(ctx.rid, "AI-forslag ikke funnet.", 404, "NOT_FOUND");
      }

      const unwrapped = unwrapAiSuggestionStoredFields({
        input: data.input as unknown,
        output: data.output as unknown,
      });

      const suggestion = {
        id: data.id as string,
        tool: data.tool as string,
        status: data.status as string,
        createdAt: data.created_at as string,
        environment: data.environment as string,
        locale: data.locale as string,
        pageId: data.page_id as string | null,
        variantId: data.variant_id as string | null,
        input: unwrapped.input,
        output: unwrapped.output,
      };

      return jsonOk(ctx.rid, { ok: true, rid: ctx.rid, suggestion }, 200);
    } catch (e) {
      return jsonErr(ctx.rid, "Kunne ikke hente AI-forslag.", 500, "AI_SUGGESTION_GET_FAILED", e);
    }
  });
}