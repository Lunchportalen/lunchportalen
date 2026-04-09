import type { CmsMenuByMealType, CmsMenuVariant } from "@/lib/cms/types";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function normalizeVariants(raw: unknown): CmsMenuVariant[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: CmsMenuVariant[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    out.push({
      title: o.title != null ? String(o.title) : null,
      description: o.description != null ? String(o.description) : null,
      mealType: o.mealType != null ? normalizeMealTypeKey(o.mealType) || null : null,
    });
  }
  return out.length ? out : null;
}

export function normalizeMenuDoc(doc: any): CmsMenuByMealType | null {
  if (!doc || typeof doc !== "object") return null;
  const mealType = normalizeMealTypeKey((doc as any).mealType);
  const title = String((doc as any).title ?? "").trim();
  if (!mealType || !title) return null;
  const allergens = Array.isArray((doc as any).allergens)
    ? ((doc as any).allergens as unknown[]).map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];

  const fromGallery = asStringArray((doc as any).imageUrls);
  const legacyUrl =
    (doc as any).legacyImageUrl != null
      ? String((doc as any).legacyImageUrl).trim()
      : (doc as any).imageUrl != null
        ? String((doc as any).imageUrl).trim()
        : "";
  const legacySingle = legacyUrl ? [legacyUrl] : [];
  const images = fromGallery.length ? fromGallery : legacySingle.filter(Boolean);

  return {
    mealType,
    title,
    description: (doc as any).description != null ? String((doc as any).description) : null,
    images,
    imageUrl: images[0] ?? null,
    allergens,
    nutrition: (doc as any).nutrition && typeof (doc as any).nutrition === "object" ? (doc as any).nutrition : null,
    variants: normalizeVariants((doc as any).variants),
  };
}
