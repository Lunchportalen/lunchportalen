// lib/provider-menu/menuVariantCanonical.ts
// Canonical fixed variant titles — product order preserved via contract keys.

const VARIANT_TITLE_ALIASES: Record<string, string> = {
  ostskinke: "Ost & Skinke",
  "ost&skinke": "Ost & Skinke",
  "ost & skinke": "Ost & Skinke",
  lakseggerore: "Laks & Eggerøre",
  "laks & eggerore": "Laks & Eggerøre",
  "laks og eggerore": "Laks & Eggerøre",
  kyllingkarri: "Kyllingkarri",
  "kylling karri": "Kyllingkarri",
  vegetar: "Vegetar",
  skinke: "Skinke",
  kylling: "Kylling",
  laks: "Laks",
  "fast meny": "Fast pakke: 6 maki + 2 nigiri + 1 tempura",
  "sushipakke6bitermaki2biternigiri1tempura": "Fast pakke: 6 maki + 2 nigiri + 1 tempura",
  "pad thai": "Pad Thai nudler",
  "pad thai nudler": "Pad Thai nudler",
  "biff peppersaus": "Biff peppersaus wok",
  "biff peppersaus wok": "Biff peppersaus wok",
  "pad med mamuang": "Pad med mamuang wok",
  "pad med mamuang wok": "Pad med mamuang wok",
};

function foldVariantKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_&+./-]+/g, "");
}

/**
 * Maps legacy/alias variant titles to canonical product titles.
 * Returns trimmed input when no alias is known.
 */
export function canonicalVariantTitle(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  const lowered = raw.toLowerCase();
  if (VARIANT_TITLE_ALIASES[lowered]) return VARIANT_TITLE_ALIASES[lowered]!;
  const folded = foldVariantKey(raw);
  return VARIANT_TITLE_ALIASES[folded] ?? raw;
}
