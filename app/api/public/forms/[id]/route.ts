import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { normalizeFormSchema, validateSubmission } from "@/lib/public/forms/validate";
import type { FormSchema } from "@/lib/public/forms/types";

const RATE_LIMIT_PER_MINUTE = 120;
const rateLimitMap = new Map<string, number>();

function getMinuteBucket() { return Math.floor(Date.now() / 60_000); }
function pruneRateLimit(current: number) {
  for (const [key, _] of rateLimitMap) {
    const parts = key.split(":");
    const bucket = parseInt(parts[parts.length - 1], 10);
    if (bucket < current - 1) rateLimitMap.delete(key);
  }
}

const ENVS = ["prod", "staging"] as const;
const LOCALES = ["nb", "en"] as const;

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rid = makeRid("form");
  try {
    const { id: formId } = await context.params;
    if (!formId?.trim()) return jsonErr(rid, "Missing form id", 400, "BAD_REQUEST");
    let body: unknown;
    try { body = await request.json(); } catch { return jsonErr(rid, "Invalid JSON", 400, "INVALID_JSON"); }
    const o = body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    if (!o) return jsonErr(rid, "Body must be an object", 400, "BAD_REQUEST");
    const envParam = o.env === "staging" ? "staging" : "prod";
    if (o.env === "preview") return jsonErr(rid, "Preview submissions not accepted", 400, "PREVIEW_REJECTED");
    const localeParam = o.locale === "en" ? "en" : "nb";
    const data = o.data != null && typeof o.data === "object" && !Array.isArray(o.data) ? (o.data as Record<string, unknown>) : {};
    const honeypotValue = typeof o.honeypot === "string" ? o.honeypot : "";

    const minute = getMinuteBucket();
    pruneRateLimit(minute);
    const rateKey = formId + ":" + envParam + ":" + localeParam + ":" + minute;
    const count = (rateLimitMap.get(rateKey) ?? 0) + 1;
    rateLimitMap.set(rateKey, count);
    if (count > RATE_LIMIT_PER_MINUTE) return jsonErr(rid, "Too many requests", 429, "RATE_LIMIT");

    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    const supabase = supabaseAdmin();
    const { data: formRow, error: fetchError } = await supabase.from("forms").select("id, schema").eq("id", formId).eq("environment", envParam).eq("locale", localeParam).maybeSingle();
    if (fetchError || !formRow) return jsonErr(rid, "Form not found", 404, "NOT_FOUND");
    let schema: FormSchema;
    try { schema = normalizeFormSchema(formRow.schema); } catch (_) { return jsonErr(rid, "Form configuration error", 500, "SCHEMA_INVALID"); }
    const honeypotId = schema.honeypotId ?? "_hp";
    const hpValue = honeypotId ? (data[honeypotId] ?? honeypotValue) : honeypotValue;
    if (hpValue && String(hpValue).trim() !== "") {
      return jsonOk(rid, { ok: true, message: schema.successMessage ?? "Takk!" }, 200);
    }
    const result = validateSubmission(schema, data);
    if (!result.ok) {
      const errs = (result as { ok: false; errors: string[] }).errors;
      return jsonErr(rid, "Validation failed", 400, "validation_failed", { errors: errs });
    }
    await supabase.from("form_submissions").insert({
      form_id: formId,
      environment: envParam,
      locale: localeParam,
      data: result.cleaned,
      metadata: { honeypot: false, source: "public" },
    });
    try {
      const { getHooks } = await import("@/lib/cms/plugins/registry");
      const { initPluginsOnce } = await import("@/lib/cms/plugins/loadPlugins");
      initPluginsOnce();
      const hooks = getHooks();
      const ctx = { formId, env: envParam, locale: localeParam as "nb" | "en", data: result.cleaned };
      for (const h of hooks) {
        if ((h as any).onFormSubmit) await Promise.resolve((h as any).onFormSubmit(ctx)).catch(() => {});
      }
    } catch (_) {}
    return jsonOk(rid, { ok: true, message: schema.successMessage ?? "Takk!" }, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal server error";
    return jsonErr(rid, msg, 500, "SERVER_ERROR");
  }
}




