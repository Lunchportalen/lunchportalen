/**
 * Statisk katalog: menyvalg (choice_key / måltid) → ingredienser per porsjon.
 * V1 er deterministisk og utvidbar — koble senere til CMS eller ERP uten å endre grensesnitt.
 */

export type IngredientPortion = {
  /** Normalisert nøkkel (f.eks. «kyllingfilet»). */
  key: string;
  /** Visningsnavn. */
  label: string;
  /** Gram per porsjon av retten. */
  gramsPerPortion: number;
};

export type MenuIngredientRecipe = {
  menuKey: string;
  displayName: string;
  ingredients: IngredientPortion[];
};

/** Synonymer: rå choice_key → katalognøkkel. */
const ALIASES: Record<string, string> = {
  lasagne: "lasagne",
  lasagna: "lasagne",
  kylling: "kylling",
  chicken: "kylling",
  kyllingfilet: "kylling",
  fisk: "fisk",
  fish: "fisk",
  laks: "fisk",
  ris: "risotto",
  risotto: "risotto",
  vegetar: "vegetar",
  veggie: "vegetar",
  salat: "salat",
  suppe: "suppe",
  pasta: "pasta",
  carbonara: "pasta",
  taco: "taco",
  burger: "burger",
  default: "default",
};

const CATALOG: Record<string, MenuIngredientRecipe> = {
  lasagne: {
    menuKey: "lasagne",
    displayName: "Lasagne",
    ingredients: [
      { key: "pasta_plater", label: "Pastaplater", gramsPerPortion: 80 },
      { key: "kjottdeig", label: "Kjøttdeig", gramsPerPortion: 120 },
      { key: "ost", label: "Ost", gramsPerPortion: 40 },
      { key: "tomat", label: "Tomat / saus", gramsPerPortion: 90 },
    ],
  },
  kylling: {
    menuKey: "kylling",
    displayName: "Kylling",
    ingredients: [
      { key: "kyllingfilet", label: "Kyllingfilet", gramsPerPortion: 160 },
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 80 },
      { key: "ris", label: "Ris", gramsPerPortion: 100 },
    ],
  },
  fisk: {
    menuKey: "fisk",
    displayName: "Fisk",
    ingredients: [
      { key: "fisk", label: "Fisk", gramsPerPortion: 150 },
      { key: "potet", label: "Potet", gramsPerPortion: 120 },
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 70 },
    ],
  },
  risotto: {
    menuKey: "risotto",
    displayName: "Ris / risotto",
    ingredients: [
      { key: "ris", label: "Ris", gramsPerPortion: 130 },
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 60 },
      { key: "ost", label: "Ost", gramsPerPortion: 25 },
    ],
  },
  vegetar: {
    menuKey: "vegetar",
    displayName: "Vegetar",
    ingredients: [
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 180 },
      { key: "linser", label: "Linser / belgvekster", gramsPerPortion: 80 },
      { key: "ris", label: "Ris", gramsPerPortion: 90 },
    ],
  },
  salat: {
    menuKey: "salat",
    displayName: "Salat",
    ingredients: [
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 200 },
      { key: "dressing", label: "Dressing", gramsPerPortion: 30 },
    ],
  },
  suppe: {
    menuKey: "suppe",
    displayName: "Suppe",
    ingredients: [
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 120 },
      { key: "buljong", label: "Buljong / base", gramsPerPortion: 40 },
      { key: "brod", label: "Brød", gramsPerPortion: 50 },
    ],
  },
  pasta: {
    menuKey: "pasta",
    displayName: "Pasta",
    ingredients: [
      { key: "pasta_torr", label: "Pasta (tørr)", gramsPerPortion: 90 },
      { key: "ost", label: "Ost", gramsPerPortion: 30 },
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 70 },
    ],
  },
  taco: {
    menuKey: "taco",
    displayName: "Taco",
    ingredients: [
      { key: "kjottdeig", label: "Kjøttdeig / alternativ", gramsPerPortion: 110 },
      { key: "tortilla", label: "Lefse / tortilla", gramsPerPortion: 60 },
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 80 },
    ],
  },
  burger: {
    menuKey: "burger",
    displayName: "Burger",
    ingredients: [
      { key: "burger_brod", label: "Burgerbrød", gramsPerPortion: 70 },
      { key: "kjottdeig", label: "Kjøtt / alternativ", gramsPerPortion: 140 },
      { key: "ost", label: "Ost", gramsPerPortion: 25 },
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 50 },
    ],
  },
  default: {
    menuKey: "default",
    displayName: "Standard meny",
    ingredients: [
      { key: "protein", label: "Protein (snitt)", gramsPerPortion: 140 },
      { key: "gronnsaker", label: "Grønnsaker", gramsPerPortion: 100 },
      { key: "kolhydrat", label: "Karbohydrat (snitt)", gramsPerPortion: 110 },
    ],
  },
};

export function normalizeMenuKey(raw: string): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  if (!s) return "default";
  if (CATALOG[s]) return s;
  if (ALIASES[s]) return ALIASES[s]!;
  for (const [a, target] of Object.entries(ALIASES)) {
    if (s.includes(a)) return target;
  }
  return "default";
}

export function recipeForMenuKey(rawKey: string): MenuIngredientRecipe {
  const k = normalizeMenuKey(rawKey);
  return CATALOG[k] ?? CATALOG.default!;
}

export function allCatalogMenuKeys(): string[] {
  return Object.keys(CATALOG).filter((k) => k !== "default");
}
