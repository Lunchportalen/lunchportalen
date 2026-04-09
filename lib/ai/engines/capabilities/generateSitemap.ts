/**
 * Sitemap generator capability: generateSitemap.
 * Builds a sitemap structure (entries with path/url, lastmod, changefreq, priority) from a list of pages.
 * Output is consumable by Next.js MetadataRoute.Sitemap or XML generation. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "generateSitemap";

/** Sitemap change frequency (subset of sitemap spec). */
export type SitemapChangeFreq = "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";

const generateSitemapCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Sitemap generator: builds a sitemap structure from a list of pages. Returns entries with path (or full url when baseUrl given), lastmod, changefreq, priority. Output is consumable by Next.js sitemap or XML. Deterministic; no LLM.",
  requiredContext: ["pages"],
  inputSchema: {
    type: "object",
    description: "Generate sitemap input",
    properties: {
      pages: {
        type: "array",
        description: "Pages to include (path, optional lastmod, changefreq, priority)",
        items: {
          type: "object",
          required: ["path"],
          properties: {
            path: { type: "string", description: "Page path (e.g. /, /om-oss)" },
            lastmod: { type: "string", description: "Optional ISO date or 'auto'" },
            changefreq: {
              type: "string",
              description: "Optional: always | hourly | daily | weekly | monthly | yearly | never",
            },
            priority: { type: "number", description: "Optional 0-1 (default by path: home 1, rest 0.8)" },
            isIndexable: { type: "boolean", description: "If false, exclude from sitemap (default true)" },
          },
        },
      },
      baseUrl: { type: "string", description: "Optional base URL to build full urls (e.g. https://example.com)" },
      locale: { type: "string", description: "Locale (nb | en) for summary" },
      defaultChangefreq: {
        type: "string",
        description: "Default changefreq when not set per page (default weekly)",
      },
      maxEntries: { type: "number", description: "Max entries (default 500)" },
    },
    required: ["pages"],
  },
  outputSchema: {
    type: "object",
    description: "Generated sitemap",
    required: ["entries", "summary"],
    properties: {
      entries: {
        type: "array",
        description: "Sitemap entries (loc/url, lastmod, changefreq, priority)",
        items: {
          type: "object",
          required: ["path", "changefreq", "priority"],
          properties: {
            path: { type: "string" },
            url: { type: "string", description: "Full URL when baseUrl was provided" },
            lastmod: { type: "string", description: "ISO date string" },
            changefreq: { type: "string" },
            priority: { type: "number" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is sitemap data only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(generateSitemapCapability);

export type GenerateSitemapPageInput = {
  path: string;
  lastmod?: string | "auto" | null;
  changefreq?: SitemapChangeFreq | string | null;
  priority?: number | null;
  isIndexable?: boolean | null;
};

export type GenerateSitemapInput = {
  pages: GenerateSitemapPageInput[];
  baseUrl?: string | null;
  locale?: "nb" | "en" | null;
  defaultChangefreq?: SitemapChangeFreq | string | null;
  maxEntries?: number | null;
};

export type SitemapEntry = {
  path: string;
  url?: string | null;
  lastmod: string;
  changefreq: SitemapChangeFreq;
  priority: number;
};

export type GenerateSitemapOutput = {
  entries: SitemapEntry[];
  summary: string;
  generatedAt: string;
};

const CHANGEFREQ_VALID: Set<string> = new Set([
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
]);

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeChangefreq(v: unknown, defaultVal: SitemapChangeFreq): SitemapChangeFreq {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return (CHANGEFREQ_VALID.has(s) ? s : defaultVal) as SitemapChangeFreq;
}

function normalizePriority(v: unknown, path: string): number {
  const n = typeof v === "number" && !Number.isNaN(v) ? v : undefined;
  if (n !== undefined && n >= 0 && n <= 1) return Math.round(n * 100) / 100;
  const norm = path.replace(/\/$/, "") || "/";
  return norm === "/" ? 1 : 0.8;
}

function normalizeLastmod(v: unknown): string {
  if (v === "auto" || v == null) return new Date().toISOString().slice(0, 10);
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return new Date().toISOString().slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

/**
 * Generates sitemap entries from page list. Deterministic; no external calls.
 */
export function generateSitemap(input: GenerateSitemapInput): GenerateSitemapOutput {
  const locale = input.locale === "en" ? "en" : "nb";
  const isEn = locale === "en";
  const baseUrl = safeStr(input.baseUrl).replace(/\/$/, "");
  const defaultChangefreq = normalizeChangefreq(input.defaultChangefreq ?? "weekly", "weekly");
  const maxEntries = Math.min(5000, Math.max(1, Math.floor(Number(input.maxEntries) ?? 500)));

  const raw = Array.isArray(input.pages)
    ? input.pages.filter(
        (p): p is GenerateSitemapPageInput =>
          p != null && typeof p === "object" && typeof (p as GenerateSitemapPageInput).path === "string"
      )
    : [];

  const seen = new Set<string>();
  const entries: SitemapEntry[] = [];

  for (const p of raw) {
    if (entries.length >= maxEntries) break;
    const path = safeStr(p.path) || "/";
    const normPath = path.startsWith("/") ? path : `/${path}`;
    const pathKey = normPath.replace(/\/$/, "") || "/";
    if (seen.has(pathKey)) continue;
    if (p.isIndexable === false) continue;
    seen.add(pathKey);

    const lastmod = normalizeLastmod(p.lastmod);
    const changefreq = normalizeChangefreq(p.changefreq, defaultChangefreq);
    const priority = normalizePriority(p.priority, pathKey);

    const entry: SitemapEntry = {
      path: pathKey,
      lastmod,
      changefreq,
      priority,
    };
    if (baseUrl) {
      entry.url = `${baseUrl}${pathKey === "/" ? "" : pathKey}`;
    }
    entries.push(entry);
  }

  entries.sort((a, b) => {
    if (a.path === "/") return -1;
    if (b.path === "/") return 1;
    return a.path.localeCompare(b.path, "en");
  });

  const summary = isEn
    ? `Sitemap: ${entries.length} entry(ies). ${baseUrl ? "Full URLs included." : "Paths only (set baseUrl for full URLs)."}`
    : `Sitemap: ${entries.length} oppføring(er). ${baseUrl ? "Fulle URL-er inkludert." : "Kun stier (angi baseUrl for fulle URL-er)."}`;

  return {
    entries,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { generateSitemapCapability, CAPABILITY_NAME };
