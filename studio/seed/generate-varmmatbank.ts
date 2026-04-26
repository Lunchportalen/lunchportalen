import fs from "node:fs";
import path from "node:path";

type CostTier = "BUDGET" | "STANDARD" | "PREMIUM";
type Complexity = "LOW" | "MEDIUM" | "HIGH";
type KitchenStyle =
  | "norwegian"
  | "italian"
  | "asian"
  | "indian"
  | "mexican"
  | "mediterranean"
  | "international";

type Meal = {
  _type: "mealIdea";
  _id: string;
  title: string;
  description: string;
  tags: string[];
  kitchenStyle: KitchenStyle;
  estimatedCostPerPortion: number;
  targetPricePerPortion: 90;
  costTier: CostTier;
  productionComplexity: Complexity;
  nutritionScore: number;
  season: string[];
  allergens: string[];
  isFishDish: boolean;
  isSoup: boolean;
  isVegetarian: boolean; // ← was missing entirely
  isActive: true;
  usageCount: 0;
};

const TARGET_PRICE = 90;
const TOTAL = 1000;

// ─── Category definitions ────────────────────────────────────────────────────
//
// Each category has:
//   isVeg    — true  → isVegetarian: true on every meal in this category
//   isFish   — true  → isFishDish: true
//   isSoup   — true  → isSoup: true
//
// "stew" is intentionally a mixed protein category; individual meals get their
// protein tag injected so the generator's tag-overlap check works correctly.

const categories = [
  {
    tag: "chicken",
    count: 220,
    isVeg: false,
    isFish: false,
    isSoup: false,
    names: ["Kyllinggryte", "Kyllingform", "Kyllingwok", "Kyllingcurry", "Kyllingpanne"],
  },
  {
    tag: "pork",
    count: 140,
    isVeg: false,
    isFish: false,
    isSoup: false,
    names: ["Svinegryte", "Svineform", "Pulled pork", "Svin i saus", "Svinepanne"],
  },
  {
    tag: "beef",
    count: 120,
    isVeg: false,
    isFish: false,
    isSoup: false,
    names: ["Biffgryte", "Kjøttgryte", "Storfeform", "Bolognese", "Kjøttpanne"],
  },
  {
    tag: "fish",
    count: 110,
    isVeg: false,
    isFish: true,
    isSoup: false,
    names: ["Fiskegryte", "Laks med ris", "Torsk i saus", "Fiskeform", "Fiskepanne"],
  },
  {
    tag: "veg",
    count: 150,
    isVeg: true, // ← all veg meals get isVegetarian: true
    isFish: false,
    isSoup: false,
    names: ["Vegetargryte", "Linsegryte", "Kikertcurry", "Grønnsaksform", "Tofu-wok"],
  },
  {
    tag: "stew",
    count: 120,
    isVeg: false,
    isFish: false,
    isSoup: false,
    names: ["Husets gryte", "Middelhavsgryte", "Kremet gryte", "Tomatgryte", "Bondegryte"],
  },
  {
    tag: "pasta",
    count: 100,
    isVeg: false,
    isFish: false,
    isSoup: false,
    names: ["Pastagrateng", "Pastaform", "Kremet pasta", "Tomatpasta", "Pasta bake"],
  },
  // Soup is split: fish soups get isFishDish: true so the generator's
  // "max 1 fish dish per week" rule also covers fiskesuppe.
  {
    tag: "soup",
    count: 30,
    isVeg: false,
    isFish: false,
    isSoup: true,
    names: ["Kremet suppe", "Grønnsakssuppe", "Kyllingsuppe", "Bondekyllingsuppe"],
  },
  {
    tag: "soup",
    count: 10,
    isVeg: false,
    isFish: true,  // ← fiskesuppe counts as a fish dish
    isSoup: true,
    names: ["Fiskesuppe", "Laksesuppe", "Sjømatsuppe"],
  },
] as const;

// Protein tags injected into stew meals so the tag-overlap rule spreads them
// across the week instead of clustering.
const stewProteins = ["chicken", "pork", "beef", "chicken", "pork"] as const;

const styles: KitchenStyle[] = [
  "norwegian",
  "italian",
  "asian",
  "indian",
  "mexican",
  "mediterranean",
  "international",
];

const sides = [
  "med ris og grønnsaker",
  "med potet og sesonggrønnsaker",
  "med pasta og urter",
  "med bulgur og grønn salat",
  "med ovnsbakte grønnsaker",
  "med couscous og mild saus",
  "med nudler og sprø grønnsaker",
  "med rotgrønnsaker og kraftsaus",
];

const sauces = [
  "mild kremet saus",
  "tomatisert saus",
  "urtesaus",
  "currysaus",
  "paprikasaus",
  "soya- og ingefærsaus",
  "mild chilisaus",
  "hvitløksaus",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[æ]/g, "ae")
    .replace(/[ø]/g, "o")
    .replace(/[å]/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function pick<T>(arr: readonly T[], index: number): T {
  return arr[index % arr.length];
}

function costFor(tag: string, index: number): number {
  const base =
    tag === "fish"    ? 48 :
    tag === "beef"    ? 46 :
    tag === "pork"    ? 38 :
    tag === "chicken" ? 34 :
    tag === "veg"     ? 28 :
    tag === "soup"    ? 24 :
    tag === "pasta"   ? 30 :
                        32; // stew

  return Math.min(79, base + (index % 18));
}

function costTier(cost: number): CostTier {
  if (cost <= 34) return "BUDGET";
  if (cost <= 55) return "STANDARD";
  return "PREMIUM";
}

function complexity(index: number, cost: number): Complexity {
  if (cost <= 32) return "LOW";
  if (cost >= 58 || index % 9 === 0) return "HIGH";
  return "MEDIUM";
}

function allergensFor(tag: string, isFish: boolean, index: number): string[] {
  const allergens = new Set<string>();

  if (tag === "pasta") allergens.add("gluten");
  if (tag === "fish" || isFish) allergens.add("fisk"); // covers fish mains and fish soups
  if (tag === "soup" || index % 4 === 0) allergens.add("melk");
  if (index % 7 === 0) allergens.add("selleri");
  if (index % 11 === 0) allergens.add("sennep");

  return Array.from(allergens);
}

function seasons(index: number): string[] {
  if (index % 5 !== 0) return [];
  return [pick(["winter", "spring", "summer", "autumn"], index)];
}

// ─── Generation ───────────────────────────────────────────────────────────────

const meals: Meal[] = [];
let globalIndex = 1;

for (const category of categories) {
  for (let i = 0; i < category.count; i += 1) {
    const baseName = pick(category.names, i);
    const style = pick(styles, globalIndex);
    const side = pick(sides, i + globalIndex);
    const sauce = pick(sauces, i);
    const cost = costFor(category.tag, i);
    const title = `${baseName} ${globalIndex}`;

    // Build tag list — stew meals also get a protein tag so the generator's
    // tag-overlap check prevents two chicken-stews in the same week.
    const extraTags: string[] =
      category.tag === "stew" ? [pick(stewProteins, i)] : [];

    const tags = Array.from(new Set([category.tag, ...extraTags]));

    meals.push({
      _type: "mealIdea",
      _id: `mealIdea-varmmat-${String(globalIndex).padStart(4, "0")}-${slug(title)}`,
      title,
      description: `${baseName} ${side}, servert med ${sauce}.`,
      tags,
      kitchenStyle: style,
      estimatedCostPerPortion: cost,
      targetPricePerPortion: TARGET_PRICE,
      costTier: costTier(cost),
      productionComplexity: complexity(i, cost),
      nutritionScore: Math.min(10, 6 + (i % 5)),
      season: seasons(i),
      allergens: allergensFor(category.tag, category.isFish, i),
      isFishDish: category.isFish,
      isSoup: category.isSoup,
      isVegetarian: category.isVeg, // ← now set correctly for all categories
      isActive: true,
      usageCount: 0,
    });

    globalIndex += 1;
  }
}

if (meals.length !== TOTAL) {
  throw new Error(`Forventet ${TOTAL} retter, fikk ${meals.length}`);
}

// ─── Sanity check ─────────────────────────────────────────────────────────────

const vegCount = meals.filter((m) => m.isVegetarian).length;
const fishCount = meals.filter((m) => m.isFishDish).length;
const soupCount = meals.filter((m) => m.isSoup).length;

console.log(`Vegetar: ${vegCount} | Fisk: ${fishCount} | Suppe: ${soupCount}`);

if (vegCount === 0) throw new Error("Ingen vegetarretter — sjekk isVeg-flagget.");
if (fishCount === 0) throw new Error("Ingen fiskeretter — sjekk isFish-flagget.");
if (soupCount === 0) throw new Error("Ingen supper — sjekk isSoup-flagget.");

// ─── Write ────────────────────────────────────────────────────────────────────

const outPath = path.join(process.cwd(), "seed", "varmmatbank-1000.ndjson");
fs.writeFileSync(outPath, meals.map((meal) => JSON.stringify(meal)).join("\n"), "utf8");

console.log(`✅ Skrev ${meals.length} varmmatretter til ${outPath}`);