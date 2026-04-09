/**
 * Structured prompts for CMS AI — Norwegian editorial tone, strict JSON contract in system text.
 */

const JSON_ONLY = `Svar KUN med gyldig JSON (ett objekt). Ingen markdown, ingen forklaring utenfor JSON.`;

export function promptMenuImprove(params: {
  menu: { mealType?: string | null; title: string; description?: string | null; allergens?: string[] | null };
  locale: "nb" | "en";
}): { system: string; user: string } {
  const { menu, locale } = params;
  const lang = locale === "en" ? "English" : "Norwegian (Bokmål)";
  const system = [
    `You are an enterprise lunch-menu copy editor for Lunchportalen.no.`,
    `Language: ${lang}. Calm, warm, professional — no hype.`,
    JSON_ONLY,
    `Schema: {"title": string, "description": string, "allergens": string[]}`,
    `Keep allergens as short tokens (e.g. Gluten, Melk). Do not invent medical claims.`,
  ].join("\n");

  const user = JSON.stringify({
    task: "menu_improve",
    current: {
      mealType: menu.mealType ?? null,
      title: menu.title,
      description: menu.description ?? "",
      allergens: Array.isArray(menu.allergens) ? menu.allergens : [],
    },
  });

  return { system, user };
}

export function promptMenuGenerate(params: {
  intent: string;
  allowedMealTypes: string[];
  locale: "nb" | "en";
}): { system: string; user: string } {
  const { intent, allowedMealTypes, locale } = params;
  const lang = locale === "en" ? "English" : "Norwegian (Bokmål)";
  const system = [
    `You propose ONE menu document for a B2B office lunch CMS.`,
    `Language: ${lang}. Tone: calm, professional.`,
    JSON_ONLY,
    `Schema: {"mealType": string, "title": string, "description": string, "allergens": string[]}`,
    `CRITICAL: "mealType" MUST be exactly one of this allowlist (ASCII keys): ${JSON.stringify(allowedMealTypes)}`,
    `Pick the best-fitting key; never invent a new mealType.`,
  ].join("\n");

  const user = JSON.stringify({
    task: "menu_generate",
    intent: intent.slice(0, 500),
    allowedMealTypes,
  });

  return { system, user };
}

export function promptMenuValidateIssues(params: {
  menu: { mealType?: string | null; title: string; description?: string | null; allergens?: string[] | null };
  locale: "nb" | "en";
}): { system: string; user: string } {
  const lang = params.locale === "en" ? "English" : "Norwegian (Bokmål)";
  const system = [
    `You review menu copy for clarity, allergens consistency, and Norwegian quality.`,
    `Language for issue strings: ${lang}.`,
    JSON_ONLY,
    `Schema: {"issues": string[]} — max 8 short issues; empty if none.`,
  ].join("\n");

  const user = JSON.stringify({
    task: "menu_validate",
    menu: params.menu,
  });

  return { system, user };
}

export function promptWeekSuggest(params: {
  plan: "basis" | "luxus";
  allowedMealTypes: string[];
  locale: "nb" | "en";
}): { system: string; user: string } {
  const { plan, allowedMealTypes, locale } = params;
  const lang = locale === "en" ? "English" : "Norwegian (Bokmål)";
  const system = [
    `You suggest a weekday → mealType mapping for a corporate lunch program (suggestion only, not applied).`,
    `Language for "notes": ${lang}.`,
    JSON_ONLY,
    `Schema: {"days": {"mon"?: string, "tue"?: string, "wed"?: string, "thu"?: string, "fri"?: string}, "notes"?: string}`,
    `Each day value MUST be one of: ${JSON.stringify(allowedMealTypes)}`,
    plan === "basis"
      ? `Plan is BASIS: use the SAME mealType for every day you include (typically all five weekdays).`
      : `Plan is LUXUS: you may vary by day; still only use allowlist keys.`,
  ].join("\n");

  const user = JSON.stringify({
    task: "week_suggest",
    plan,
    allowedMealTypes,
  });

  return { system, user };
}
