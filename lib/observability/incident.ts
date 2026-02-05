import { supabaseAdmin } from "@/lib/supabase/admin";

export type IncidentSeverity = "info" | "warn" | "error";

export type IncidentInput = {
  scope: string;
  severity: IncidentSeverity;
  rid?: string | null;
  message: string;
  meta?: any;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function logIncident(input: IncidentInput): Promise<void> {
  try {
    const admin = supabaseAdmin();
    await admin.from("incidents").insert({
      scope: safeStr(input.scope) || "unknown",
      severity: safeStr(input.severity) || "info",
      rid: safeStr(input.rid) || null,
      message: safeStr(input.message) || "unknown",
      meta: input.meta ?? null,
    });
  } catch (err: any) {
    console.error("[incident] log failed", {
      message: err?.message ?? err,
      scope: input?.scope,
      severity: input?.severity,
    });
  }
}
