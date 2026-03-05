/**
 * Content strategy plan: deterministic suggestions for missing/common pages.
 */

export function contentStrategyPlan(args: {
  locale: string;
  existingPages: string[];
  topics?: string[];
}): { summary: string; suggestions: Array<{ title: string; reason: string }> } {
  const { locale, existingPages = [], topics = [] } = args;
  const isEn = locale.toLowerCase().startsWith("en");
  const existing = new Set((existingPages || []).map((p) => (typeof p === "string" ? p : "").toLowerCase().trim()));
  const suggestions = [];
  const commonPages = [
    { slug: "lunsjordning-pris", titleNb: "Lunsjordning pris", titleEn: "Lunch ordering pricing", reasonNb: "Vanlig informasjonsside for beslutningstakere.", reasonEn: "Common info page for decision makers." },
    { slug: "kantine-alternativ", titleNb: "Kantine alternativ", titleEn: "Canteen alternative", reasonNb: "Søkeord mange brukere leter etter.", reasonEn: "Search term many users look for." },
    { slug: "bedriftslunsj-guide", titleNb: "Bedriftslunsj guide", titleEn: "Corporate lunch guide", reasonNb: "Støtter konvertering og forståelse.", reasonEn: "Supports conversion and understanding." },
  ];
  for (const p of commonPages) {
    const key = p.slug;
    if (!existing.has(key) && !existing.has(p.titleNb.toLowerCase()) && !existing.has(p.titleEn.toLowerCase())) {
      suggestions.push({ title: isEn ? p.titleEn : p.titleNb, reason: isEn ? p.reasonEn : p.reasonNb });
    }
  }
  for (const t of topics.slice(0, 3)) {
    const topic = typeof t === "string" ? t.trim() : "";
    if (topic && !suggestions.some((s) => s.title.toLowerCase().includes(topic.toLowerCase()))) {
      suggestions.push({ title: topic, reason: isEn ? "Requested topic." : "Ønsket tema." });
    }
  }
  const summary = isEn
    ? "Content plan: " + (existingPages?.length ?? 0) + " existing pages, " + suggestions.length + " suggestions."
    : "Innholdsplan: " + (existingPages?.length ?? 0) + " eksisterende sider, " + suggestions.length + " forslag.";
  return { summary, suggestions };
}
