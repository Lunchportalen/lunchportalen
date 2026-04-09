import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "growth_hints_prompt";

/**
 * Korte hint til AI-prompt fra siste læringsrader (fail-closed → tom streng).
 */
export async function getGrowthHintsForPrompt(): Promise<string> {
  try {
    if (!hasSupabaseAdminConfig()) return "";
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return "";

    const { data, error } = await admin
      .from("ai_activity_log")
      .select("metadata")
      .eq("action", "learning_pattern")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error || !Array.isArray(data)) return "";

    const hooks: string[] = [];
    for (const row of data) {
      const m = row && typeof row === "object" ? (row as { metadata?: unknown }).metadata : null;
      if (!m || typeof m !== "object" || Array.isArray(m)) continue;
      const hook = (m as Record<string, unknown>).hook;
      const success = (m as Record<string, unknown>).success;
      if (success !== true) continue;
      if (typeof hook === "string" && hook.trim()) hooks.push(hook.trim());
    }

    if (hooks.length === 0) return "";
    const unique = [...new Set(hooks)].slice(0, 5);
    return unique.join(" · ");
  } catch {
    return "";
  }
}
