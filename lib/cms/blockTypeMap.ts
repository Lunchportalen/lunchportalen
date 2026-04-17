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
  /**
   * Umbraco Delivery / mainContent element aliases → enterprise registry (public render parity).
   * Source types stay on persisted rows until migrated; mapping is in-memory at render.
   */
  heroBannerBlock: "hero_bleed",
  textBlock: "rich_text",
  accordionOrTab: "accordion_tabs",
  alertBox: "alert_bar",
  anchorNavigation: "anchor_navigation",
  banners: "banner_carousel",
  codeBlock: "code_block",
  dualPromoCardsBlock: "dual_promo_cards",
  /** Umbraco Block List element aliases when persisted as legacy `block.type` (Delivery parity). */
  sectionIntro: "section_intro",
  logoCloud: "logo_cloud",
  statsBlock: "stats_block",
  testimonialBlock: "testimonial_block",
  quoteBlock: "quote_block",
  newsletterSignup: "newsletter_signup",
  formEmbed: "form_embed",
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

/** Strip tags for safe plain-text fields (Umbraco often stores TinyMCE HTML). */
function htmlToPlainTextForUmbracoBlock(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
    if (originalType === "anchor_navigation") {
      if (!Array.isArray(same.links)) same.links = [];
      if (typeof same.itemsJson !== "string" || !String(same.itemsJson).trim()) {
        same.itemsJson = JSON.stringify(same.links);
      }
      if (same.title == null) same.title = "";
      if (same.linkStyle == null || String(same.linkStyle).trim() === "") same.linkStyle = "pills";
      if (same.navigationAlignment == null || String(same.navigationAlignment).trim() === "") {
        same.navigationAlignment = "center";
      }
      if (same.mobileStyle == null || String(same.mobileStyle).trim() === "") {
        same.mobileStyle = "horizontal-scroll";
      }
      return same;
    }
    if (originalType === "accordion_tabs") {
      if (!Array.isArray(same.items)) same.items = [];
      if (typeof same.itemsJson !== "string" || !String(same.itemsJson).trim()) {
        same.itemsJson = JSON.stringify(same.items);
      }
      if (same.sectionTitle == null) same.sectionTitle = "";
      if (same.displayMode == null || String(same.displayMode).trim() === "") same.displayMode = "accordion";
      if (same.defaultOpenIndex == null) same.defaultOpenIndex = "0";
      if (same.rememberOpen == null) same.rememberOpen = "false";
      return same;
    }
    if (originalType === "banner_carousel") {
      if (!Array.isArray(same.slides)) same.slides = [];
      if (typeof same.slidesJson !== "string" || !String(same.slidesJson).trim()) {
        same.slidesJson = JSON.stringify(same.slides);
      }
      if (same.disableCarousel == null) same.disableCarousel = false;
      if (same.showArrows == null) same.showArrows = true;
      if (same.showDots == null) same.showDots = true;
      if (same.autoRotateMs == null) same.autoRotateMs = 0;
      if (same.shuffleOnLoad == null) same.shuffleOnLoad = false;
      return same;
    }
    if (originalType === "dual_promo_cards") {
      if (!Array.isArray(same.cards)) same.cards = [];
      if (typeof same.cardsJson !== "string" || !String(same.cardsJson).trim()) {
        same.cardsJson = JSON.stringify(same.cards);
      }
      if (same.sectionId == null) same.sectionId = "";
      if (same.maxWidthVariant == null) same.maxWidthVariant = "";
      return same;
    }
    if (originalType === "section_intro") {
      if (same.eyebrow == null) same.eyebrow = "";
      if (same.title == null) same.title = "";
      if (same.lede == null) same.lede = "";
      const cw = String(same.contentWidth ?? "").toLowerCase();
      same.contentWidth =
        cw === "wide" ? "wide"
        : cw === "normal" ? "normal"
        : "narrow";
      return same;
    }
    if (originalType === "logo_cloud") {
      if (same.title == null) same.title = "";
      type LogoRow = { id: string; image: string; label: string; href: string };
      let logos: LogoRow[] = [];
      if (Array.isArray(same.logos)) {
        const raw = same.logos as unknown[];
        logos = raw
          .map((row, idx) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) return null;
            const o = row as Record<string, unknown>;
            const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `logo-${idx}`;
            const image =
              (typeof o.image === "string" && o.image.trim() && o.image) ||
              (typeof o.src === "string" && o.src.trim() && o.src) ||
              (typeof o.imageUrl === "string" && o.imageUrl.trim() && o.imageUrl) ||
              "";
            if (!image) return null;
            return {
              id,
              image,
              label: typeof o.label === "string" ? o.label : "",
              href: typeof o.href === "string" ? o.href : "",
            };
          })
          .filter((x): x is LogoRow => x != null);
      }
      if (logos.length === 0 && typeof same.logosJson === "string" && same.logosJson.trim()) {
        try {
          const parsed = JSON.parse(same.logosJson) as unknown;
          if (Array.isArray(parsed)) {
            logos = parsed
              .map((row, idx) => {
                if (!row || typeof row !== "object" || Array.isArray(row)) return null;
                const o = row as Record<string, unknown>;
                const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `logo-${idx}`;
                const image =
                  (typeof o.image === "string" && o.image.trim() && o.image) ||
                  (typeof o.src === "string" && o.src.trim() && o.src) ||
                  (typeof o.imageUrl === "string" && o.imageUrl.trim() && o.imageUrl) ||
                  "";
                if (!image) return null;
                return {
                  id,
                  image,
                  label: typeof o.label === "string" ? o.label : "",
                  href: typeof o.href === "string" ? o.href : "",
                };
              })
              .filter((x): x is LogoRow => x != null);
          }
        } catch {
          logos = [];
        }
      }
      if (logos.length === 0) {
        for (let n = 1; n <= 4; n++) {
          const key = `l${n}`;
          const src = typeof same[key] === "string" ? (same[key] as string).trim() : "";
          if (src) logos.push({ id: `logo-${n}`, image: src, label: "", href: "" });
        }
      }
      same.logos = logos;
      same.logosJson = JSON.stringify(logos);
      const den = String(same.density ?? "").toLowerCase();
      same.density = den === "compact" || den === "airy" ? den : "comfortable";
      return same;
    }
    if (originalType === "stats_block") {
      if (same.title == null) same.title = "";
      type KpiRow = { id: string; value: string; label: string; subtext: string; icon: string; emphasis: boolean };
      const parseBool = (v: unknown): boolean => {
        if (v === true) return true;
        const x = String(v ?? "").toLowerCase().trim();
        return x === "true" || x === "1" || x === "yes" || x === "highlight";
      };
      let kpis: KpiRow[] = [];
      if (Array.isArray(same.kpis)) {
        const raw = same.kpis as unknown[];
        kpis = raw
          .map((row, idx) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) return null;
            const o = row as Record<string, unknown>;
            const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `kpi-${idx}`;
            const value = typeof o.value === "string" ? o.value : "";
            const label = typeof o.label === "string" ? o.label : "";
            if (!value.trim() && !label.trim()) return null;
            return {
              id,
              value,
              label,
              subtext: typeof o.subtext === "string" ? o.subtext : "",
              icon: typeof o.icon === "string" ? o.icon : "",
              emphasis: parseBool(o.emphasis ?? o.highlight),
            };
          })
          .filter((x): x is KpiRow => x != null);
      }
      if (kpis.length === 0 && typeof same.kpisJson === "string" && same.kpisJson.trim()) {
        try {
          const parsed = JSON.parse(same.kpisJson) as unknown;
          if (Array.isArray(parsed)) {
            kpis = parsed
              .map((row, idx) => {
                if (!row || typeof row !== "object" || Array.isArray(row)) return null;
                const o = row as Record<string, unknown>;
                const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `kpi-${idx}`;
                const value = typeof o.value === "string" ? o.value : "";
                const label = typeof o.label === "string" ? o.label : "";
                if (!value.trim() && !label.trim()) return null;
                return {
                  id,
                  value,
                  label,
                  subtext: typeof o.subtext === "string" ? o.subtext : "",
                  icon: typeof o.icon === "string" ? o.icon : "",
                  emphasis: parseBool(o.emphasis ?? o.highlight),
                };
              })
              .filter((x): x is KpiRow => x != null);
          }
        } catch {
          kpis = [];
        }
      }
      if (kpis.length === 0) {
        for (let n = 1; n <= 3; n++) {
          const vk = `s${n}Value`;
          const lk = `s${n}Label`;
          const value = typeof same[vk] === "string" ? (same[vk] as string) : "";
          const label = typeof same[lk] === "string" ? (same[lk] as string) : "";
          if (!value.trim() && !label.trim()) continue;
          kpis.push({
            id: `kpi-${n}`,
            value,
            label,
            subtext: "",
            icon: "",
            emphasis: false,
          });
        }
      }
      same.kpis = kpis;
      same.kpisJson = JSON.stringify(kpis);
      const den = String(same.density ?? "").toLowerCase();
      same.density = den === "compact" || den === "airy" ? den : "comfortable";
      const col = String(same.columns ?? "").trim();
      same.columns = col === "2" || col === "4" ? col : "3";
      return same;
    }
    if (originalType === "quote_block") {
      if (same.quote == null) same.quote = "";
      if (same.author == null) same.author = "";
      if (same.role == null) same.role = "";
      if (same.source == null) same.source = "";
      if (typeof same.body === "string" && same.body.trim() && !String(same.quote ?? "").trim()) {
        same.quote = same.body;
      }
      if (typeof same.title === "string" && same.title.trim() && !String(same.author ?? "").trim()) {
        same.author = same.title;
      }
      const cw = String(same.contentWidth ?? "").toLowerCase();
      same.contentWidth =
        cw === "wide" ? "wide"
        : cw === "normal" ? "normal"
        : "narrow";
      return same;
    }
    if (originalType === "newsletter_signup") {
      if (same.eyebrow == null) same.eyebrow = "";
      if (same.title == null) same.title = "";
      if (same.lede == null) same.lede = "";
      if (typeof same.body === "string" && same.body.trim() && !String(same.lede ?? "").trim()) {
        same.lede = same.body;
      }
      if (same.ctaLabel == null) same.ctaLabel = "";
      if (same.ctaHref == null) same.ctaHref = "";
      if (same.disclaimer == null) same.disclaimer = "";
      const sm = String(same.submitMethod ?? "").toLowerCase();
      same.submitMethod = sm === "post" ? "post" : "get";
      const cw = String(same.contentWidth ?? "").toLowerCase();
      same.contentWidth =
        cw === "wide" ? "wide"
        : cw === "normal" ? "normal"
        : "narrow";
      return same;
    }
    if (originalType === "form_embed") {
      if (same.formId == null) same.formId = "";
      if (same.iframeSrc == null) same.iframeSrc = "";
      if (same.title == null) same.title = "";
      if (same.lede == null) same.lede = "";
      if (same.embedHtml == null) same.embedHtml = "";
      const cw = String(same.contentWidth ?? "").toLowerCase();
      same.contentWidth =
        cw === "wide" ? "wide"
        : cw === "narrow" ? "narrow"
        : "normal";
      return same;
    }
    if (originalType === "testimonial_block") {
      if (same.sectionTitle == null) same.sectionTitle = "";
      type TRow = {
        id: string;
        quote: string;
        author: string;
        role: string;
        company: string;
        image: string;
        alt: string;
        logo: string;
      };
      let rows: TRow[] = [];
      if (Array.isArray(same.testimonials)) {
        const raw = same.testimonials as unknown[];
        rows = raw
          .map((row, idx) => {
            if (!row || typeof row !== "object" || Array.isArray(row)) return null;
            const o = row as Record<string, unknown>;
            const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `t-${idx}`;
            const quote = typeof o.quote === "string" ? o.quote : "";
            if (!quote.trim()) return null;
            const image =
              (typeof o.image === "string" && o.image.trim() && o.image) ||
              (typeof o.src === "string" && o.src.trim() && o.src) ||
              (typeof o.imageUrl === "string" && o.imageUrl.trim() && o.imageUrl) ||
              "";
            return {
              id,
              quote,
              author: typeof o.author === "string" ? o.author : "",
              role: typeof o.role === "string" ? o.role : "",
              company: typeof o.company === "string" ? o.company : typeof o.source === "string" ? o.source : "",
              image,
              alt: typeof o.alt === "string" ? o.alt : "",
              logo:
                (typeof o.logo === "string" && o.logo.trim() && o.logo) ||
                (typeof o.logoUrl === "string" && o.logoUrl.trim() && o.logoUrl) ||
                "",
            };
          })
          .filter((x): x is TRow => x != null);
      }
      if (rows.length === 0 && typeof same.testimonialsJson === "string" && same.testimonialsJson.trim()) {
        try {
          const parsed = JSON.parse(same.testimonialsJson) as unknown;
          if (Array.isArray(parsed)) {
            rows = parsed
              .map((row, idx) => {
                if (!row || typeof row !== "object" || Array.isArray(row)) return null;
                const o = row as Record<string, unknown>;
                const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `t-${idx}`;
                const quote = typeof o.quote === "string" ? o.quote : "";
                if (!quote.trim()) return null;
                const image =
                  (typeof o.image === "string" && o.image.trim() && o.image) ||
                  (typeof o.src === "string" && o.src.trim() && o.src) ||
                  (typeof o.imageUrl === "string" && o.imageUrl.trim() && o.imageUrl) ||
                  "";
                return {
                  id,
                  quote,
                  author: typeof o.author === "string" ? o.author : "",
                  role: typeof o.role === "string" ? o.role : "",
                  company: typeof o.company === "string" ? o.company : typeof o.source === "string" ? o.source : "",
                  image,
                  alt: typeof o.alt === "string" ? o.alt : "",
                  logo:
                    (typeof o.logo === "string" && o.logo.trim() && o.logo) ||
                    (typeof o.logoUrl === "string" && o.logoUrl.trim() && o.logoUrl) ||
                    "",
                };
              })
              .filter((x): x is TRow => x != null);
          }
        } catch {
          rows = [];
        }
      }
      if (rows.length === 0) {
        const quote = typeof same.quote === "string" ? same.quote : "";
        const author = typeof same.author === "string" ? same.author : "";
        const role = typeof same.role === "string" ? same.role : "";
        const image =
          (typeof same.image === "string" && same.image.trim() && same.image) ||
          (typeof same.src === "string" && same.src.trim() && same.src) ||
          (typeof same.imageUrl === "string" && same.imageUrl.trim() && same.imageUrl) ||
          "";
        if (quote.trim() || author.trim()) {
          rows.push({
            id: "t-1",
            quote,
            author,
            role,
            company: typeof same.company === "string" ? same.company : typeof same.source === "string" ? same.source : "",
            image,
            alt: typeof same.alt === "string" ? same.alt : "",
            logo:
              (typeof same.logo === "string" && same.logo.trim() && same.logo) ||
              (typeof same.logoUrl === "string" && same.logoUrl.trim() && same.logoUrl) ||
              "",
          });
        }
      }
      same.testimonials = rows;
      same.testimonialsJson = JSON.stringify(rows);
      const den = String(same.density ?? "").toLowerCase();
      same.density = den === "compact" || den === "airy" ? den : "comfortable";
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

  /** Umbraco camelCase element type persisted on block row → reuse registry same-type adapt. */
  const umbracoFirstClassBridge: Record<string, string> = {
    sectionIntro: "section_intro",
    logoCloud: "logo_cloud",
    statsBlock: "stats_block",
    testimonialBlock: "testimonial_block",
    quoteBlock: "quote_block",
    newsletterSignup: "newsletter_signup",
    formEmbed: "form_embed",
  };
  const bridgedRegistry = umbracoFirstClassBridge[originalType];
  if (bridgedRegistry && registryType === bridgedRegistry) {
    return adaptLegacyBlockDataForRegistry(bridgedRegistry, bridgedRegistry, out);
  }

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
    const quote = typeof out.quote === "string" ? out.quote : "";
    const author = typeof out.author === "string" ? out.author : "";
    const role = typeof out.role === "string" ? out.role : "";
    const img =
      (typeof out.image === "string" && out.image.trim() && out.image) ||
      (typeof out.src === "string" && out.src.trim() && out.src) ||
      (typeof out.imageUrl === "string" && out.imageUrl.trim() && out.imageUrl) ||
      "";
    const row = {
      id: "t-1",
      quote,
      author,
      role,
      company: typeof out.company === "string" ? out.company : typeof out.source === "string" ? out.source : "",
      image: img,
      alt: typeof out.alt === "string" ? out.alt : "",
      logo:
        (typeof out.logo === "string" && out.logo.trim() && out.logo) ||
        (typeof out.logoUrl === "string" && out.logoUrl.trim() && out.logoUrl) ||
        "",
    };
    out.testimonials = [row];
    out.testimonialsJson = JSON.stringify([row]);
    if (out.sectionTitle == null) out.sectionTitle = "";
    const den = String(out.density ?? "").toLowerCase();
    out.density = den === "compact" || den === "airy" ? den : "comfortable";
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

  if (originalType === "heroBannerBlock" && registryType === "hero_bleed") {
    const sublines = Array.isArray(out.sublineItems)
      ? (out.sublineItems as Array<Record<string, unknown>>)
          .map((row) => htmlToPlainTextForUmbracoBlock(row.text))
          .filter(Boolean)
      : [];
    const ql = Array.isArray(out.quickLinks)
      ? (out.quickLinks as Array<Record<string, unknown>>)
          .map((row) => {
            const label = typeof row.label === "string" ? row.label : "";
            const url = typeof row.url === "string" ? row.url : "";
            if (label && url) return `${label}: ${url}`;
            return label || url;
          })
          .filter(Boolean)
      : [];
    const subtitleParts = [
      htmlToPlainTextForUmbracoBlock(out.topbarText),
      htmlToPlainTextForUmbracoBlock(out.titleSubline),
      sublines.length ? sublines.join(" · ") : "",
      ql.length ? ql.join(" · ") : "",
      htmlToPlainTextForUmbracoBlock(out.smallNote),
    ].filter((p) => typeof p === "string" && p.trim() !== "");
    const bg =
      (typeof out.desktopImage === "string" && out.desktopImage.trim()) ||
      (typeof out.mobileImage === "string" && out.mobileImage.trim()) ||
      "";
    return {
      title: typeof out.title === "string" ? out.title : "",
      subtitle: subtitleParts.join("\n"),
      backgroundImage: bg,
      ctaPrimary: typeof out.primaryCtaLabel === "string" ? out.primaryCtaLabel : "",
      ctaPrimaryHref: typeof out.primaryCtaUrl === "string" ? out.primaryCtaUrl : "",
      variant: "center",
      textAlign: "center",
      textPosition: "center",
      overlayPosition: "center",
    };
  }

  if (originalType === "textBlock" && registryType === "rich_text") {
    const settings =
      out.umbracoSettings && typeof out.umbracoSettings === "object" && !Array.isArray(out.umbracoSettings)
        ? (out.umbracoSettings as Record<string, unknown>)
        : {};
    const name = typeof settings.name === "string" ? settings.name.trim() : "";
    return {
      heading: name,
      body: htmlToPlainTextForUmbracoBlock(out.text),
      variant: "center",
    };
  }

  if (originalType === "accordionOrTab" && registryType === "accordion_tabs") {
    const rawItems = Array.isArray(out.accordionItems) ? (out.accordionItems as Record<string, unknown>[]) : [];
    const panels = rawItems.map((row, idx) => {
      const o = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `panel-${idx}`;
      const title = typeof o.title === "string" ? o.title : "";
      const body = htmlToPlainTextForUmbracoBlock(o.body ?? "");
      return { id, title, body };
    });
    const settings =
      out.umbracoSettings && typeof out.umbracoSettings === "object" && !Array.isArray(out.umbracoSettings)
        ? (out.umbracoSettings as Record<string, unknown>)
        : {};
    const dm = String(out.displayMode ?? "").trim().toLowerCase();
    const displayMode = dm === "tabs" ? "tabs" : "accordion";
    const rawIdx = settings.componentDefaultOpenIndex;
    let defaultOpenIndex = 0;
    if (typeof rawIdx === "number" && Number.isFinite(rawIdx)) defaultOpenIndex = Math.round(rawIdx);
    else if (typeof rawIdx === "string" && rawIdx.trim()) {
      const n = parseInt(rawIdx, 10);
      if (Number.isFinite(n)) defaultOpenIndex = n;
    }
    return {
      sectionTitle: typeof out.sectionTitle === "string" ? out.sectionTitle : "",
      displayMode,
      items: panels,
      itemsJson: JSON.stringify(panels),
      defaultOpenIndex: String(defaultOpenIndex),
      rememberOpen: settings.componentRememberOpen === true ? "true" : "false",
      variant: "center",
    };
  }

  if (originalType === "alertBox" && registryType === "alert_bar") {
    return {
      text: htmlToPlainTextForUmbracoBlock(out.text),
      ctaLabel: "",
      ctaHref: "",
      variant: "center",
    };
  }

  if (originalType === "anchorNavigation" && registryType === "anchor_navigation") {
    const rawLinks = Array.isArray(out.links) ? (out.links as Record<string, unknown>[]) : [];
    const links = rawLinks.map((row, idx) => {
      const o = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `toc-${idx}`;
      return {
        id,
        label: typeof o.label === "string" ? o.label : "",
        href: typeof o.href === "string" ? o.href : "",
      };
    });
    const settings =
      out.umbracoSettings && typeof out.umbracoSettings === "object" && !Array.isArray(out.umbracoSettings)
        ? (out.umbracoSettings as Record<string, unknown>)
        : {};
    const linkStyle = typeof settings.linkStyle === "string" && settings.linkStyle.trim() ? settings.linkStyle : "pills";
    const navigationAlignment =
      typeof settings.navigationAlignment === "string" && settings.navigationAlignment.trim() ?
        settings.navigationAlignment
      : "center";
    const mobileStyle =
      typeof settings.mobileStyle === "string" && settings.mobileStyle.trim() ? settings.mobileStyle : "horizontal-scroll";
    return {
      title: typeof out.navigationTitle === "string" ? out.navigationTitle : "",
      links,
      itemsJson: JSON.stringify(links),
      linkStyle,
      navigationAlignment,
      mobileStyle,
      variant: "center",
    };
  }

  if (originalType === "banners" && registryType === "banner_carousel") {
    const rawItems = Array.isArray(out.bannerItems) ? (out.bannerItems as Record<string, unknown>[]) : [];
    const slides = rawItems.map((row, idx) => {
      const o = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `slide-${idx}`;
      const title = typeof o.title === "string" ? o.title : "";
      const subtitle = typeof o.subtitle === "string" ? o.subtitle : "";
      const link = typeof o.link === "string" ? o.link : "";
      const buttonText = typeof o.buttonText === "string" ? o.buttonText : "";
      const image =
        (typeof o.image === "string" && o.image.trim()) ||
        (typeof o.src === "string" && String(o.src).trim()) ||
        "";
      return { id, title, subtitle, link, buttonText, image };
    });
    const settings =
      out.umbracoSettings && typeof out.umbracoSettings === "object" && !Array.isArray(out.umbracoSettings)
        ? (out.umbracoSettings as Record<string, unknown>)
        : {};
    const disableCarousel = settings.disableCarousel === true;
    const showArrows = settings.showArrows !== false;
    const showDots = settings.showDots !== false;
    const rawSpeed = settings.autoRotateSpeed;
    let autoRotateMs = 0;
    if (!disableCarousel) {
      if (typeof rawSpeed === "number" && Number.isFinite(rawSpeed)) autoRotateMs = Math.max(0, Math.round(rawSpeed));
      else if (typeof rawSpeed === "string" && rawSpeed.trim()) {
        const n = parseInt(rawSpeed, 10);
        if (Number.isFinite(n)) autoRotateMs = Math.max(0, n);
      }
    }
    const slidesJson = JSON.stringify(slides);
    return {
      slides,
      slidesJson,
      disableCarousel,
      showArrows,
      showDots,
      autoRotateMs,
      shuffleOnLoad: out.enableRandomOrder === true,
      variant: "center",
    };
  }

  if (originalType === "codeBlock" && registryType === "code_block") {
    const settings =
      out.umbracoSettings && typeof out.umbracoSettings === "object" && !Array.isArray(out.umbracoSettings)
        ? (out.umbracoSettings as Record<string, unknown>)
        : {};
    const caption = typeof settings.name === "string" ? settings.name.trim() : "";
    return {
      code: typeof out.code === "string" ? out.code : String(out.code ?? ""),
      ...(caption ? { caption } : {}),
      variant: "center",
    };
  }

  if (originalType === "dualPromoCardsBlock" && registryType === "dual_promo_cards") {
    const rawItems = Array.isArray(out.items) ? (out.items as Record<string, unknown>[]) : [];
    const cards = rawItems.map((row, idx) => {
      const o = row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : {};
      const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : `promo-${idx}`;
      const image =
        (typeof o.image === "string" && o.image.trim() && o.image) ||
        (typeof o.src === "string" && o.src.trim() && o.src) ||
        (typeof o.imageUrl === "string" && o.imageUrl.trim() && o.imageUrl) ||
        "";
      return {
        id,
        image,
        imageAlt: typeof o.imageAlt === "string" ? o.imageAlt : "",
        eyebrow: typeof o.eyebrow === "string" ? o.eyebrow : "",
        title: typeof o.title === "string" ? o.title : "",
        description: typeof o.description === "string" ? o.description : "",
        ctaLabel: typeof o.ctaLabel === "string" ? o.ctaLabel : "",
        ctaUrl: typeof o.ctaUrl === "string" ? o.ctaUrl : "",
      };
    });
    return {
      sectionId: typeof out.sectionId === "string" ? out.sectionId : "",
      maxWidthVariant: typeof out.maxWidthVariant === "string" ? out.maxWidthVariant : "",
      cards,
      cardsJson: JSON.stringify(cards),
      variant: "center",
    };
  }

  if (originalType === "form" && registryType === "form_embed") {
    if (out.formId == null) out.formId = "";
    if (out.iframeSrc == null) out.iframeSrc = "";
    if (out.title == null) out.title = "";
    if (out.lede == null) out.lede = "";
    if (out.embedHtml == null) out.embedHtml = "";
    const cw = String(out.contentWidth ?? "").toLowerCase();
    out.contentWidth =
      cw === "wide" ? "wide"
      : cw === "narrow" ? "narrow"
      : "normal";
    return out;
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
