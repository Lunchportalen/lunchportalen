import "server-only";

import { AiRunnerError, AI_RUNNER_TOOL, runAi } from "@/lib/ai/runner";
import {
  promptMenuGenerate,
  promptMenuImprove,
  promptMenuValidateIssues,
  promptWeekSuggest,
} from "@/lib/ai/cmsAiPrompts";
import type {
  CmsAiEngineResult,
  CmsAiRunContext,
  CmsMenuContentImproved,
  CmsMenuContentInput,
  CmsMenuGenerated,
  CmsMenuQualityResult,
  CmsWeekVariationSuggestion,
} from "@/lib/ai/cmsAiTypes";
import type { PageBuilderDraftBlock } from "@/lib/ai/pageBuilder";
import type { PageBuilderUserPromptOptions } from "@/lib/ai/pageBuilderPrompts";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

const MEAL_TYPE_RE = /^[a-z0-9_]{2,64}$/;

function clampStr(s: unknown, max: number): string {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

function asAllergens(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 24);
}

export function heuristicImproveMenu(menu: CmsMenuContentInput): CmsMenuContentImproved {
  const title = clampStr(menu.title, 120) || "Meny";
  const description = clampStr(menu.description, 2000) || "";
  const allergens = asAllergens(menu.allergens);
  return { title, description, allergens };
}

function parseImprovePayload(raw: unknown): CmsMenuContentImproved | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const title = clampStr(o.title, 120);
  const description = clampStr(o.description, 2000);
  const allergens = asAllergens(o.allergens);
  if (!title) return null;
  return { title, description, allergens };
}

function parseGeneratePayload(raw: unknown, allowed: Set<string>): CmsMenuGenerated | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const mt = normalizeMealTypeKey(o.mealType);
  if (!mt || !allowed.has(mt)) return null;
  const base = parseImprovePayload(raw);
  if (!base) return null;
  return { ...base, mealType: mt };
}

function parseWeekPayload(raw: unknown, allowed: Set<string>): CmsWeekVariationSuggestion | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const daysIn = o.days && typeof o.days === "object" && !Array.isArray(o.days) ? (o.days as Record<string, unknown>) : {};
  const days: CmsWeekVariationSuggestion["days"] = {};
  for (const k of ["mon", "tue", "wed", "thu", "fri"] as const) {
    const v = daysIn[k];
    if (v == null) continue;
    const nk = normalizeMealTypeKey(v);
    if (nk && allowed.has(nk)) days[k] = nk;
  }
  if (!Object.keys(days).length) return null;
  const notes = o.notes != null ? clampStr(o.notes, 800) : undefined;
  return { days, notes: notes || undefined };
}

function parseIssuesPayload(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.issues)) return [];
  return o.issues.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 12);
}

async function runStructured(
  ctx: CmsAiRunContext,
  system: string,
  user: string,
  maxTokens = 1800
): Promise<{ result: unknown; model?: string; rid?: string }> {
  const out = await runAi({
    companyId: ctx.companyId,
    userId: ctx.userId,
    tool: AI_RUNNER_TOOL.CMS_STRUCTURED_JSON,
    input: {
      system: system.slice(0, 12_000),
      user: user.slice(0, 14_000),
      max_tokens: maxTokens,
    },
    metadata: { locale: "nb" },
  });
  return { result: out.result, model: out.model, rid: out.rid };
}

/** Deterministic quality score + issues (always runs; no provider). */
export function scoreMenuQuality(menu: CmsMenuContentInput): CmsMenuQualityResult {
  const issues: string[] = [];
  let score = 100;
  const title = clampStr(menu.title, 200);
  const desc = clampStr(menu.description, 4000);
  const allergens = asAllergens(menu.allergens);

  if (title.length < 2) {
    issues.push("Tittel mangler eller er for kort.");
    score -= 25;
  }
  if (title.length > 120) {
    issues.push("Tittel bør være maks 120 tegn for CMS.");
    score -= 10;
  }
  if (desc.length < 12) {
    issues.push("Beskrivelse er svært kort.");
    score -= 15;
  }
  if (menu.mealType != null && String(menu.mealType).trim() !== "") {
    const nk = normalizeMealTypeKey(menu.mealType);
    if (!nk || !MEAL_TYPE_RE.test(nk)) {
      issues.push("mealType ser ugyldig ut (kun små bokstaver, tall, understrek).");
      score -= 20;
    }
  }
  if (allergens.some((a) => a.length > 48)) {
    issues.push("Ett eller flere allergener er uforholdsmessig lange.");
    score -= 5;
  }
  return { score: Math.max(0, Math.min(100, score)), issues, heuristicOnly: true };
}

export async function improveMenuContent(
  menu: CmsMenuContentInput,
  ctx: CmsAiRunContext,
  locale: "nb" | "en" = "nb"
): Promise<CmsAiEngineResult<CmsMenuContentImproved>> {
  const { system, user } = promptMenuImprove({ menu, locale });
  try {
    const { result, model, rid } = await runStructured(ctx, system, user, 1200);
    const parsed = parseImprovePayload(result);
    if (parsed) return { ok: true, data: parsed, model, rid };
    console.warn("[cmsAiEngine] improveMenuContent: invalid AI JSON", { rid });
  } catch (e) {
    if (e instanceof AiRunnerError) {
      return { ok: false, error: e.message, code: e.code };
    }
    console.warn("[cmsAiEngine] improveMenuContent failed", String(e instanceof Error ? e.message : e));
  }
  return { ok: true, data: heuristicImproveMenu(menu) };
}

export async function generateMenuFromIntent(
  intent: string,
  allowedMealTypes: string[],
  ctx: CmsAiRunContext,
  locale: "nb" | "en" = "nb"
): Promise<CmsAiEngineResult<CmsMenuGenerated>> {
  const keys = Array.from(
    new Set(allowedMealTypes.map((x) => normalizeMealTypeKey(x)).filter(Boolean))
  );
  if (!keys.length) {
    return { ok: false, error: "allowedMealTypes er tom — kan ikke generere.", code: "MISSING_ALLOWLIST" };
  }
  const intentSafe = clampStr(intent, 500);
  if (!intentSafe) {
    return { ok: false, error: "Intent mangler.", code: "MISSING_INTENT" };
  }
  const allowed = new Set(keys);
  const { system, user } = promptMenuGenerate({ intent: intentSafe, allowedMealTypes: keys, locale });
  try {
    const { result, model, rid } = await runStructured(ctx, system, user, 1600);
    const parsed = parseGeneratePayload(result, allowed);
    if (parsed) return { ok: true, data: parsed, model, rid };
    console.warn("[cmsAiEngine] generateMenuFromIntent: invalid AI JSON or mealType", { rid });
  } catch (e) {
    if (e instanceof AiRunnerError) {
      return { ok: false, error: e.message, code: e.code };
    }
    console.warn("[cmsAiEngine] generateMenuFromIntent failed", String(e instanceof Error ? e.message : e));
  }
  return { ok: false, error: "Kunne ikke produsere gyldig meny fra modellen.", code: "INVALID_AI_OUTPUT" };
}

export async function validateMenuQuality(
  menu: CmsMenuContentInput,
  ctx: CmsAiRunContext,
  locale: "nb" | "en" = "nb"
): Promise<CmsMenuQualityResult> {
  const base = scoreMenuQuality(menu);
  try {
    const { system, user } = promptMenuValidateIssues({ menu, locale });
    const { result } = await runStructured(ctx, system, user, 600);
    const extra = parseIssuesPayload(result);
    const merged = [...base.issues];
    for (const x of extra) {
      if (!merged.includes(x)) merged.push(x);
    }
    let score = base.score;
    score -= Math.min(20, extra.length * 4);
    return {
      score: Math.max(0, Math.min(100, score)),
      issues: merged,
      heuristicOnly: false,
    };
  } catch (e) {
    if (e instanceof AiRunnerError) {
      console.warn("[cmsAiEngine] validateMenuQuality AI issues skipped", e.code);
    }
    return { ...base, heuristicOnly: true };
  }
}

export async function suggestWeeklyVariation(
  plan: "basis" | "luxus",
  allowedMealTypes: string[],
  ctx: CmsAiRunContext,
  locale: "nb" | "en" = "nb"
): Promise<CmsAiEngineResult<CmsWeekVariationSuggestion>> {
  const keys = Array.from(
    new Set(allowedMealTypes.map((x) => normalizeMealTypeKey(x)).filter(Boolean))
  );
  if (!keys.length) {
    return { ok: false, error: "allowedMealTypes er tom.", code: "MISSING_ALLOWLIST" };
  }
  const allowed = new Set(keys);
  const { system, user } = promptWeekSuggest({ plan, allowedMealTypes: keys, locale });
  try {
    const { result, model, rid } = await runStructured(ctx, system, user, 1400);
    const parsed = parseWeekPayload(result, allowed);
    if (parsed) return { ok: true, data: parsed, model, rid };
    console.warn("[cmsAiEngine] suggestWeeklyVariation: invalid AI JSON", { rid });
  } catch (e) {
    if (e instanceof AiRunnerError) {
      return { ok: false, error: e.message, code: e.code };
    }
    console.warn("[cmsAiEngine] suggestWeeklyVariation failed", String(e instanceof Error ? e.message : e));
  }
  return { ok: false, error: "Kunne ikke produsere gyldig ukeforslag.", code: "INVALID_AI_OUTPUT" };
}

/**
 * Full block-based page from a single prompt. Validates structure; returns normalized CMS blocks.
 * Preview-only at call site — no persistence.
 */
export async function generatePageFromIntent(
  intent: string,
  ctx: CmsAiRunContext,
  options?: PageBuilderUserPromptOptions & { locale?: "nb" | "en" }
): Promise<CmsAiEngineResult<{ title: string; blocks: PageBuilderDraftBlock[] }>> {
  const { locale: _locale, ...promptOpts } = options ?? {};
  void _locale;

  const intentSafe = clampStr(intent, 12_000);
  if (!intentSafe) {
    return { ok: false, error: "Intent mangler.", code: "MISSING_INTENT" };
  }

  try {
    const { generatePageStrict } = await import("@/lib/ai/pageBuilder");
    const data = await generatePageStrict(intentSafe, ctx, promptOpts);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof AiRunnerError) {
      return { ok: false, error: e.message, code: e.code };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Kunne ikke generere side.", code: "PAGE_GENERATE_FAILED" };
  }
}
