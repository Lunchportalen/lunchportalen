"use client";

import React from "react";
import Link from "next/link";
import MediaFrame from "@/components/ui/MediaFrame";
import { Section } from "@/components/ui/Section";
import { TextBlock } from "@/components/ui/TextBlock";
import { Button } from "@/components/ui/cms/Button";
import { BannerBlock } from "@/components/blocks/BannerBlock";
import { BannerCarouselBlock, slidesFromBannerCarouselData } from "@/components/blocks/BannerCarouselBlock";
import {
  AccordionTabsBlock,
  panelsFromAccordionTabsData,
  parseAccordionTabsBool,
  parseAccordionTabsDefaultOpenIndex,
  parseAccordionTabsDisplayMode,
} from "@/components/blocks/AccordionTabsBlock";
import { AnchorNavigationBlock, linksFromAnchorNavigationData } from "@/components/blocks/AnchorNavigationBlock";
import { DualPromoCardsBlock, cardsFromDualPromoData } from "@/components/blocks/DualPromoCardsBlock";
import { SectionIntroBlock } from "@/components/blocks/SectionIntroBlock";
import { LogoCloudBlock, logosFromLogoCloudData } from "@/components/blocks/LogoCloudBlock";
import { StatsKpiBlock, kpisFromStatsBlockData } from "@/components/blocks/StatsKpiBlock";
import { QuoteBlock } from "@/components/blocks/QuoteBlock";
import { NewsletterSignupBlock } from "@/components/blocks/NewsletterSignupBlock";
import { HeroBleed } from "@/components/blocks/HeroBleed";
import { FaqBlock } from "@/components/blocks/FaqBlock";
import { HeroSplit } from "@/components/blocks/HeroSplit";
import { MarketingCardsBlock } from "@/components/blocks/MarketingCardsBlock";
import { MarketingCtaBlock } from "@/components/blocks/MarketingCtaBlock";
import { MarketingImageBlock } from "@/components/blocks/MarketingImageBlock";
import { MarketingTextBlock } from "@/components/blocks/MarketingTextBlock";
import { MarketingZigzagBlock } from "@/components/blocks/MarketingZigzagBlock";
import { SplitBlock } from "@/components/blocks/SplitBlock";
import { TestimonialBlock, testimonialsFromTestimonialBlockData } from "@/components/blocks/TestimonialBlock";
import RelatedLinks from "@/components/seo/RelatedLinks";
import { FormEmbedBlock } from "@/components/blocks/FormEmbedBlock";
import type { AiComponentType } from "@/lib/cms/blocks/componentRegistry";
import { normalizeDisplayText } from "@/lib/cms/displayText";
import type { MergedDesign, ParsedDesignSettings } from "@/lib/cms/design/designContract";
import {
  cardSurfaceClassString,
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
  pricingPlanSurfaceClassString,
  resolvedCardForBlockType,
} from "@/lib/cms/design/designContract";
import type { BlockConfig } from "@/lib/cms/model/blockTypes";
import type { VisualCanvasPatchHandler } from "@/lib/cms/blockTypeMap";
import { safeAltForImg } from "@/lib/media/renderSafe";

function cn(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function s(v: unknown): string {
  return normalizeDisplayText(String(v ?? ""));
}

function readMedia(d: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function headAlignFromVariant(v: unknown): string {
  const t = String(v ?? "center").toLowerCase();
  if (t === "left") return "text-left";
  if (t === "right") return "text-right";
  return "text-center";
}

function splitVariant(v: unknown): "left" | "right" {
  return String(v ?? "").toLowerCase() === "right" ? "right" : "left";
}

function PrimaryCta({ label, href, className }: { label: string; href: string; className?: string }) {
  const l = label.trim();
  const h = href.trim();
  if (!l || !h) return null;
  const internal = h.startsWith("/") && !h.startsWith("//");
  const cls = cn("font-ui lp-btn lp-btn-primary lp-neon mt-4 inline-flex", className);
  if (internal) {
    return (
      <Button asChild variant="primary">
        <Link href={h} className={cls}>
          {l}
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild variant="primary">
      <a href={h} className={cls}>
        {l}
      </a>
    </Button>
  );
}

export type EnterpriseLockedBlockViewProps = {
  block: { id: string; type: string; data?: Record<string, unknown> | null; config?: BlockConfig };
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  visualCanvasEdit?: VisualCanvasPatchHandler | null;
  /** Public page render: form + pricing preview hints. */
  renderEnv?: "prod" | "staging";
  renderLocale?: "nb" | "en";
};

export function createRegistryBlock<T extends AiComponentType>(type: T) {
  function RegistryBlockView(
    props: Omit<EnterpriseLockedBlockViewProps, "block"> & {
      blockId: string;
      data: Record<string, unknown>;
      config?: BlockConfig;
    },
  ) {
    const { blockId, data, config, visualCanvasEdit = null, ...rest } = props;
    return (
      <EnterpriseLockedBlockView
        block={{ id: blockId, type, data, config }}
        visualCanvasEdit={visualCanvasEdit}
        {...rest}
      />
    );
  }
  RegistryBlockView.displayName = `RegistryBlock_${type}`;
  return RegistryBlockView;
}

/**
 * Deterministic render for all {@link AiComponentType} registry keys. Uses Section + MediaFrame + Button + TextBlock
 * for locked shells; delegates to existing marketing blocks where shapes align.
 */
export function EnterpriseLockedBlockView({
  block,
  merged,
  designSettings,
  visualCanvasEdit = null,
  renderEnv = "prod",
  renderLocale = "nb",
}: EnterpriseLockedBlockViewProps) {
  const ds = designSettings;
  const data = (block.data ?? {}) as Record<string, unknown>;
  const type = block.type as AiComponentType;
  const ha = headAlignFromVariant(data.variant);
  const vce = visualCanvasEdit;

  switch (type) {
    case "hero_split":
      return (
        <HeroSplit
          merged={merged}
          title={s(data.title)}
          subtitle={s(data.subtitle)}
          imageSrc={readMedia(data, ["image", "imageUrl", "src"])}
          imageAlt=""
          useGradient
          ctaLabel={s(data.ctaLabel)}
          ctaHref={s(data.ctaHref)}
        />
      );

    case "banner":
      return (
        <BannerBlock
          text={s(data.text)}
          ctaLabel={s(data.ctaLabel)}
          ctaHref={s(data.ctaHref)}
          backgroundSrc={readMedia(data, ["backgroundImage", "imageUrl", "src"])}
          sectionClassName={marketingSectionClassString(merged, { motion: true })}
          containerClassName={marketingContainerClassString(merged)}
          textClassName="font-display text-xl font-semibold tracking-tight sm:text-2xl md:text-3xl"
        />
      );

    case "banner_carousel": {
      const slides = slidesFromBannerCarouselData(data as Record<string, unknown>);
      const disableCarousel = data.disableCarousel === true;
      const showArrows = data.showArrows !== false;
      const showDots = data.showDots !== false;
      const rawMs = data.autoRotateMs;
      const autoRotateMs =
        typeof rawMs === "number" && Number.isFinite(rawMs) ? Math.max(0, Math.round(rawMs))
        : typeof rawMs === "string" && rawMs.trim() ? Math.max(0, parseInt(rawMs, 10) || 0)
        : 0;
      const shuffleOnLoad = data.shuffleOnLoad === true;
      return (
        <BannerCarouselBlock
          merged={merged}
          slides={slides}
          disableCarousel={disableCarousel}
          showArrows={showArrows}
          showDots={showDots}
          autoRotateMs={autoRotateMs}
          shuffleOnLoad={shuffleOnLoad}
        />
      );
    }

    case "text_block":
      return (
        <MarketingTextBlock
          merged={merged}
          designSettings={ds}
          heading={s(data.title)}
          body={s(data.body)}
          motion
          visualCanvasEdit={vce}
        />
      );

    case "rich_text":
      return (
        <MarketingTextBlock
          merged={merged}
          designSettings={ds}
          heading={s(data.heading)}
          body={s(data.body)}
          motion
          visualCanvasEdit={vce}
        />
      );

    case "section_intro":
      return (
        <SectionIntroBlock
          merged={merged}
          eyebrow={s(data.eyebrow)}
          title={s(data.title)}
          lede={s(data.lede)}
          variant={data.variant}
          contentWidth={data.contentWidth}
        />
      );

    case "image_block":
      return (
        <MarketingImageBlock
          merged={merged}
          designSettings={ds}
          src={readMedia(data, ["image", "imageUrl", "src"])}
          alt={normalizeDisplayText(safeAltForImg(data.alt, data.caption))}
          caption={s(data.caption)}
        />
      );

    case "cta_block": {
      const secLabel = s(data.secondaryCtaLabel ?? data.secondaryButtonLabel);
      const secHref =
        typeof data.secondaryCtaHref === "string" ?
          data.secondaryCtaHref.trim()
        : typeof data.secondaryButtonHref === "string" ?
          data.secondaryButtonHref.trim()
        : "";
      return (
        <MarketingCtaBlock
          merged={merged}
          eyebrow={s(data.eyebrow)}
          title={s(data.title)}
          body={s(data.body)}
          buttonLabel={s(data.ctaLabel)}
          buttonHref={s(data.ctaHref)}
          {...(secLabel && secHref ? { secondaryLabel: secLabel, secondaryHref: secHref } : {})}
        />
      );
    }

    case "feature_grid": {
      const mode = String(data.cardMode ?? "feature").toLowerCase();
      const featurePresentation = mode !== "plain";
      const c1 = {
        label: s(data.c1Label),
        href: typeof data.c1Href === "string" ? data.c1Href.trim() : "",
      };
      const c2 = {
        label: s(data.c2Label),
        href: typeof data.c2Href === "string" ? data.c2Href.trim() : "",
      };
      const ctas = [c1, c2].filter((c) => c.label && c.href).map((c) => ({ ...c, ghost: false }));
      return (
        <MarketingCardsBlock
          merged={merged}
          designSettings={ds}
          title={s(data.title)}
          intro={s(data.subtitle)}
          items={[
            {
              title: s(data.f1Title),
              text: s(data.f1Body),
              kicker: s(data.f1Kicker),
              linkLabel: s(data.f1LinkLabel),
              linkHref: typeof data.f1LinkHref === "string" ? data.f1LinkHref.trim() : "",
            },
            {
              title: s(data.f2Title),
              text: s(data.f2Body),
              kicker: s(data.f2Kicker),
              linkLabel: s(data.f2LinkLabel),
              linkHref: typeof data.f2LinkHref === "string" ? data.f2LinkHref.trim() : "",
            },
            {
              title: s(data.f3Title),
              text: s(data.f3Body),
              kicker: s(data.f3Kicker),
              linkLabel: s(data.f3LinkLabel),
              linkHref: typeof data.f3LinkHref === "string" ? data.f3LinkHref.trim() : "",
            },
          ]}
          featurePresentation={featurePresentation}
          {...(ctas.length > 0 ? { ctas } : {})}
        />
      );
    }

    case "faq_block": {
      const items = [
        { id: `${block.id}-1`, question: s(data.q1), answer: s(data.a1) },
        { id: `${block.id}-2`, question: s(data.q2), answer: s(data.a2) },
        { id: `${block.id}-3`, question: s(data.q3), answer: s(data.a3) },
      ].filter((it) => it.question.trim() !== "" || it.answer.trim() !== "");
      if (items.length === 0) return null;
      return (
        <FaqBlock merged={merged} sectionTitle={s(data.sectionTitle)} items={items} />
      );
    }

    case "accordion_tabs": {
      const d = data as Record<string, unknown>;
      const panels = panelsFromAccordionTabsData(d);
      return (
        <AccordionTabsBlock
          merged={merged}
          blockId={block.id}
          sectionTitle={s(d.sectionTitle)}
          displayMode={parseAccordionTabsDisplayMode(d)}
          items={panels}
          defaultOpenIndex={parseAccordionTabsDefaultOpenIndex(d)}
          rememberOpen={parseAccordionTabsBool(d, "rememberOpen")}
        />
      );
    }

    case "anchor_navigation": {
      const d = data as Record<string, unknown>;
      const links = linksFromAnchorNavigationData(d);
      return (
        <AnchorNavigationBlock
          merged={merged}
          title={s(d.title)}
          links={links}
          linkStyle={s(d.linkStyle) || "pills"}
          navigationAlignment={s(d.navigationAlignment) || "center"}
          mobileStyle={s(d.mobileStyle) || "horizontal-scroll"}
        />
      );
    }

    case "testimonial_block": {
      const d = data as Record<string, unknown>;
      return (
        <TestimonialBlock
          merged={merged}
          designSettings={ds}
          sectionTitle={s(d.sectionTitle)}
          items={testimonialsFromTestimonialBlockData(d)}
          density={d.density}
          variant={d.variant}
        />
      );
    }

    case "dual_promo_cards": {
      const d = data as Record<string, unknown>;
      const cards = cardsFromDualPromoData(d);
      return (
        <DualPromoCardsBlock
          merged={merged}
          designSettings={ds}
          sectionId={s(d.sectionId)}
          cards={cards}
        />
      );
    }

    case "split_block": {
      const card = cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds));
      return (
        <Section
          sectionClassName={marketingSectionClassString(merged, { motion: true })}
          containerClassName={marketingContainerClassString(merged)}
        >
          <div className={cn(card, "grid gap-8 p-6 md:grid-cols-2 md:p-10")}>
            <div className={ha}>
              {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            </div>
            <div className="space-y-6">
              <div>
                {data.leftTitle ? (
                  <h3 className={mergedHeadingClassString(merged, "h3")}>{s(data.leftTitle)}</h3>
                ) : null}
                {data.leftBody ? (
                  <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{s(data.leftBody)}</TextBlock>
                ) : null}
              </div>
              <div>
                {data.rightTitle ? (
                  <h3 className={mergedHeadingClassString(merged, "h3")}>{s(data.rightTitle)}</h3>
                ) : null}
                {data.rightBody ? (
                  <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{s(data.rightBody)}</TextBlock>
                ) : null}
              </div>
            </div>
          </div>
        </Section>
      );
    }

    case "grid_2":
    case "grid_3": {
      const n = type === "grid_2" ? 2 : 3;
      const items = [
        {
          title: s(data.card1Title),
          subtitle: s(data.card1Subtitle),
          metaLine: s(data.card1MetaLine),
          src: readMedia(data, ["card1Image", "card1ImageUrl"]),
        },
        {
          title: s(data.card2Title),
          subtitle: s(data.card2Subtitle),
          metaLine: s(data.card2MetaLine),
          src: readMedia(data, ["card2Image", "card2ImageUrl"]),
        },
        ...(n === 3 ?
          [
            {
              title: s(data.card3Title),
              subtitle: s(data.card3Subtitle),
              metaLine: s(data.card3MetaLine),
              src: readMedia(data, ["card3Image", "card3ImageUrl"]),
            },
          ]
        : []),
      ].filter((it) => it.title || it.src);
      const gridClass = n === 2 ? "lp-local-grid lp-local-grid-cols-2" : "lp-local-grid";
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn("lp-section-head", ha)}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            {data.subtitle ? (
              <p className={cn(mergedBodyClassString(merged, { measure: true }), "mt-2")}>{s(data.subtitle)}</p>
            ) : null}
          </div>
          <div className={gridClass}>
            {items.map((it, i) => (
              <div key={i} className="lp-local-card">
                <MediaFrame
                  src={it.src}
                  alt={normalizeDisplayText(safeAltForImg(undefined, it.title))}
                  className="rounded-2xl"
                />
                <div className="lp-local-meta">
                  <div className="lp-local-h">{it.title}</div>
                  {it.subtitle ?
                    <div className="mt-1 text-sm font-medium text-[rgb(var(--lp-text))]">{it.subtitle}</div>
                  : null}
                  {it.metaLine ?
                    <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">{it.metaLine}</div>
                  : null}
                </div>
              </div>
            ))}
          </div>
        </Section>
      );
    }

    case "card_grid": {
      const cards = [
        { title: s(data.card1Title), body: s(data.card1Body), src: readMedia(data, ["card1Image"]) },
        { title: s(data.card2Title), body: s(data.card2Body), src: readMedia(data, ["card2Image"]) },
        { title: s(data.card3Title), body: s(data.card3Body), src: readMedia(data, ["card3Image"]) },
      ].filter((c) => c.title || c.body || c.src);
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn("lp-section-head", ha)}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            {data.subtitle ? (
              <p className={cn(mergedBodyClassString(merged, { measure: true }), "mt-2")}>{s(data.subtitle)}</p>
            ) : null}
          </div>
          <div className="lp-local-grid lp-local-grid-cols-2 md:grid-cols-3">
            {cards.map((c, i) => (
              <div key={i} className={cn(cardSurfaceClassString(resolvedCardForBlockType("cards", merged.card, ds)), "flex flex-col gap-3 p-5")}>
                {c.src ? (
                  <MediaFrame src={c.src} alt={c.title || "Kort"} className="rounded-xl" />
                ) : null}
                {c.title ? <h3 className={mergedHeadingClassString(merged, "h3")}>{c.title}</h3> : null}
                {c.body ? <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{c.body}</TextBlock> : null}
              </div>
            ))}
          </div>
        </Section>
      );
    }

    case "image_gallery": {
      const imgs = [
        { src: readMedia(data, ["i1"]), alt: s(data.alt1) },
        { src: readMedia(data, ["i2"]), alt: s(data.alt2) },
        { src: readMedia(data, ["i3"]), alt: s(data.alt3) },
      ].filter((x) => x.src);
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn("lp-local-grid lp-local-grid-cols-2 md:grid-cols-3", "gap-4")}>
            {imgs.map((im, i) => (
              <MediaFrame key={i} src={im.src} alt={im.alt || `Bilde ${i + 1}`} />
            ))}
          </div>
        </Section>
      );
    }

    case "logo_cloud": {
      const d = data as Record<string, unknown>;
      return (
        <LogoCloudBlock
          merged={merged}
          title={s(d.title)}
          logos={logosFromLogoCloudData(d)}
          density={d.density}
          variant={d.variant}
        />
      );
    }

    case "hero_minimal":
      return (
        <Section sectionClassName={marketingSectionClassString(merged, { motion: true })} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn(cardSurfaceClassString(resolvedCardForBlockType("hero", merged.card, ds)), "px-6 py-12 text-center md:px-12")}>
            {data.title ? <h1 className={mergedHeadingClassString(merged, "h1")}>{s(data.title)}</h1> : null}
            {data.subtitle ? (
              <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), "mx-auto mt-3 max-w-2xl")}>
                {s(data.subtitle)}
              </TextBlock>
            ) : null}
            <div className="flex justify-center">
              <PrimaryCta label={s(data.ctaLabel)} href={s(data.ctaHref)} />
            </div>
          </div>
        </Section>
      );

    case "hero_centered": {
      const bg = readMedia(data, ["backgroundImage", "imageUrl", "src"]);
      return (
        <Section sectionClassName={marketingSectionClassString(merged, { motion: true })} containerClassName={marketingContainerClassString(merged)}>
          <div className="relative overflow-clip rounded-2xl">
            {bg ? (
              <div className="absolute inset-0">
                <MediaFrame src={bg} alt="" className="h-full min-h-[280px] rounded-none opacity-40" />
              </div>
            ) : null}
            <div className={cn("relative px-6 py-14 text-center md:px-12", bg ? "bg-black/25 text-white" : "")}>
              {data.title ? <h1 className={mergedHeadingClassString(merged, "h1")}>{s(data.title)}</h1> : null}
              {data.subtitle ? (
                <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), "mx-auto mt-3 max-w-2xl opacity-95")}>
                  {s(data.subtitle)}
                </TextBlock>
              ) : null}
              <div className="flex justify-center">
                <PrimaryCta label={s(data.ctaLabel)} href={s(data.ctaHref)} />
              </div>
            </div>
          </div>
        </Section>
      );
    }

    case "hero_video": {
      const poster = readMedia(data, ["poster"]);
      const videoUrl = readMedia(data, ["video"]) ?? "";
      return (
        <Section sectionClassName={marketingSectionClassString(merged, { motion: true })} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn(cardSurfaceClassString(resolvedCardForBlockType("hero", merged.card, ds)), "overflow-clip p-0")}>
            {poster ? <MediaFrame src={poster} alt="" className="rounded-none" /> : null}
            <div className="space-y-3 px-6 py-8 text-center">
              {data.title ? <h1 className={mergedHeadingClassString(merged, "h1")}>{s(data.title)}</h1> : null}
              {data.subtitle ? <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{s(data.subtitle)}</TextBlock> : null}
              {videoUrl ? (
                <div className="flex justify-center">
                  <Button asChild variant="secondary">
                    <a href={videoUrl} className="font-ui lp-btn lp-btn-secondary inline-flex" rel="noopener noreferrer">
                      Se video
                    </a>
                  </Button>
                </div>
              ) : null}
              <PrimaryCta label={s(data.ctaLabel)} href={s(data.ctaHref)} />
            </div>
          </div>
        </Section>
      );
    }

    case "promo_strip":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/50 px-4 py-4 md:flex-row md:px-8">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              {readMedia(data, ["accentImage"]) ?
                <div className="hidden w-20 shrink-0 sm:block">
                  <MediaFrame src={readMedia(data, ["accentImage"])} alt="" className="aspect-square rounded-lg" />
                </div>
              : null}
              <p className={cn(mergedHeadingClassString(merged, "h3"), "text-balance")}>{s(data.text)}</p>
            </div>
            <PrimaryCta label={s(data.ctaLabel)} href={s(data.ctaHref)} className="mt-0 shrink-0" />
          </div>
        </Section>
      );

    case "alert_bar":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className="flex flex-col items-start justify-between gap-3 rounded-lg border border-amber-300/80 bg-amber-50/90 px-4 py-3 text-amber-950 md:flex-row md:items-center">
            <p className="text-sm font-medium">{s(data.text)}</p>
            <PrimaryCta label={s(data.ctaLabel)} href={s(data.ctaHref)} className="mt-0" />
          </div>
        </Section>
      );

    case "newsletter_signup": {
      const d = data as Record<string, unknown>;
      return (
        <NewsletterSignupBlock
          merged={merged}
          designSettings={ds}
          blockId={block.id}
          eyebrow={s(d.eyebrow)}
          title={s(d.title)}
          lede={s(d.lede)}
          submitLabel={s(d.ctaLabel)}
          formAction={s(d.ctaHref)}
          disclaimer={s(d.disclaimer)}
          submitMethod={s(d.submitMethod)}
          contentWidth={d.contentWidth}
          variant={d.variant}
        />
      );
    }

    case "cta_split":
      return (
        <SplitBlock
          merged={merged}
          designSettings={ds}
          title={s(data.title)}
          body={s(data.body)}
          imageSrc={readMedia(data, ["image", "imageUrl", "src"])}
          imageAlt={s(data.title)}
          variant={splitVariant(data.variant)}
        />
      );

    case "quote_block": {
      const d = data as Record<string, unknown>;
      return (
        <QuoteBlock
          merged={merged}
          quote={s(d.quote)}
          author={s(d.author)}
          role={s(d.role)}
          source={s(d.source)}
          contentWidth={d.contentWidth}
          variant={d.variant}
        />
      );
    }

    case "highlight_block":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn(cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds)), "bg-pink-50/40 px-6 py-8")}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            {data.body ? <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), "mt-2")}>{s(data.body)}</TextBlock> : null}
          </div>
        </Section>
      );

    case "steps_block":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn("lp-section-head", ha)}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
          </div>
          <ol className="mx-auto max-w-2xl space-y-6">
            {[1, 2, 3].map((n) => {
              const title = s(data[`step${n}Title` as keyof typeof data]);
              const body = s(data[`step${n}Body` as keyof typeof data]);
              if (!title && !body) return null;
              return (
                <li key={n} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--lp-card))] text-sm font-bold ring-1 ring-[rgb(var(--lp-border))]">
                    {n}
                  </span>
                  <div>
                    {title ? <h3 className={mergedHeadingClassString(merged, "h3")}>{title}</h3> : null}
                    {body ? <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{body}</TextBlock> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </Section>
      );

    case "timeline_block":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn("lp-section-head", ha)}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
          </div>
          <div className="mx-auto max-w-2xl border-l-2 border-[rgb(var(--lp-border))] pl-6">
            {[1, 2, 3].map((n) => {
              const title = s(data[`e${n}Title` as keyof typeof data]);
              const body = s(data[`e${n}Body` as keyof typeof data]);
              if (!title && !body) return null;
              return (
                <div key={n} className="relative mb-8 pl-4">
                  <span className="absolute -left-[1.6rem] top-1 h-3 w-3 rounded-full bg-pink-500/80 ring-4 ring-white" />
                  {title ? <h3 className={mergedHeadingClassString(merged, "h3")}>{title}</h3> : null}
                  {body ? <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), "mt-1")}>{body}</TextBlock> : null}
                </div>
              );
            })}
          </div>
        </Section>
      );

    case "stats_block": {
      const d = data as Record<string, unknown>;
      return (
        <StatsKpiBlock
          merged={merged}
          designSettings={ds}
          title={s(d.title)}
          kpis={kpisFromStatsBlockData(d)}
          density={d.density}
          columns={d.columns}
          variant={d.variant}
        />
      );
    }

    case "code_block":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn(cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds)), "overflow-x-auto p-4")}>
            <pre className="font-mono text-xs leading-relaxed text-[rgb(var(--lp-text))]">
              <code>{s(data.code)}</code>
            </pre>
            {data.caption ? <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">{s(data.caption)}</p> : null}
          </div>
        </Section>
      );

    case "pricing_table": {
      const plans = [
        {
          name: s(data.p1Name),
          badge: s(data.p1Badge),
          headline: s(data.p1Subtitle),
          price: s(data.p1Price),
          period: s(data.p1Period),
          bullets: s(data.p1Bullets),
          ctaLabel: s(data.p1CtaLabel),
          ctaHref: typeof data.p1CtaHref === "string" ? data.p1CtaHref.trim() : "",
          featured: String(data.p1Highlight ?? "").toLowerCase() === "yes",
        },
        {
          name: s(data.p2Name),
          badge: s(data.p2Badge),
          headline: s(data.p2Subtitle),
          price: s(data.p2Price),
          period: s(data.p2Period),
          bullets: s(data.p2Bullets),
          ctaLabel: s(data.p2CtaLabel),
          ctaHref: typeof data.p2CtaHref === "string" ? data.p2CtaHref.trim() : "",
          featured: String(data.p2Highlight ?? "").toLowerCase() === "yes",
        },
      ].filter((p) => p.name || p.headline || p.price || p.bullets || p.ctaLabel);
      const showStagingNote =
        renderEnv === "staging" && String(data.pricingPreviewNote ?? "") === "staging_empty";
      return (
        <Section
          sectionClassName={marketingSectionClassString(merged)}
          containerClassName={marketingContainerClassString(merged)}
          aria-label="Prisnivå"
        >
          <div className="lp-section-head">
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            {data.subtitle ? (
              <p className={mergedBodyClassString(merged, { measure: true })}>{s(data.subtitle)}</p>
            ) : null}
          </div>
          <div className="lp-pricing">
            {plans.map((p, i) => (
              <div
                key={i}
                className={pricingPlanSurfaceClassString(p.featured, merged.card, ds)}
              >
                {p.badge ?
                  <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                    {p.badge}
                  </p>
                : null}
                {p.name ? <div className={cn("lp-pill", p.featured ? "hot" : "")}>{p.name}</div> : null}
                {p.headline ? (
                  <h3 className={mergedHeadingClassString(merged, "h3")}>{p.headline}</h3>
                ) : null}
                {p.price ? (
                  <div className="lp-price">
                    <span className="lp-price-n">{p.price}</span>
                    <span className="lp-price-s">{p.period || "kr / kuvert"}</span>
                  </div>
                ) : null}
                {p.bullets ? (
                  <ul className="lp-list">
                    {p.bullets
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, j) => (
                        <li key={j}>{line}</li>
                      ))}
                  </ul>
                ) : null}
                {p.ctaLabel && p.ctaHref ? (
                  <PrimaryCta label={p.ctaLabel} href={p.ctaHref} className="lp-btn-block" />
                ) : null}
              </div>
            ))}
          </div>
          {showStagingNote ? (
            <p className="lp-muted mt-4 text-center text-xs">
              Forhåndsvisning: tom planliste. På publisert forside hentes live priser automatisk når aktivert.
            </p>
          ) : null}
          {typeof data.pricingFootnote === "string" && data.pricingFootnote.trim() ?
            <p className="lp-muted mt-4 text-center text-xs">{s(data.pricingFootnote)}</p>
          : null}
        </Section>
      );
    }

    case "comparison_table":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn("lp-section-head", ha)}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
          </div>
          <div className="overflow-x-auto rounded-xl border border-[rgb(var(--lp-border))]">
            <table className="w-full min-w-[280px] text-left text-sm">
              <tbody>
                {[
                  [s(data.r1a), s(data.r1b)],
                  [s(data.r2a), s(data.r2b)],
                  [s(data.r3a), s(data.r3b)],
                ].map((row, i) => (
                  <tr key={i} className="border-t border-[rgb(var(--lp-border))] first:border-t-0">
                    <td className="px-4 py-3 font-medium">{row[0]}</td>
                    <td className="px-4 py-3 text-[rgb(var(--lp-muted))]">{row[1]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      );

    case "case_study_block":
      return (
        <SplitBlock
          merged={merged}
          designSettings={ds}
          title={s(data.title)}
          body={s(data.body)}
          imageSrc={readMedia(data, ["image", "imageUrl", "src"])}
          imageAlt={s(data.title)}
          variant="left"
        />
      );

    case "team_block":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn("lp-section-head", ha)}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
          </div>
          <div className="grid gap-8 md:grid-cols-2">
            {[
              { name: s(data.m1Name), role: s(data.m1Role), src: readMedia(data, ["m1Image"]) },
              { name: s(data.m2Name), role: s(data.m2Role), src: readMedia(data, ["m2Image"]) },
            ].map((m, i) => (
              <div key={i} className={cn(cardSurfaceClassString(resolvedCardForBlockType("cards", merged.card, ds)), "flex flex-col items-center gap-3 p-6 text-center")}>
                {m.src ? (
                  <div className="w-40">
                    <MediaFrame src={m.src} alt={m.name} className="aspect-square rounded-full" />
                  </div>
                ) : null}
                {m.name ? <h3 className={mergedHeadingClassString(merged, "h3")}>{m.name}</h3> : null}
                {m.role ? <p className="text-sm text-[rgb(var(--lp-muted))]">{m.role}</p> : null}
              </div>
            ))}
          </div>
        </Section>
      );

    case "product_list":
    case "article_list":
    case "search_results":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn(cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds)), "p-6")}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            {data.hint ? (
              <TextBlock className={cn(mergedBodyClassString(merged, { measure: true }), "mt-2")}>{s(data.hint)}</TextBlock>
            ) : null}
            <p className="mt-4 text-xs text-[rgb(var(--lp-muted))]">
              Data kobles til kilde i backoffice — dette er en trygg forhåndsvisning uten live-spørringer i denne visningen.
            </p>
          </div>
        </Section>
      );

    case "category_grid":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn("lp-section-head", ha)}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
          </div>
          <div className="lp-local-grid lp-local-grid-cols-2 md:grid-cols-3">
            {[
              { t: s(data.c1Title), src: readMedia(data, ["c1Image"]) },
              { t: s(data.c2Title), src: readMedia(data, ["c2Image"]) },
              { t: s(data.c3Title), src: readMedia(data, ["c3Image"]) },
            ].map((c, i) => (
              <div key={i} className="lp-local-card">
                <MediaFrame src={c.src} alt={c.t} />
                <div className="lp-local-meta">
                  <div className="lp-local-h">{c.t}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      );

    case "menu_list":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn(cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds)), "p-6")}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            <ul className="mt-4 list-inside list-disc space-y-1 text-sm">
              {s(data.items)
                .split("\n")
                .map((line, i) => line.trim())
                .filter(Boolean)
                .map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
            </ul>
          </div>
        </Section>
      );

    case "order_summary":
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn(cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds)), "p-6")}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            <pre className="mt-3 whitespace-pre-wrap font-mono text-xs text-[rgb(var(--lp-text))]">{s(data.lines)}</pre>
          </div>
        </Section>
      );

    case "dynamic_feed": {
      const feed = s(data.feedLink);
      return (
        <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
          <div className={cn(cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds)), "p-6")}>
            {data.title ? <h2 className={mergedHeadingClassString(merged, "h2")}>{s(data.title)}</h2> : null}
            {feed ? (
              <p className="mt-2 text-sm">
                <span className="text-[rgb(var(--lp-muted))]">Kilde: </span>
                <a href={feed} className="underline underline-offset-2">
                  {feed}
                </a>
              </p>
            ) : null}
            <p className="mt-4 text-xs text-[rgb(var(--lp-muted))]">Feed rendres kontrollert via server — ingen vilkårlig HTML.</p>
          </div>
        </Section>
      );
    }

    case "form_embed": {
      const d = data as Record<string, unknown>;
      return (
        <FormEmbedBlock
          merged={merged}
          designSettings={ds}
          formId={s(d.formId)}
          iframeSrc={s(d.iframeSrc)}
          title={s(d.title)}
          lede={s(d.lede)}
          embedHtml={s(d.embedHtml)}
          contentWidth={d.contentWidth}
          variant={d.variant}
          renderEnv={renderEnv ?? "prod"}
          renderLocale={renderLocale ?? "nb"}
        />
      );
    }

    case "related_links": {
      const tagLines = typeof data.tagLines === "string" ? data.tagLines : "";
      const tags = tagLines.split(/\n/).map((t) => t.trim()).filter(Boolean);
      const tagList =
        tags.length > 0 ? tags : ["core", "seo", "local", "system", "alt_kantine"];
      const currentPath =
        typeof data.currentPath === "string" && data.currentPath.trim() ? data.currentPath.trim() : "/";
      const rlTitle = typeof data.title === "string" ? s(data.title) : undefined;
      const rlSubtitle = typeof data.subtitle === "string" ? s(data.subtitle) : undefined;
      const maxItems =
        typeof data.relatedMaxItems === "number" && Number.isFinite(data.relatedMaxItems) ?
          Math.min(12, Math.max(1, Math.round(data.relatedMaxItems)))
        : undefined;
      const emptyFallback =
        typeof data.relatedEmptyFallback === "string" && data.relatedEmptyFallback.trim() ?
          data.relatedEmptyFallback.trim()
        : undefined;
      return (
        <RelatedLinks
          currentPath={currentPath}
          tags={tagList}
          {...(rlTitle ? { title: rlTitle } : {})}
          {...(rlSubtitle ? { subtitle: rlSubtitle } : {})}
          {...(maxItems != null ? { maxItems } : {})}
          {...(emptyFallback ? { emptyFallbackText: emptyFallback } : {})}
        />
      );
    }

    case "section_divider":
      return (
        <section className={marketingSectionClassString(merged, { divider: true })}>
          <div className={marketingContainerClassString(merged)}>
            <div className="lp-softDivider" />
          </div>
        </section>
      );

    case "zigzag_block": {
      let steps: Array<{ step: string; title: string; text: string; imageSrc: string | null }> = [];
      try {
        const rawJson = typeof data.zigzagSteps === "string" ? data.zigzagSteps.trim() : "";
        if (rawJson) {
          const raw = JSON.parse(rawJson) as unknown;
          if (Array.isArray(raw)) {
            steps = raw.map((item, idx) => {
              const o =
                item && typeof item === "object" && !Array.isArray(item)
                  ? (item as Record<string, unknown>)
                  : {};
              const stepNum =
                typeof o.step === "string" || typeof o.step === "number" ? String(o.step) : String(idx + 1);
              const imageRaw = o.imageSrc;
              const imageStr = typeof imageRaw === "string" && imageRaw.trim() ? imageRaw.trim() : null;
              const kicker = typeof o.kicker === "string" ? o.kicker : "";
              return {
                step: stepNum,
                title: typeof o.title === "string" ? o.title : "",
                text: typeof o.text === "string" ? o.text : "",
                imageSrc: imageStr,
                ...(kicker.trim() ? { kicker } : {}),
              };
            });
          }
        }
      } catch {
        steps = [];
      }
      const sectionIntro =
        typeof data.sectionIntro === "string" && data.sectionIntro.trim() ? data.sectionIntro.trim() : undefined;
      return (
        <MarketingZigzagBlock
          merged={merged}
          sectionTitle={s(data.title)}
          {...(sectionIntro ? { sectionIntro } : {})}
          steps={steps}
        />
      );
    }

    case "hero_bleed": {
      const title = s(data.title ?? data.heading);
      const subtitleRaw = data.subtitle ?? data.text;
      const subtitle =
        subtitleRaw !== undefined && subtitleRaw !== null ? s(subtitleRaw) : "";
      const bgUrl =
        readMedia(data, ["backgroundImage", "imageUrl", "src"]) ?? "";
      const overlayUrl = readMedia(data, ["overlayImage"]) ?? "";
      const tri = (v: unknown, fallback: "left" | "center" | "right") => {
        const x = String(v ?? "").toLowerCase();
        return x === "left" || x === "right" || x === "center" ? x : fallback;
      };
      const textAlign = tri(data.textAlign, tri(data.variant, "center"));
      const textPosition = tri(data.textPosition, "center");
      const overlayPosition = tri(data.overlayPosition, "right");
      const ctaPrimary = data.ctaPrimary ? s(data.ctaPrimary) : "";
      const ctaSecondary = data.ctaSecondary ? s(data.ctaSecondary) : "";
      const ctaPrimaryHref = typeof data.ctaPrimaryHref === "string" ? data.ctaPrimaryHref : "";
      const ctaSecondaryHref = typeof data.ctaSecondaryHref === "string" ? data.ctaSecondaryHref : "";
      const overlayAlt =
        typeof data.overlayImageAlt === "string" ? s(data.overlayImageAlt) : "";
      return (
        <HeroBleed
          headingDomId={`hero-bleed-${block.id}`}
          title={title}
          subtitle={subtitle || undefined}
          ctaPrimary={ctaPrimary || undefined}
          ctaPrimaryHref={ctaPrimaryHref}
          ctaSecondary={ctaSecondary || undefined}
          ctaSecondaryHref={ctaSecondaryHref}
          backgroundImage={bgUrl}
          textAlign={textAlign}
          textPosition={textPosition}
          overlayImage={overlayUrl || undefined}
          overlayPosition={overlayPosition}
          overlayImageAlt={overlayAlt || undefined}
          visualCanvasEdit={vce}
        />
      );
    }

    default:
      return null;
  }
}
