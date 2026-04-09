/**
 * Hook-psykologi for konverteringsvideo — deterministisk klassifisering og scoring.
 */

export type HookPsychologyType = "pattern_interrupt" | "mistake" | "curiosity" | "shock" | "neutral";

export function classifyHookType(text: string): HookPsychologyType {
  const t = text.toLowerCase();
  if (t.includes("ikke")) return "pattern_interrupt";
  if (t.includes("feil")) return "mistake";
  if (t.includes("se hva")) return "curiosity";
  if (t.includes("du kommer")) return "shock";
  return "neutral";
}

export function scoreHookStrength(text: string): number {
  let score = 0;
  if (text.length < 80) score += 10;
  if (text.includes("...")) score += 10;
  if (text.includes("!")) score += 5;
  return score;
}

export type HookRankRow = { hook: string; type: HookPsychologyType; strength: number };

/**
 * Velger beste hook og rangerer resten — deterministisk (styrke + type-boost/penalty fra læring).
 */
export function selectBestHook(
  hooks: string[],
  opts?: { boostTypes?: string[]; penalizeTypes?: string[] },
): { selectedHook: string; alternatives: string[]; ranked: HookRankRow[] } {
  const boost = opts?.boostTypes ?? [];
  const penalize = opts?.penalizeTypes ?? [];
  const seen = new Set<string>();
  const unique = hooks.filter((h) => {
    const k = h.trim();
    if (k.length < 4 || seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  const rows = unique.map((hook) => {
    const type = classifyHookType(hook);
    const strength = scoreHookStrength(hook);
    let adj = strength;
    const bi = boost.indexOf(type);
    if (bi >= 0) adj += 200 - bi * 12;
    const pi = penalize.indexOf(type);
    if (pi >= 0) adj -= 140 - pi * 8;
    return { hook, type, strength, adj };
  });

  rows.sort((a, b) => b.adj - a.adj || a.hook.localeCompare(b.hook, "nb"));

  const ranked: HookRankRow[] = rows.map(({ hook, type, strength }) => ({ hook, type, strength }));
  const selectedHook = ranked[0]?.hook ?? unique[0] ?? "";
  const alternatives = ranked.slice(1).map((r) => r.hook);

  return { selectedHook, alternatives, ranked };
}
