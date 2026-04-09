/**
 * Soft migration: legacy `block.type` values → enterprise registry types rendered only via
 * {@link EnterpriseLockedBlockView} (through renderBlock → EnterpriseLockedBlockBridge).
 *
 * - Persisted JSON keeps original `type` until editors migrate explicitly.
 * - `richText` maps to `rich_text` (not `text_block`) because DB + canvas use `heading`/`body`.
 */

/** Legacy public/editor block.type → registry token consumed by EnterpriseLockedBlockView. */
export const LEGACY_TO_REGISTRY: Readonly<Record<string, string>> = {
  hero: "hero_bleed",
  /** Same semantic slot as `text_block`, but field names match persisted richText + canvas patches. */
  richText: "rich_text",
  cta: "cta_block",
  hero_full: "hero_split",
  image: "image_block",
  banner: "banner",
  testimonial: "testimonial_block",
  form: "form_embed",
  relatedLinks: "related_links",
  divider: "section_divider",
  cards: "feature_grid",
  pricing: "pricing_table",
  grid: "grid_3",
};

/**
 * Resolves registry type from a legacy/editor `block.type` plus optional `data` (for zigzag FAQ).
 */
export function resolveRegistryTypeFromLegacy(type: string, data: Record<string, unknown>): string {
  const t = typeof type === "string" ? type.trim() : "";
  if (!t) return type;
  if (t === "zigzag") {
    return String(data.presentation ?? "").toLowerCase() === "faq" ? "faq_block" : "zigzag_block";
  }
  return LEGACY_TO_REGISTRY[t] ?? t;
}

/** @deprecated Prefer {@link resolveRegistryTypeFromLegacy} with data when type is ambiguous. */
export function mapLegacyBlockTypeToRegistry(type: string): string {
  return resolveRegistryTypeFromLegacy(type, {});
}

function copyData(data: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const d = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  return { ...d };
}

/**
 * Adapt in-memory data when legacy type maps to a registry type with a different field contract.
 */
export function adaptLegacyBlockDataForRegistry(
  originalType: string,
  registryType: string,
  data: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (originalType === registryType) {
    const same = copyData(data);
    if (originalType === "feature_grid") {
      if (same.cardMode == null || String(same.cardMode).trim() === "") same.cardMode = "feature";
      if (same.c1Label == null) same.c1Label = "";
      if (same.c1Href == null) same.c1Href = "";
      if (same.c2Label == null) same.c2Label = "";
      if (same.c2Href == null) same.c2Href = "";
      for (const k of ["f1Kicker", "f1LinkLabel", "f1LinkHref", "f2Kicker", "f2LinkLabel", "f2LinkHref", "f3Kicker", "f3LinkLabel", "f3LinkHref"] as const) {
        if (same[k] == null) same[k] = "";
      }
      return same;
    }
    if (originalType === "pricing_table") {
      if (same.subtitle == null) same.subtitle = "";
      if (same.p1Subtitle == null) same.p1Subtitle = "";
      if (same.p1Badge == null) same.p1Badge = "";
      if (same.p1Period == null) same.p1Period = "";
      if (same.p1CtaLabel == null) same.p1CtaLabel = "";
      if (same.p1CtaHref == null) same.p1CtaHref = "";
      if (same.p1Highlight == null) same.p1Highlight = "no";
      if (same.p2Subtitle == null) same.p2Subtitle = "";
      if (same.p2Badge == null) same.p2Badge = "";
      if (same.p2Period == null) same.p2Period = "";
      if (same.p2CtaLabel == null) same.p2CtaLabel = "";
      if (same.p2CtaHref == null) same.p2CtaHref = "";
      if (same.p2Highlight == null) same.p2Highlight = "no";
      return same;
    }
    return same;
  }

  const out = copyData(data);

  if (originalType === "hero" && registryType === "hero_bleed") {
    if (out.ctaPrimary == null && out.ctaLabel != null) out.ctaPrimary = out.ctaLabel;
    if (out.ctaPrimaryHref == null && out.ctaHref != null) out.ctaPrimaryHref = out.ctaHref;
    return out;
  }

  if (originalType === "cta" && registryType === "cta_block") {
    if (out.ctaLabel == null && out.buttonLabel != null) out.ctaLabel = out.buttonLabel;
    if (out.ctaHref == null) {
      if (typeof out.href === "string") out.ctaHref = out.href;
      else if (typeof out.buttonHref === "string") out.ctaHref = out.buttonHref;
    }
    if (out.secondaryCtaLabel == null && out.secondaryButtonLabel != null) {
      out.secondaryCtaLabel = out.secondaryButtonLabel;
    }
    if (out.secondaryCtaHref == null && out.secondaryButtonHref != null) {
      out.secondaryCtaHref = out.secondaryButtonHref;
    }
    return out;
  }

  if (originalType === "testimonial" && registryType === "testimonial_block") {
    if ((out.quote == null || out.quote === "") && out.text != null) out.quote = out.text;
    if ((out.author == null || out.author === "") && out.title != null) out.author = out.title;
    if ((out.role == null || out.role === "") && out.subtitle != null) out.role = out.subtitle;
    return out;
  }

  if (originalType === "cards" && registryType === "feature_grid") {
    const items = Array.isArray(out.items) ? out.items : [];
    const pick = (i: number) => {
      const raw = items[i];
      const item =
        raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      return {
        t: typeof item.title === "string" ? item.title : "",
        b: typeof item.text === "string" ? item.text : "",
        k: typeof item.kicker === "string" ? item.kicker : "",
        ll: typeof item.linkLabel === "string" ? item.linkLabel : "",
        lh: typeof item.linkHref === "string" ? item.linkHref : "",
      };
    };
    const a0 = pick(0);
    const a1 = pick(1);
    const a2 = pick(2);
    out.f1Title = a0.t;
    out.f1Body = a0.b;
    out.f1Kicker = a0.k;
    out.f1LinkLabel = a0.ll;
    out.f1LinkHref = a0.lh;
    out.f2Title = a1.t;
    out.f2Body = a1.b;
    out.f2Kicker = a1.k;
    out.f2LinkLabel = a1.ll;
    out.f2LinkHref = a1.lh;
    out.f3Title = a2.t;
    out.f3Body = a2.b;
    out.f3Kicker = a2.k;
    out.f3LinkLabel = a2.ll;
    out.f3LinkHref = a2.lh;
    if (typeof out.text === "string") out.subtitle = out.text;
    const pres = String(out.presentation ?? "").toLowerCase();
    out.cardMode = pres === "plain" ? "plain" : "feature";
    const ctaList = Array.isArray(out.cta) ? out.cta : [];
    const c0 =
      ctaList[0] && typeof ctaList[0] === "object" && !Array.isArray(ctaList[0])
        ? (ctaList[0] as Record<string, unknown>)
        : {};
    const c1 =
      ctaList[1] && typeof ctaList[1] === "object" && !Array.isArray(ctaList[1])
        ? (ctaList[1] as Record<string, unknown>)
        : {};
    out.c1Label = typeof c0.label === "string" ? c0.label : "";
    out.c1Href = typeof c0.href === "string" ? c0.href : "";
    out.c2Label = typeof c1.label === "string" ? c1.label : "";
    out.c2Href = typeof c1.href === "string" ? c1.href : "";
    delete out.items;
    delete out.text;
    delete out.presentation;
    delete out.cta;
    return out;
  }

  if (originalType === "grid" && registryType === "grid_3") {
    const items = Array.isArray(out.items) ? out.items : [];
    const pick = (i: number) => {
      const raw = items[i];
      const item =
        raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      const src =
        typeof item.src === "string" && item.src.trim() ?
          item.src.trim()
        : typeof item.image === "string" && item.image.trim() ?
          item.image.trim()
        : typeof item.imageId === "string" && item.imageId.trim() ?
          item.imageId.trim()
        : "";
      return {
        title: typeof item.title === "string" ? item.title : "",
        src,
        subtitle: typeof item.subtitle === "string" ? item.subtitle : "",
        metaLine: typeof item.metaLine === "string" ? item.metaLine : "",
      };
    };
    const a0 = pick(0);
    const a1 = pick(1);
    const a2 = pick(2);
    out.card1Title = a0.title;
    out.card1Image = a0.src;
    out.card1Subtitle = a0.subtitle;
    out.card1MetaLine = a0.metaLine;
    out.card2Title = a1.title;
    out.card2Image = a1.src;
    out.card2Subtitle = a1.subtitle;
    out.card2MetaLine = a1.metaLine;
    out.card3Title = a2.title;
    out.card3Image = a2.src;
    out.card3Subtitle = a2.subtitle;
    out.card3MetaLine = a2.metaLine;
    if (typeof out.intro === "string" && out.intro.trim()) out.subtitle = out.intro.trim();
    else if (out.subtitle == null) out.subtitle = "";
    delete out.items;
    delete out.intro;
    return out;
  }

  if (originalType === "zigzag" && registryType === "faq_block") {
    const steps = Array.isArray(out.steps) ? out.steps : [];
    const pick = (i: number) => {
      const raw = steps[i];
      const step =
        raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      return {
        q: typeof step.title === "string" ? step.title : "",
        a: typeof step.text === "string" ? step.text : "",
      };
    };
    const s0 = pick(0);
    const s1 = pick(1);
    const s2 = pick(2);
    out.sectionTitle = typeof out.title === "string" ? out.title : "";
    out.q1 = s0.q;
    out.a1 = s0.a;
    out.q2 = s1.q;
    out.a2 = s1.a;
    out.q3 = s2.q;
    out.a3 = s2.a;
    delete out.steps;
    delete out.title;
    delete out.presentation;
    return out;
  }

  if (originalType === "zigzag" && registryType === "zigzag_block") {
    const steps = Array.isArray(out.steps) ? out.steps : [];
    const normalized = steps.map((raw, idx) => {
      const step =
        raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
      const stepNum =
        typeof step.step === "string" || typeof step.step === "number" ? String(step.step) : String(idx + 1);
      const title = typeof step.title === "string" ? step.title : "";
      const text = typeof step.text === "string" ? step.text : "";
      const kicker = typeof step.kicker === "string" ? step.kicker : "";
      const imageSrc =
        typeof step.src === "string" && step.src.trim() ?
          step.src.trim()
        : typeof step.image === "string" && step.image.trim() ?
          step.image.trim()
        : typeof step.imageId === "string" && step.imageId.trim() ?
          step.imageId.trim()
        : "";
      return { step: stepNum, title, text, kicker, imageSrc: imageSrc || null };
    });
    out.zigzagSteps = JSON.stringify(normalized);
    if (typeof out.intro === "string" && out.intro.trim()) {
      out.sectionIntro = out.intro.trim();
    }
    delete out.steps;
    delete out.intro;
    delete out.presentation;
    return out;
  }

  if (originalType === "pricing" && registryType === "pricing_table") {
    const plans = Array.isArray(out.plans) ? out.plans : [];
    if (plans.length === 0) {
      out.pricingPreviewNote = "staging_empty";
      out.p1Name = "Basis";
      out.p1Subtitle = "Stabil hverdag";
      out.p1Badge = "";
      out.p1Price = "90";
      out.p1Period = "kr / kuvert";
      out.p1Bullets =
        "Selvbetjening for ansatte\nAvbestilling før kl. 08:00\nForutsigbar firmalunsj";
      out.p1CtaLabel = "Velg Basis";
      out.p1CtaHref = "/registrering";
      out.p1Highlight = "no";
      out.p2Name = "Luxus";
      out.p2Subtitle = "Mer variasjon";
      out.p2Badge = "Mest valgt";
      out.p2Price = "130";
      out.p2Period = "kr / kuvert";
      out.p2Bullets = "Høy opplevd verdi\nKontrollert flyt\nAvbestilling før kl. 08:00";
      out.p2CtaLabel = "Velg Luxus";
      out.p2CtaHref = "/registrering";
      out.p2Highlight = "yes";
      out.title =
        typeof out.title === "string" && out.title.trim() ? out.title : "To nivå – tydelig avtale";
      out.subtitle =
        typeof out.intro === "string" && out.intro.trim() ?
          out.intro
        : "Avtalen settes av firma/admin. Priser synkroniseres fra produktplaner når siden rendres på server.";
    } else {
      const p0 =
        plans[0] && typeof plans[0] === "object" && !Array.isArray(plans[0])
          ? (plans[0] as Record<string, unknown>)
          : {};
      const p1 =
        plans[1] && typeof plans[1] === "object" && !Array.isArray(plans[1])
          ? (plans[1] as Record<string, unknown>)
          : {};
      const mapPlan = (p: Record<string, unknown>) => {
        const name = typeof p.name === "string" ? p.name : "";
        const tagline =
          typeof p.tagline === "string" && p.tagline.trim() ?
            p.tagline.trim()
          : typeof p.headline === "string" && p.headline.trim() ?
            p.headline.trim()
          : "";
        const badge = typeof p.badge === "string" && p.badge.trim() ? p.badge.trim() : "";
        const price = typeof p.price === "string" ? p.price : String(p.price ?? "");
        const period = typeof p.period === "string" && p.period.trim() ? p.period.trim() : "";
        const features = Array.isArray(p.features) ? p.features : [];
        const bullets = features.map((f) => (typeof f === "string" ? f : String(f))).join("\n");
        const ctaLabel = typeof p.ctaLabel === "string" ? p.ctaLabel : "";
        const ctaHref = typeof p.ctaHref === "string" ? p.ctaHref : "/registrering";
        const featured = Boolean(p.featured);
        return { name, subtitle: tagline, badge, price, period, bullets, ctaLabel, ctaHref, featured };
      };
      const a0 = mapPlan(p0);
      const a1 = mapPlan(p1);
      out.p1Name = a0.name;
      out.p1Subtitle = a0.subtitle;
      out.p1Badge = a0.badge;
      out.p1Price = a0.price;
      out.p1Period = a0.period;
      out.p1Bullets = a0.bullets;
      out.p1CtaLabel = a0.ctaLabel;
      out.p1CtaHref = a0.ctaHref;
      out.p1Highlight = a0.featured ? "yes" : "no";
      out.p2Name = a1.name;
      out.p2Subtitle = a1.subtitle;
      out.p2Badge = a1.badge;
      out.p2Price = a1.price;
      out.p2Period = a1.period;
      out.p2Bullets = a1.bullets;
      out.p2CtaLabel = a1.ctaLabel;
      out.p2CtaHref = a1.ctaHref;
      out.p2Highlight = a1.featured ? "yes" : "no";
      if (plans.length < 2) {
        out.p2Name = "";
        out.p2Subtitle = "";
        out.p2Badge = "";
        out.p2Price = "";
        out.p2Period = "";
        out.p2Bullets = "";
        out.p2CtaLabel = "";
        out.p2CtaHref = "";
        out.p2Highlight = "no";
      }
      out.subtitle = typeof out.intro === "string" ? out.intro : "";
    }
    if (typeof out.footnote === "string" && out.footnote.trim()) {
      out.pricingFootnote = out.footnote.trim();
    }
    delete out.plans;
    delete out.intro;
    delete out.footnote;
    return out;
  }

  if (originalType === "relatedLinks" && registryType === "related_links") {
    const tags = Array.isArray(out.tags) ? out.tags : [];
    out.tagLines = tags.map((t) => String(t)).join("\n");
    out.currentPath =
      typeof out.currentPath === "string" && out.currentPath.trim() ? out.currentPath.trim() : "/";
    if (out.title == null) out.title = "";
    if (out.subtitle == null) out.subtitle = "";
    if (typeof out.emptyFallbackText === "string" && out.emptyFallbackText.trim()) {
      out.relatedEmptyFallback = out.emptyFallbackText.trim();
    }
    if (typeof out.maxSuggestions === "number" && Number.isFinite(out.maxSuggestions)) {
      const n = Math.round(out.maxSuggestions);
      if (n >= 1 && n <= 12) out.relatedMaxItems = n;
    }
    delete out.tags;
    delete out.emptyFallbackText;
    delete out.maxSuggestions;
    return out;
  }

  if (originalType === "divider" && registryType === "section_divider") {
    return { variant: typeof out.variant === "string" ? out.variant : "center" };
  }

  return out;
}

/**
 * Returns adapted block `data` for the enterprise renderer (registry field contract).
 */
export function adaptLegacyData(block: {
  type: string;
  data?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const originalType = typeof block.type === "string" ? block.type.trim() : "";
  const draft = copyData(block.data);
  const registryType = resolveRegistryTypeFromLegacy(originalType, draft);
  return adaptLegacyBlockDataForRegistry(originalType, registryType, draft);
}

export type VisualCanvasPatchHandler = {
  onPatch: (patch: Record<string, unknown>) => void;
};

/**
 * Hero canvas emits `ctaPrimary` / `ctaPrimaryHref`; legacy `hero` rows use `ctaLabel` / `ctaHref`.
 */
export function wrapVisualCanvasPatchForLegacyMigration(
  originalType: string,
  resolvedType: string,
  visual: VisualCanvasPatchHandler | null,
): VisualCanvasPatchHandler | null {
  if (!visual) return null;
  if (originalType === "hero" && resolvedType === "hero_bleed") {
    return {
      onPatch: (patch) => {
        const p = { ...patch };
        if ("ctaPrimary" in p) p.ctaLabel = p.ctaPrimary;
        if ("ctaPrimaryHref" in p) p.ctaHref = p.ctaPrimaryHref;
        visual.onPatch(p);
      },
    };
  }
  return visual;
}

export function resolveBlockForEnterpriseRender(block: {
  type: string;
  data?: Record<string, unknown> | null;
}): { originalType: string; registryType: string; data: Record<string, unknown> } {
  const originalType = typeof block.type === "string" ? block.type.trim() : "";
  const draft = copyData(block.data);
  const registryType = resolveRegistryTypeFromLegacy(originalType, draft);
  const data = adaptLegacyBlockDataForRegistry(originalType, registryType, draft);
  return { originalType, registryType, data };
}
