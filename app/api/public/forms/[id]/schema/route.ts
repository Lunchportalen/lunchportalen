import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  anonRateLimitOk,
  clientIpFromAnonRequest,
  publicFormSchemaParamsSchema,
} from "@/lib/public/anonRouteGuard";
import { normalizeFormSchema } from "@/lib/public/forms/validate";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rid = makeRid("form-schema");
  try {
    const ip = clientIpFromAnonRequest(request);
    if (!anonRateLimitOk("form-schema", ip, 120)) {
      return jsonErr(rid, "For mange forsøk", 429, "RATE_LIMIT_EXCEEDED");
    }

    const { id: formId } = await context.params;
    const url = request.nextUrl;
    const parsed = publicFormSchemaParamsSchema.safeParse({
      formId: formId?.trim() ?? "",
      env: url.searchParams.get("env") === "staging" ? "staging" : "prod",
      locale: url.searchParams.get("locale") === "en" ? "en" : "nb",
    });
    if (!parsed.success) {
      return jsonErr(rid, "Missing or invalid form id", 400, "BAD_REQUEST");
    }

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: formRow, error } = await supabase
      .from("forms")
      .select("id, schema")
      .eq("id", parsed.data.formId)
      .eq("environment", parsed.data.env)
      .eq("locale", parsed.data.locale)
      .maybeSingle();
    if (error || !formRow) return jsonErr(rid, "Form not found", 404, "NOT_FOUND");
    const schema = normalizeFormSchema(formRow.schema);
    return jsonOk(rid, { ok: true, rid, schema }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(rid, msg, 500, "SERVER_ERROR");
  }
}
