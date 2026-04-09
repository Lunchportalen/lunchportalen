import "server-only";

import { supabaseServer } from "@/lib/supabase/server";

export type AIConfigRow = {
  id: string;
  model: string | null;
  temperature?: number | null;
  max_tokens?: number | null;
  system_prompt?: string | null;
  features?: unknown;
  updated_at?: string | null;
  updated_by?: string | null;
};

export async function getAIConfig(): Promise<AIConfigRow> {
  const supabase = await supabaseServer();

  const { data, error } = await supabase.from("ai_config").select("*").limit(1).maybeSingle();

  if (error) {
    throw {
      code: "AI_CONFIG_FETCH_FAILED",
      message: error.message,
      source: "ai_config",
      severity: "high" as const,
    };
  }

  if (!data) {
    throw {
      code: "AI_CONFIG_MISSING",
      message: "No AI config row found",
      source: "ai_config",
      severity: "high" as const,
    };
  }

  return data as AIConfigRow;
}
