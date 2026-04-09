"use server";

import { generatePage } from "@/lib/ai/pageBuilder";
import { generatePageFromIntent } from "@/lib/ai/cmsAiEngine";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { resolveRunnerCompanyIdForBackoffice } from "@/lib/ai/resolveRunnerCompanyForBackoffice";

export type GenerateAiPageDraftInput = {
  prompt: string;
  /** strict: validated JSON only (preview flow). loose: legacy append with deterministic fallback. */
  mode?: "strict_preview" | "loose_append";
  pageTypeHint?: string;
  existingBlocksSummary?: string;
  menuContextHint?: string;
};

export type GenerateAiPageDraftResult =
  | { ok: true; data: { title: string; blocks: unknown[] } }
  | { ok: false; error: string; code?: string };

export async function generateAiPageDraftAction(input: GenerateAiPageDraftInput): Promise<GenerateAiPageDraftResult> {
  const auth = await getAuthContext();
  if (!auth.ok || auth.role !== "superadmin") {
    return { ok: false, error: "Ikke tilgang.", code: "FORBIDDEN" };
  }

  const userId = auth.user?.id?.trim();
  if (!userId) {
    return { ok: false, error: "Mangler bruker.", code: "NO_USER" };
  }

  const companyId = await resolveRunnerCompanyIdForBackoffice(auth);
  if (!companyId) {
    return {
      ok: false,
      error:
        "Fant ikke firmascope for AI-kjøring. Koble bruker til et firma med AI-aktiv plan, eller sørg for at minst ett firma har gyldig plan.",
      code: "MISSING_COMPANY_SCOPE",
    };
  }

  const prompt = String(input.prompt ?? "").trim();
  if (!prompt) {
    return { ok: false, error: "Prompt mangler.", code: "MISSING_PROMPT" };
  }

  if (prompt.length > 12_000) {
    return { ok: false, error: "Prompten er for lang.", code: "PROMPT_TOO_LONG" };
  }

  const ctx = { companyId, userId };
  const mode = input.mode ?? "strict_preview";

  if (mode === "loose_append") {
    try {
      const { title, blocks } = await generatePage(prompt, ctx);
      // Persist path applies only normalized block JSON in the editor — never raw HTML/JSX.
      return { ok: true, data: { title, blocks: blocks as unknown[] } };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: msg || "Sidegenerering feilet.", code: "PAGE_GENERATE_FAILED" };
    }
  }

  const out = await generatePageFromIntent(prompt, ctx, {
    pageTypeHint: input.pageTypeHint,
    existingBlocksSummary: input.existingBlocksSummary,
    menuContextHint: input.menuContextHint,
  });

  if (out.ok === false) {
    return { ok: false, error: out.error, code: out.code };
  }

  return { ok: true, data: { title: out.data.title, blocks: out.data.blocks as unknown[] } };
}
