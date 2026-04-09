import { DEMO_CTA_VARIANT_LABELS } from "@/lib/public/demoCtaAb/config";
import { inferDemoCtaFeaturesFromLabel } from "@/lib/public/demoCtaAb/inferFeatures";
import { parseDemoCtaFeatures, type DemoCtaFeatures } from "@/lib/public/demoCtaAb/types";

export type DemoCtaCatalogKind = "seed" | "generated";

export type DemoCtaCatalogEntry = {
  label: string;
  kind: DemoCtaCatalogKind;
  /** Overordnet variant teksten ble avledet fra (f.eks. vinner). */
  parent?: string;
  /** Copy features for self-learning (inferred when absent). */
  features?: DemoCtaFeatures;
  /** CTA-tekst per mønster-kontekst (`d:device|i:intent`); fallback til `label`. */
  labels_by_context?: Record<string, string>;
};

export function defaultDemoCtaSeedCatalog(): Record<string, DemoCtaCatalogEntry> {
  return {
    a: {
      label: DEMO_CTA_VARIANT_LABELS.a,
      kind: "seed",
      features: { tone: "benefit", verb: "start", framing: "result", length: "short" },
    },
    b: {
      label: DEMO_CTA_VARIANT_LABELS.b,
      kind: "seed",
      features: { tone: "direct", verb: "see", framing: "process", length: "medium" },
    },
  };
}

function isCatalogKind(v: unknown): v is DemoCtaCatalogKind {
  return v === "seed" || v === "generated";
}

/** Tolker DB-json; ved feil → null (caller bruker seed). */
export function parseDemoCtaVariantCatalog(raw: unknown): Record<string, DemoCtaCatalogEntry> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, DemoCtaCatalogEntry> = {};
  for (const [id, ent] of Object.entries(o)) {
    if (!/^(?:[ab]|g[1-9]\d{0,5})$/.test(id)) continue;
    if (!ent || typeof ent !== "object" || Array.isArray(ent)) continue;
    const e = ent as Record<string, unknown>;
    const label = typeof e.label === "string" ? e.label.trim() : "";
    if (label.length < 6 || label.length > 140) continue;
    const kind = e.kind;
    if (!isCatalogKind(kind)) continue;
    const parent = typeof e.parent === "string" && e.parent.length <= 8 ? e.parent : undefined;
    const parsedFeatures = parseDemoCtaFeatures(e.features);
    const features = parsedFeatures ?? inferDemoCtaFeaturesFromLabel(label);
    out[id] = { label, kind, features, ...(parent ? { parent } : {}) };
  }
  if (!out.a || !out.b) return null;
  return out;
}

export function resolveCatalogLabelForPatternContext(
  entry: DemoCtaCatalogEntry | undefined,
  patternCtx: string,
  fallback: string,
): string {
  const o = entry?.labels_by_context?.[patternCtx];
  if (typeof o === "string") {
    const t = o.trim();
    if (t.length >= 6) return t.slice(0, 140);
  }
  const base = entry?.label?.trim();
  if (base && base.length >= 6) return base.slice(0, 140);
  return fallback;
}

export function catalogKeysInOrder(catalog: Record<string, DemoCtaCatalogEntry>): string[] {
  const keys = Object.keys(catalog);
  const rank = (k: string) => {
    if (k === "a") return 0;
    if (k === "b") return 1;
    const m = /^g(\d+)$/.exec(k);
    return 10 + (m ? parseInt(m[1]!, 10) : 9999);
  };
  return [...keys].sort((x, y) => rank(x) - rank(y));
}
