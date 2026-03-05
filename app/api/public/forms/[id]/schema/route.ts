import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { normalizeFormSchema } from "@/lib/public/forms/validate";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rid = makeRid("form-schema");
  try {
    const { id: formId } = await context.params;
    if (!formId?.trim()) return jsonErr(rid, "Missing form id", 400, "BAD_REQUEST");
    const url = request.nextUrl;
    const envParam = url.searchParams.get("env") === "staging" ? "staging" : "prod";
    const localeParam = url.searchParams.get("locale") === "en" ? "en" : "nb";
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: formRow, error } = await supabase.from("forms").select("id, schema").eq("id", formId).eq("environment", envParam).eq("locale", localeParam).maybeSingle();
    if (error || !formRow) return jsonErr(rid, "Form not found", 404, "NOT_FOUND");
    const schema = normalizeFormSchema(formRow.schema);
    return jsonOk(rid, { ok: true, rid, schema }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(rid, msg, 500, "SERVER_ERROR");
  }
}
