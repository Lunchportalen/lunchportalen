/**
 * Product comparison generator capability: generateProductComparison.
 * Builds a structured product comparison (criteria × products) from a list of products
 * with name, price, features, description. Output is table-ready (rows/columns) and optional summary.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "generateProductComparison";

const generateProductComparisonCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Product comparison generator: builds a structured comparison from a list of products (name, price, features, description). Returns criteria rows, product columns, value matrix, and optional summary. Table-ready; deterministic; no LLM.",
  requiredContext: ["products"],
  inputSchema: {
    type: "object",
    description: "Generate product comparison input",
    properties: {
      products: {
        type: "array",
        description: "Products to compare (name, optional price, features, description, category)",
        items: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "string", description: "e.g. 299 kr/mnd" },
            features: { type: "array", items: { type: "string" } },
            category: { type: "string" },
          },
        },
      },
      criteria: {
        type: "array",
        description: "Optional comparison criteria (default: name, price, description, features)",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for labels and summary" },
      includeSummary: { type: "boolean", description: "Include short comparison summary (default true)" },
    },
    required: ["products"],
  },
  outputSchema: {
    type: "object",
    description: "Generated product comparison",
    required: ["productNames", "criteria", "rows", "summary"],
    properties: {
      productNames: { type: "array", items: { type: "string" }, description: "Product names (column order)" },
      criteria: { type: "array", items: { type: "string" }, description: "Comparison criteria (row order)" },
      rows: {
        type: "array",
        description: "One row per criterion; values align with productNames",
        items: {
          type: "object",
          required: ["criterion", "values"],
          properties: {
            criterion: { type: "string" },
            values: { type: "array", items: { type: "string" } },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is comparison data only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateProductComparisonCapability);

export type ProductComparisonItem = {
  name: string;
  description?: string | null;
  price?: string | null;
  features?: string[] | null;
  category?: string | null;
};

export type GenerateProductComparisonInput = {
  products: ProductComparisonItem[];
  criteria?: string[] | null;
  locale?: "nb" | "en" | null;
  includeSummary?: boolean | null;
};

export type ComparisonRow = {
  criterion: string;
  values: string[];
};

export type GenerateProductComparisonOutput = {
  productNames: string[];
  criteria: string[];
  rows: ComparisonRow[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const CRITERION_KEYS = ["price", "description", "features", "category"] as const;
const CRITERION_LABEL: Record<string, { en: string; nb: string }> = {
  price: { en: "Price", nb: "Pris" },
  description: { en: "Description", nb: "Beskrivelse" },
  features: { en: "Features", nb: "Funksjoner" },
  category: { en: "Category", nb: "Kategori" },
};

/**
 * Generates a product comparison (criteria × products). Deterministic; no external calls.
 */
export function generateProductComparison(input: GenerateProductComparisonInput): GenerateProductComparisonOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const includeSummary = input.includeSummary !== false;

  const products = Array.isArray(input.products)
    ? input.products
        .filter(
          (p): p is ProductComparisonItem =>
            p != null && typeof p === "object" && typeof (p as ProductComparisonItem).name === "string"
        )
        .slice(0, 10)
    : [];

  const productNames = products.map((p) => safeStr(p.name) || (isEn ? "Product" : "Produkt"));

  const criteriaOrder = Array.isArray(input.criteria) && input.criteria.length > 0
    ? input.criteria.filter((c) => typeof c === "string" && (c as string).trim()).map((c) => (c as string).trim().toLowerCase())
    : [...CRITERION_KEYS];

  const criteria = [...new Set(criteriaOrder)];
  const rows: ComparisonRow[] = [];

  for (const crit of criteria) {
    const label = CRITERION_LABEL[crit] ? (isEn ? CRITERION_LABEL[crit].en : CRITERION_LABEL[crit].nb) : crit;
    const values: string[] = [];

    for (const p of products) {
      if (crit === "price") {
        values.push(safeStr(p.price) || "–");
      } else if (crit === "description") {
        values.push(safeStr(p.description) || "–");
      } else if (crit === "features") {
        const feats = Array.isArray(p.features) ? p.features.filter((f) => typeof f === "string").join(", ") : "";
        values.push(feats || "–");
      } else if (crit === "category") {
        values.push(safeStr(p.category) || "–");
      } else {
        const val = (p as Record<string, unknown>)[crit];
        values.push(val != null && typeof val === "string" ? val : typeof val === "number" ? String(val) : "–");
      }
    }

    rows.push({ criterion: label, values });
  }

  let summary = "";
  if (includeSummary) {
    summary = isEn
      ? `Comparison of ${productNames.length} product(s) on ${rows.length} criteria. Use rows for table or list layout.`
      : `Sammenligning av ${productNames.length} produkt(er) på ${rows.length} kriterier. Bruk rader for tabell eller liste.`;
  }

  return {
    productNames,
    criteria: rows.map((r) => r.criterion),
    rows,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateProductComparisonCapability, CAPABILITY_NAME };
