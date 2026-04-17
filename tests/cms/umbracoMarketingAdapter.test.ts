import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { resolveBlockForEnterpriseRender } from "@/lib/cms/blockTypeMap";
import { normalizeBlockForRender } from "@/lib/cms/public/normalizeBlockForRender";
import { renderBlock } from "@/lib/public/blocks/renderBlock";
import { isEnterpriseRegistryBlockType } from "@/lib/cms/blocks/registryManifest";
import { buildCmsPageMetadata } from "@/lib/cms/public/cmsPageMetadata";
import { parseBody, parseBodyMeta } from "@/lib/cms/public/parseBody";
import {
  mapUmbracoDeliveryItemToContentBySlugResult,
  UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE,
} from "@/lib/cms/umbraco/mapDeliveryItemToLegacyMarketingBody";

/** Mirrors Umbraco 17 Delivery API v2 `properties.bodyBlocks` (flat primitive values under `properties`). */
const UMBRACO_LIVE_DELIVERY_V2_BODYBLOCKS_FIXTURE = {
  id: "ced3fb68-17d9-45a3-a2c8-22e76e603a41",
  contentType: "marketingPage",
  name: "home",
  properties: {
    pageTitle: "Hjem",
    routeSlug: "home",
    seoTitle: "Hjem — SEO",
    seoDescription: "Phase-1 Umbraco marketing seed for Delivery verification.",
    bodyBlocks: {
      items: [
        {
          content: {
            contentType: "lpHero",
            id: "c202c462-dfae-4bcb-ae42-d626939e462e",
            properties: {
              title: "Første live hero (Umbraco)",
              subtitle: "Kort undertekst for Delivery → adapter-test",
              imageId: null,
              imageAlt: null,
              ctaLabel: "Les mer",
              ctaHref: "/kontakt",
            },
          },
          settings: null,
        },
        {
          content: {
            contentType: "lpRichText",
            id: "b3a561ca-fcd6-4e43-9f62-3ae06f1bcc51",
            properties: {
              heading: "Første rich text-blokk",
              body: "<p>Live <strong>bodyBlocks</strong> fra Umbraco via Delivery API.</p>",
            },
          },
          settings: null,
        },
      ],
    },
  },
};

/** mainContent Block List: content + settings element (split); nested accordionItems. */
const UMBRACO_MAIN_CONTENT_ACCORDION_FIXTURE = {
  id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  contentType: "marketingPage",
  name: "Accordion demo",
  properties: {
    pageTitle: "Accordion demo",
    routeSlug: "accordion-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "accordionOrTab",
            id: "acc-root-1",
            properties: {
              sectionTitle: "Ofte stilte spørsmål",
              displayMode: "accordion",
              accordionItems: {
                items: [
                  {
                    content: {
                      contentType: "accordionOrTabItem",
                      id: "acc-item-1",
                      properties: {
                        title: "Levering",
                        body: "Vi leverer i tidsvinduet ditt.",
                      },
                    },
                  },
                ],
              },
            },
          },
          settings: {
            contentType: "accordionOrTabSettings",
            id: "acc-settings-1",
            properties: {
              layoutMaxWidth: "normal",
              layoutAlign: "center",
              layoutVerticalRhythm: "normal",
              componentChrome: "soft",
              componentDefaultOpenIndex: 0,
              componentRememberOpen: false,
              animationEnter: "fade",
              animationDurationMs: 220,
              animationRespectReducedMotion: true,
              advancedSectionDomId: "faq-accordion",
              advancedAriaRegionLabel: "Vanlige spørsmål",
              advancedEnableAnchors: true,
            },
          },
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_ALERT_FIXTURE = {
  id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
  contentType: "marketingPage",
  name: "Alert demo",
  properties: {
    pageTitle: "Alert demo",
    routeSlug: "alert-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "alertBox",
            id: "alert-1",
            properties: {
              text: "<p>Planlagt vedlikehold i kveld.</p>",
            },
          },
          settings: {
            contentType: "alertBoxSettings",
            id: "alert-settings-1",
            properties: {
              color: { value: "info" },
              hideCloseOption: false,
              contentColors: "inverse",
              backgroundImageOpacity: 40,
              backgroundImageOptions: '{"objectFit":"cover"}',
              componentWidth: "normal",
              animate: true,
              name: "Maintenance banner",
              anchorName: "drift",
              customClasses: "lp-alert lp-alert--info",
              spacingPaddingY: "md",
              spacingMarginY: "sm",
              visibilityHideOnMobile: false,
              visibilityHideOnDesktop: false,
              designFlagHighContrast: false,
              designFlagMuted: true,
              hideFromWebsite: false,
            },
          },
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_ANCHOR_NAV_FIXTURE = {
  id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
  contentType: "marketingPage",
  name: "Anchor nav demo",
  properties: {
    pageTitle: "Anchor nav demo",
    routeSlug: "anchor-nav-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "anchorNavigation",
            id: "nav-root-1",
            properties: {
              navigationTitle: "På denne siden",
              links: {
                items: [
                  {
                    content: {
                      contentType: "anchorNavigationLink",
                      id: "nav-link-1",
                      properties: { label: "Intro", href: "#intro" },
                    },
                  },
                  {
                    content: {
                      contentType: "anchorNavigationLink",
                      id: "nav-link-2",
                      properties: { label: "Priser", href: "#priser" },
                    },
                  },
                ],
              },
            },
          },
          settings: {
            contentType: "anchorNavigationSettings",
            id: "nav-settings-1",
            properties: {
              linkStyle: "pills",
              mobileStyle: "horizontal-scroll",
              navigationAlignment: "center",
              contentColors: "default",
              backgroundImageOpacity: 0,
              backgroundOptions: "{}",
              componentWidth: "wide",
              animate: false,
              name: "TOC nav",
              anchorName: "page-toc",
              customClasses: "lp-anchor-nav",
              spacingPaddingY: "sm",
              spacingMarginY: "none",
              visibilityHideOnMobile: false,
              visibilityHideOnDesktop: false,
              designFlagHighContrast: false,
              designFlagMuted: true,
            },
          },
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_BANNERS_FIXTURE = {
  id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
  contentType: "marketingPage",
  name: "Banners demo",
  properties: {
    pageTitle: "Banners demo",
    routeSlug: "banners-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "banners",
            id: "banners-root-1",
            properties: {
              enableRandomOrder: false,
              bannerItems: {
                items: [
                  {
                    content: {
                      contentType: "bannerItem",
                      id: "banner-item-1",
                      properties: {
                        title: "Sommerkampanje",
                        subtitle: "20 % på bedriftslunsj",
                        link: "/tilbud",
                        buttonText: "Les mer",
                        image: null,
                      },
                    },
                  },
                ],
              },
            },
          },
          settings: {
            contentType: "bannersSettings",
            id: "banners-settings-1",
            properties: {
              disableCarousel: false,
              showArrows: true,
              showDots: true,
              autoRotateSpeed: 5000,
              name: "Home hero strip",
              anchorName: "kampanje",
              customClasses: "lp-banners",
              spacingPaddingY: "md",
              spacingMarginY: "sm",
              visibilityHideOnMobile: false,
              visibilityHideOnDesktop: false,
              designFlagHighContrast: false,
              designFlagMuted: false,
            },
          },
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_CODE_BLOCK_FIXTURE = {
  id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  contentType: "marketingPage",
  name: "Code demo",
  properties: {
    pageTitle: "Code demo",
    routeSlug: "code-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "codeBlock",
            id: "code-1",
            properties: {
              displayIntro: true,
              code: "console.log('LP');",
              codeBehaviour: "displayCode",
              displayOutro: false,
            },
          },
          settings: {
            contentType: "codeBlockSettings",
            id: "code-settings-1",
            properties: {
              contentColors: "default",
              backgroundImageOpacity: 0,
              backgroundImageOptions: "{}",
              componentWidth: "normal",
              animate: false,
              name: "Sample snippet",
              anchorName: "snippet-1",
              customClasses: "lp-code",
              spacingPaddingY: "md",
              spacingMarginY: "none",
              visibilityHideOnMobile: false,
              visibilityHideOnDesktop: false,
              designFlagHighContrast: false,
              designFlagMuted: true,
              hideFromWebsite: false,
            },
          },
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_TEXT_BLOCK_FIXTURE = {
  id: "99999999-9999-9999-9999-999999999999",
  contentType: "marketingPage",
  name: "Text demo",
  properties: {
    pageTitle: "Text demo",
    routeSlug: "text-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "textBlock",
            id: "text-1",
            properties: {
              displayIntro: false,
              text: "<p>Brødtekst fra <strong>textBlock</strong>.</p>",
              displayOutro: true,
            },
          },
          settings: {
            contentType: "textBlockSettings",
            id: "text-settings-1",
            properties: {
              contentColors: "default",
              backgroundImageOpacity: 0,
              backgroundImageOptions: "{}",
              componentWidth: "normal",
              animate: true,
              name: "Ingress",
              anchorName: "intro-text",
              customClasses: "lp-text-block",
              spacingPaddingY: "md",
              spacingMarginY: "sm",
              visibilityHideOnMobile: false,
              visibilityHideOnDesktop: false,
              designFlagHighContrast: false,
              designFlagMuted: false,
              hideFromWebsite: false,
            },
          },
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_HERO_BANNER_FIXTURE = {
  id: "77777777-7777-7777-7777-777777777777",
  contentType: "marketingPage",
  name: "Hero demo",
  properties: {
    pageTitle: "Hero demo",
    routeSlug: "hero-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "heroBannerBlock",
            id: "hero-1",
            properties: {
              topbarText: "Gratis frakt over 499 kr",
              quickLinks: {
                items: [
                  {
                    content: {
                      contentType: "quickLinkItem",
                      id: "ql-1",
                      properties: {
                        label: "VIKTIGE BESKJEDER",
                        url: "/beskjeder",
                        isImportant: true,
                        openInNewTab: false,
                      },
                    },
                  },
                  {
                    content: {
                      contentType: "quickLinkItem",
                      id: "ql-2",
                      properties: { label: "NYHETER", url: "/nyheter", isImportant: false, openInNewTab: false },
                    },
                  },
                ],
              },
              desktopImage: null,
              mobileImage: null,
              imageAlt: "Kampanje",
              title: "Ukens lunsj",
              titleSubline: "Fersk — raskt levert",
              sublineItems: {
                items: [
                  { content: { contentType: "sublineItem", id: "sl-1", properties: { text: "Nyheter i butikken" } } },
                  { content: { contentType: "sublineItem", id: "sl-2", properties: { text: "Rask levering" } } },
                ],
              },
              primaryCtaLabel: "Bestill nå",
              primaryCtaUrl: "/bestill",
              smallNote: "Tilbud gjelder t.o.m. søndag.",
            },
          },
          settings: {
            contentType: "heroBannerBlockSettings",
            id: "hero-settings-1",
            properties: {
              bannerVariant: "standard",
              contentAlignment: "center",
              quickLinksPosition: "topCenter",
              titleSize: "large",
              contentColors: "default",
              backgroundImageOpacity: 0,
              backgroundImageOptions: "{}",
              componentWidth: "wide",
              overlayStrength: 40,
              imageFocusDesktop: "center",
              imageFocusMobile: "center",
              quickLinkStyle: "pill",
              importantQuickLinkStyle: "pill-emphasis",
              animate: true,
              name: "Home hero",
              anchorName: "hero",
              customClasses: "lp-hero-banner",
              spacingPaddingY: "lg",
              spacingMarginY: "none",
              visibilityHideOnMobile: false,
              visibilityHideOnDesktop: false,
              designFlagHighContrast: false,
              designFlagMuted: false,
              hideFromWebsite: false,
            },
          },
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_DUAL_PROMO_FIXTURE = {
  id: "66666666-6666-6666-6666-666666666666",
  contentType: "marketingPage",
  name: "Dual promo demo",
  properties: {
    pageTitle: "Dual promo demo",
    routeSlug: "dual-promo-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "dualPromoCardsBlock",
            id: "dual-promo-1",
            properties: {
              sectionId: "promo-deco",
              maxWidthVariant: "wide",
              items: {
                items: [
                  {
                    content: {
                      contentType: "promoCardItem",
                      id: "pc-1",
                      properties: {
                        image: null,
                        imageAlt: "Deco",
                        eyebrow: "1490,-",
                        title: "DecoAndeli",
                        description: "Italiensk kvalitet.",
                        ctaLabel: "Se utvalg",
                        ctaUrl: "/deco",
                      },
                    },
                  },
                  {
                    content: {
                      contentType: "promoCardItem",
                      id: "pc-2",
                      properties: {
                        image: null,
                        imageAlt: "Olivenolje",
                        eyebrow: "Nyhet",
                        title: "Rincón de la Subbética",
                        description: "Ekstra jomfru.",
                        ctaLabel: "Les mer",
                        ctaUrl: "/subbetica",
                      },
                    },
                  },
                ],
              },
            },
          },
          settings: {
            contentType: "dualPromoCardsBlockSettings",
            id: "dual-promo-settings-1",
            properties: {
              columnsDesktop: "2",
              stackOnMobile: true,
              cardMinHeight: "320px",
              contentPosition: "bottomLeft",
              contentBoxStyle: "darkOverlay",
              overlayStyle: "gradientDark",
              sheenEffect: false,
              cardRadius: "lg",
              shadowLevel: 2,
              buttonStyle: "primary",
              imageFit: "cover",
              contentWidth: "normal",
              animate: true,
              hoverEffect: "lift",
              name: "Home dual promo",
              anchorName: "dual-promo",
              customClasses: "lp-dual-promo",
              spacingPaddingY: "md",
              spacingMarginY: "md",
              visibilityHideOnMobile: false,
              visibilityHideOnDesktop: false,
              designFlagHighContrast: false,
              designFlagMuted: false,
              hideFromWebsite: false,
            },
          },
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_SECTION_INTRO_FIXTURE = {
  id: "11111111-1111-1111-1111-111111111111",
  contentType: "marketingPage",
  name: "Section intro demo",
  properties: {
    pageTitle: "Section intro demo",
    routeSlug: "section-intro-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "sectionIntro",
            id: "si-1",
            properties: {
              eyebrow: "FOR BEDRIFTER",
              title: "Kontroll og trygghet",
              lede: "Kort lede om verdien.",
              contentWidth: "narrow",
              variant: "center",
            },
          },
          settings: null,
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_LOGO_CLOUD_FIXTURE = {
  id: "22222222-2222-2222-2222-222222222222",
  contentType: "marketingPage",
  name: "Logo cloud demo",
  properties: {
    pageTitle: "Logo cloud demo",
    routeSlug: "logo-cloud-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "logoCloud",
            id: "lc-root-1",
            properties: {
              title: "Stoler på oss",
              density: "comfortable",
              variant: "center",
              logos: {
                items: [
                  {
                    content: {
                      contentType: "logoCloudItem",
                      id: "lc-row-1",
                      properties: {
                        image: "https://cdn.test/partner-a.png",
                        label: "Partner A",
                        href: "https://partner-a.test",
                      },
                    },
                  },
                ],
              },
            },
          },
          settings: null,
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_STATS_BLOCK_FIXTURE = {
  id: "33333333-3333-3333-3333-333333333333",
  contentType: "marketingPage",
  name: "Stats demo",
  properties: {
    pageTitle: "Stats demo",
    routeSlug: "stats-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "statsBlock",
            id: "st-root-1",
            properties: {
              title: "Nøkkeltall",
              density: "comfortable",
              columns: "3",
              variant: "center",
              kpis: {
                items: [
                  {
                    content: {
                      contentType: "statsKpiItem",
                      id: "kpi-1",
                      properties: {
                        value: "99 %",
                        label: "Fornøyde kunder",
                        subtext: "Siste 12 mnd",
                        icon: "",
                        emphasis: true,
                      },
                    },
                  },
                ],
              },
            },
          },
          settings: null,
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_TESTIMONIAL_FIXTURE = {
  id: "44444444-4444-4444-4444-444444444444",
  contentType: "marketingPage",
  name: "Testimonial demo",
  properties: {
    pageTitle: "Testimonial demo",
    routeSlug: "testimonial-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "testimonialBlock",
            id: "tb-root-1",
            properties: {
              sectionTitle: "Anbefalinger",
              density: "comfortable",
              variant: "center",
              testimonials: {
                items: [
                  {
                    content: {
                      contentType: "testimonialItem",
                      id: "tb-row-1",
                      properties: {
                        quote: "Strålende service og presis levering.",
                        author: "Kari Nordmann",
                        role: "HR-leder",
                        company: "Eksempel AS",
                        image: "",
                        alt: "",
                        logo: "",
                      },
                    },
                  },
                ],
              },
            },
          },
          settings: null,
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_QUOTE_FIXTURE = {
  id: "55555555-5555-5555-5555-555555555555",
  contentType: "marketingPage",
  name: "Quote demo",
  properties: {
    pageTitle: "Quote demo",
    routeSlug: "quote-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "quoteBlock",
            id: "qb-1",
            properties: {
              quote: "Kvalitet og forutsigbarhet slår hype.",
              author: "Redaksjonen",
              role: "Lunchportalen",
              source: "Årsrapport",
              contentWidth: "narrow",
              variant: "center",
            },
          },
          settings: null,
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_NEWSLETTER_FIXTURE = {
  id: "66666666-6666-6666-6666-666666666661",
  contentType: "marketingPage",
  name: "Newsletter demo",
  properties: {
    pageTitle: "Newsletter demo",
    routeSlug: "newsletter-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "newsletterSignup",
            id: "nl-1",
            properties: {
              eyebrow: "Hold deg oppdatert",
              title: "Nyhetsbrev",
              lede: "Korte tips — maks én e-post i uken.",
              ctaLabel: "Meld meg på",
              ctaHref: "https://example.test/subscribe",
              disclaimer: "Du kan melde deg av når som helst.",
              submitMethod: "get",
              contentWidth: "narrow",
              variant: "center",
            },
          },
          settings: null,
        },
      ],
    },
  },
};

const UMBRACO_MAIN_CONTENT_FORM_EMBED_FIXTURE = {
  id: "77777777-7777-7777-7777-777777777771",
  contentType: "marketingPage",
  name: "Form embed demo",
  properties: {
    pageTitle: "Form embed demo",
    routeSlug: "form-embed-demo",
    bodyBlocks: { items: [] },
    mainContent: {
      items: [
        {
          content: {
            contentType: "formEmbed",
            id: "fe-1",
            properties: {
              formId: "",
              iframeSrc: "https://forms.test/embed",
              title: "Kontaktskjema",
              lede: "Skjemaet lastes i en sikker iframe.",
              embedHtml: "",
              contentWidth: "normal",
              variant: "center",
            },
          },
          settings: null,
        },
      ],
    },
  },
};

const UMBRACO_FIXTURE = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  contentType: "marketingPage",
  name: "Home",
  properties: {
    pageTitle: { value: "Hjem" },
    routeSlug: { value: "home" },
    seoTitle: { value: "SEO tittel" },
    seoDescription: { value: "SEO beskrivelse" },
    bodyBlocks: {
      value: [
        {
          content: {
            contentType: "lpHero",
            properties: {
              title: { value: "Velkommen" },
              subtitle: { value: "Undertekst" },
              ctaLabel: { value: "Kontakt" },
              ctaHref: { value: "/kontakt" },
            },
          },
        },
        {
          content: {
            contentType: "lpRichText",
            properties: {
              heading: { value: "Overskrift" },
              body: { value: "<p>Brød</p>" },
            },
          },
        },
      ],
    },
  },
};

describe("Umbraco marketing mapper", () => {
  test("maps element aliases to LP block types (contract)", () => {
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.lpHero).toBe("hero");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.lpCta).toBe("cta");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.accordionOrTab).toBe("accordionOrTab");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.alertBox).toBe("alertBox");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.anchorNavigation).toBe("anchorNavigation");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.banners).toBe("banners");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.codeBlock).toBe("codeBlock");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.textBlock).toBe("textBlock");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.heroBannerBlock).toBe("heroBannerBlock");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.dualPromoCardsBlock).toBe("dualPromoCardsBlock");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.sectionIntro).toBe("section_intro");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.logoCloud).toBe("logo_cloud");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.statsBlock).toBe("stats_block");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.testimonialBlock).toBe("testimonial_block");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.quoteBlock).toBe("quote_block");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.newsletterSignup).toBe("newsletter_signup");
    expect(UMBRACO_ELEMENT_ALIAS_TO_BLOCK_TYPE.formEmbed).toBe("form_embed");
  });

  test("maps Delivery API v2 bodyBlocks.items (live shape) into parseBody-friendly blocks", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_LIVE_DELIVERY_V2_BODYBLOCKS_FIXTURE, {
      slug: "home",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(2);
    expect(blocks[0]!.type).toBe("hero");
    expect((blocks[0]!.data as { title?: string }).title).toBe("Første live hero (Umbraco)");
    expect(blocks[1]!.type).toBe("richText");
    expect((blocks[1]!.data as { heading?: string }).heading).toBe("Første rich text-blokk");
    const meta = parseBodyMeta(row!.body);
    expect((meta as { seo?: { title?: string } }).seo?.title).toBe("Hjem — SEO");
  });

  test("mapUmbracoDeliveryItemToContentBySlugResult produces legacy body + meta", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_FIXTURE, { slug: "home" });
    expect(row).not.toBeNull();
    expect(row!.pageId).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(row!.slug).toBe("home");
    expect(row!.title).toBe("Hjem");

    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(2);
    expect(blocks[0]!.type).toBe("hero");
    expect((blocks[0]!.data as { title?: string }).title).toBe("Velkommen");
    expect(blocks[1]!.type).toBe("richText");

    const meta = parseBodyMeta(row!.body);
    expect((meta as { seo?: { title?: string } }).seo?.title).toBe("SEO tittel");
    expect((meta as { seo?: { description?: string } }).seo?.description).toBe("SEO beskrivelse");

    const md = buildCmsPageMetadata({
      pageTitle: row!.title,
      slug: row!.slug,
      body: row!.body,
    });
    expect(md.title).toContain("SEO tittel");
    expect(md.title).toContain("Lunchportalen");
  });

  test("maps mainContent blocks with settings + nested accordionItems", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_MAIN_CONTENT_ACCORDION_FIXTURE, {
      slug: "accordion-demo",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("accordionOrTab");
    const data = blocks[0]!.data as {
      sectionTitle?: string;
      displayMode?: string;
      accordionItems?: Array<{ id?: string; title?: string; body?: string }>;
      umbracoSettings?: Record<string, unknown>;
    };
    expect(data.sectionTitle).toBe("Ofte stilte spørsmål");
    expect(data.displayMode).toBe("accordion");
    expect(Array.isArray(data.accordionItems)).toBe(true);
    expect(data.accordionItems![0]!.title).toBe("Levering");
    expect(data.accordionItems![0]!.id).toBe("acc-item-1");
    expect(data.umbracoSettings?.layoutMaxWidth).toBe("normal");
    expect(data.umbracoSettings?.animationDurationMs).toBe(220);
    expect(data.umbracoSettings?.advancedEnableAnchors).toBe(true);
  });

  test("maps alertBox mainContent with settings into block type + umbracoSettings", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_MAIN_CONTENT_ALERT_FIXTURE, {
      slug: "alert-demo",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("alertBox");
    const data = blocks[0]!.data as {
      text?: string;
      umbracoSettings?: Record<string, unknown>;
    };
    expect(data.text).toContain("vedlikehold");
    expect(data.umbracoSettings?.name).toBe("Maintenance banner");
    expect(data.umbracoSettings?.componentWidth).toBe("normal");
    expect(data.umbracoSettings?.animate).toBe(true);
    expect(data.umbracoSettings?.designFlagMuted).toBe(true);
  });

  test("maps anchorNavigation with nested links + settings", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_MAIN_CONTENT_ANCHOR_NAV_FIXTURE, {
      slug: "anchor-nav-demo",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("anchorNavigation");
    const data = blocks[0]!.data as {
      navigationTitle?: string;
      links?: Array<{ id?: string; label?: string; href?: string }>;
      umbracoSettings?: Record<string, unknown>;
    };
    expect(data.navigationTitle).toBe("På denne siden");
    expect(data.links?.length).toBe(2);
    expect(data.links?.[0]?.href).toBe("#intro");
    expect(data.links?.[1]?.label).toBe("Priser");
    expect(data.umbracoSettings?.linkStyle).toBe("pills");
    expect(data.umbracoSettings?.navigationAlignment).toBe("center");
    expect(data.umbracoSettings?.backgroundOptions).toBe("{}");
    expect(data.umbracoSettings?.anchorName).toBe("page-toc");

    const { registryType, data: reg } = resolveBlockForEnterpriseRender({
      type: blocks[0]!.type,
      data: blocks[0]!.data as Record<string, unknown>,
    });
    expect(registryType).toBe("anchor_navigation");
    const links = reg.links as Array<{ label?: string; href?: string }>;
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBe(2);
    expect(links[0]!.href).toBe("#intro");
    expect(links[1]!.label).toBe("Priser");
    expect(reg.title).toBe("På denne siden");
    expect(reg.linkStyle).toBe("pills");
    expect(reg.navigationAlignment).toBe("center");
  });

  test("maps banners with nested bannerItems + carousel settings", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_MAIN_CONTENT_BANNERS_FIXTURE, {
      slug: "banners-demo",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("banners");
    const data = blocks[0]!.data as {
      enableRandomOrder?: boolean;
      bannerItems?: Array<{ id?: string; title?: string; buttonText?: string; link?: string }>;
      umbracoSettings?: Record<string, unknown>;
    };
    expect(data.enableRandomOrder).toBe(false);
    expect(data.bannerItems?.length).toBe(1);
    expect(data.bannerItems?.[0]?.title).toBe("Sommerkampanje");
    expect(data.bannerItems?.[0]?.buttonText).toBe("Les mer");
    expect(data.umbracoSettings?.showArrows).toBe(true);
    expect(data.umbracoSettings?.autoRotateSpeed).toBe(5000);
    expect(data.umbracoSettings?.name).toBe("Home hero strip");
  });

  test("maps codeBlock mainContent with content + umbracoSettings", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_MAIN_CONTENT_CODE_BLOCK_FIXTURE, {
      slug: "code-demo",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("codeBlock");
    const data = blocks[0]!.data as {
      displayIntro?: boolean;
      code?: string;
      codeBehaviour?: string;
      displayOutro?: boolean;
      umbracoSettings?: Record<string, unknown>;
    };
    expect(data.displayIntro).toBe(true);
    expect(data.code).toContain("console.log");
    expect(data.codeBehaviour).toBe("displayCode");
    expect(data.displayOutro).toBe(false);
    expect(data.umbracoSettings?.componentWidth).toBe("normal");
    expect(data.umbracoSettings?.hideFromWebsite).toBe(false);
    expect(data.umbracoSettings?.name).toBe("Sample snippet");
  });

  test("maps textBlock mainContent with rich text + umbracoSettings", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_MAIN_CONTENT_TEXT_BLOCK_FIXTURE, {
      slug: "text-demo",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("textBlock");
    const data = blocks[0]!.data as {
      displayIntro?: boolean;
      text?: string;
      displayOutro?: boolean;
      umbracoSettings?: Record<string, unknown>;
    };
    expect(data.displayIntro).toBe(false);
    expect(data.text).toContain("textBlock");
    expect(data.displayOutro).toBe(true);
    expect(data.umbracoSettings?.componentWidth).toBe("normal");
    expect(data.umbracoSettings?.animate).toBe(true);
    expect(data.umbracoSettings?.anchorName).toBe("intro-text");
    expect(data.umbracoSettings?.hideFromWebsite).toBe(false);
  });

  test("maps heroBannerBlock with nested quickLinks + sublineItems + settings", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_MAIN_CONTENT_HERO_BANNER_FIXTURE, {
      slug: "hero-demo",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("heroBannerBlock");
    const data = blocks[0]!.data as {
      topbarText?: string;
      title?: string;
      quickLinks?: Array<{ id?: string; label?: string; isImportant?: boolean }>;
      sublineItems?: Array<{ id?: string; text?: string }>;
      primaryCtaLabel?: string;
      umbracoSettings?: Record<string, unknown>;
    };
    expect(data.topbarText).toContain("frakt");
    expect(data.title).toBe("Ukens lunsj");
    expect(data.quickLinks?.length).toBe(2);
    expect(data.quickLinks?.[0]?.label).toBe("VIKTIGE BESKJEDER");
    expect(data.quickLinks?.[0]?.isImportant).toBe(true);
    expect(data.sublineItems?.[1]?.text).toBe("Rask levering");
    expect(data.primaryCtaLabel).toBe("Bestill nå");
    expect(data.umbracoSettings?.bannerVariant).toBe("standard");
    expect(data.umbracoSettings?.quickLinksPosition).toBe("topCenter");
    expect(data.umbracoSettings?.overlayStrength).toBe(40);
    expect(data.umbracoSettings?.importantQuickLinkStyle).toBe("pill-emphasis");
  });

  test("maps dualPromoCardsBlock with nested items + settings", () => {
    const row = mapUmbracoDeliveryItemToContentBySlugResult(UMBRACO_MAIN_CONTENT_DUAL_PROMO_FIXTURE, {
      slug: "dual-promo-demo",
    });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.type).toBe("dualPromoCardsBlock");
    const data = blocks[0]!.data as {
      sectionId?: string;
      maxWidthVariant?: string;
      items?: Array<{ id?: string; title?: string; eyebrow?: string; ctaUrl?: string }>;
      umbracoSettings?: Record<string, unknown>;
    };
    expect(data.sectionId).toBe("promo-deco");
    expect(data.items?.length).toBe(2);
    expect(data.items?.[0]?.title).toBe("DecoAndeli");
    expect(data.items?.[1]?.eyebrow).toBe("Nyhet");
    expect(data.umbracoSettings?.columnsDesktop).toBe("2");
    expect(data.umbracoSettings?.stackOnMobile).toBe(true);
    expect(data.umbracoSettings?.contentBoxStyle).toBe("darkOverlay");
    expect(data.umbracoSettings?.overlayStyle).toBe("gradientDark");
    expect(data.umbracoSettings?.hoverEffect).toBe("lift");

    const { registryType, data: reg } = resolveBlockForEnterpriseRender({
      type: blocks[0]!.type,
      data: blocks[0]!.data as Record<string, unknown>,
    });
    expect(registryType).toBe("dual_promo_cards");
    const cards = reg.cards as Array<{ title?: string; ctaUrl?: string; eyebrow?: string }>;
    expect(Array.isArray(cards)).toBe(true);
    expect(cards.length).toBe(2);
    expect(cards[0]!.title).toBe("DecoAndeli");
    expect(cards[0]!.ctaUrl).toBe("/deco");
    expect(cards[1]!.eyebrow).toBe("Nyhet");
    expect(reg.sectionId).toBe("promo-deco");
  });
});

const fetchMock = vi.hoisted(() => vi.fn());

vi.stubGlobal("fetch", fetchMock);

let experimentsRow: { id: string; status: string } | null = null;
let contentPageRow: Record<string, unknown> | null = null;
let variantRow: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  hasSupabaseAdminConfig: () => true,
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "experiments") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: experimentsRow, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "experiment_variants") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === "content_pages") {
        const q: {
          _slug?: string;
          _status?: string;
          select: () => typeof q;
          eq: (col: string, val: string) => typeof q;
          maybeSingle: () => Promise<{ data: unknown; error: null }>;
        } = {
          select() {
            return q;
          },
          eq(col: string, val: string) {
            if (col === "slug") q._slug = val;
            if (col === "status") q._status = val;
            return q;
          },
          maybeSingle: async () => {
            if (
              q._status === "published" &&
              contentPageRow &&
              String((contentPageRow as { slug?: string }).slug ?? "") === q._slug
            ) {
              return { data: contentPageRow, error: null };
            }
            return { data: null, error: null };
          },
        };
        return q;
      }
      if (table === "content_page_variants") {
        const q: {
          _pageId?: string;
          _locale?: string;
          _env?: string;
          select: () => typeof q;
          eq: (col: string, val: string) => typeof q;
          maybeSingle: () => Promise<{ data: unknown; error: null }>;
        } = {
          select() {
            return q;
          },
          eq(col: string, val: string) {
            if (col === "page_id") q._pageId = val;
            if (col === "locale") q._locale = val;
            if (col === "environment") q._env = val;
            return q;
          },
          maybeSingle: async () => {
            if (q._pageId && q._locale === "nb" && q._env === "prod") {
              return { data: variantRow, error: null };
            }
            return { data: null, error: null };
          },
        };
        return q;
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    },
  }),
}));

describe("getContentBySlug — Umbraco dual-read gate", () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    experimentsRow = null;
    contentPageRow = null;
    variantRow = null;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("allowlisted slug uses Umbraco when fetch returns 200", async () => {
    vi.stubEnv("UMBRACO_DELIVERY_BASE_URL", "https://cms.example.test");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(UMBRACO_FIXTURE), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const { getContentBySlug } = await import("@/lib/cms/public/getContentBySlug");
    const res = await getContentBySlug("home");
    expect(res?.title).toBe("Hjem");
    expect(res?.publicContentOrigin).toBe("live-umbraco");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("https://cms.example.test/umbraco/delivery/api/v2/content/item/home");
  });

  test("allowlisted slug does not use Supabase editorially when Umbraco is configured but fetch fails (fail-closed)", async () => {
    vi.stubEnv("UMBRACO_DELIVERY_BASE_URL", "https://cms.example.test");
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    contentPageRow = {
      id: "page-1",
      slug: "home",
      title: "Supabase tittel",
      status: "published",
    };
    variantRow = {
      id: "var-1",
      body: { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "X", body: "Y" } }] },
    };

    const { getContentBySlug } = await import("@/lib/cms/public/getContentBySlug");
    const res = await getContentBySlug("home");
    expect(res).toBeNull();
  });

  test("allowlisted slug returns null when Delivery base URL is missing (no Supabase substitute)", async () => {
    vi.stubEnv("UMBRACO_DELIVERY_BASE_URL", "");
    contentPageRow = {
      id: "page-home-sb",
      slug: "home",
      title: "Supabase tittel",
      status: "published",
    };
    variantRow = {
      id: "var-1",
      body: { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "X", body: "Y" } }] },
    };

    const { getContentBySlug } = await import("@/lib/cms/public/getContentBySlug");
    const res = await getContentBySlug("home");
    expect(res).toBeNull();
  });

  test("non-allowlisted slug: public getContentBySlug never reads Supabase (internal reader does)", async () => {
    vi.stubEnv("UMBRACO_DELIVERY_BASE_URL", "https://cms.example.test");
    contentPageRow = {
      id: "page-internal",
      slug: "internal-cms-only",
      title: "Intern side",
      status: "published",
    };
    variantRow = {
      id: "var-1",
      body: { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "X", body: "Y" } }] },
    };

    const { getContentBySlug } = await import("@/lib/cms/public/getContentBySlug");
    const { readSupabasePublishedContentPageBySlug } = await import("@/lib/cms/supabase/readPublishedContentPageBySlug");
    expect(await getContentBySlug("internal-cms-only")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    const sb = await readSupabasePublishedContentPageBySlug("internal-cms-only");
    expect(sb?.publicContentOrigin).toBe("live-supabase");
    expect(sb?.title).toBe("Intern side");
  });

  test("mainContent Umbraco element types map to enterprise registry (render parity)", () => {
    const cases: Array<{ fixture: unknown; slug: string; expectedRegistry: string }> = [
      { fixture: UMBRACO_MAIN_CONTENT_ACCORDION_FIXTURE, slug: "accordion-demo", expectedRegistry: "accordion_tabs" },
      { fixture: UMBRACO_MAIN_CONTENT_ALERT_FIXTURE, slug: "alert-demo", expectedRegistry: "alert_bar" },
      { fixture: UMBRACO_MAIN_CONTENT_ANCHOR_NAV_FIXTURE, slug: "anchor-nav-demo", expectedRegistry: "anchor_navigation" },
      { fixture: UMBRACO_MAIN_CONTENT_BANNERS_FIXTURE, slug: "banners-demo", expectedRegistry: "banner_carousel" },
      { fixture: UMBRACO_MAIN_CONTENT_CODE_BLOCK_FIXTURE, slug: "code-demo", expectedRegistry: "code_block" },
      { fixture: UMBRACO_MAIN_CONTENT_TEXT_BLOCK_FIXTURE, slug: "text-demo", expectedRegistry: "rich_text" },
      { fixture: UMBRACO_MAIN_CONTENT_HERO_BANNER_FIXTURE, slug: "hero-demo", expectedRegistry: "hero_bleed" },
      { fixture: UMBRACO_MAIN_CONTENT_DUAL_PROMO_FIXTURE, slug: "dual-promo-demo", expectedRegistry: "dual_promo_cards" },
      { fixture: UMBRACO_MAIN_CONTENT_SECTION_INTRO_FIXTURE, slug: "section-intro-demo", expectedRegistry: "section_intro" },
      { fixture: UMBRACO_MAIN_CONTENT_LOGO_CLOUD_FIXTURE, slug: "logo-cloud-demo", expectedRegistry: "logo_cloud" },
      { fixture: UMBRACO_MAIN_CONTENT_STATS_BLOCK_FIXTURE, slug: "stats-demo", expectedRegistry: "stats_block" },
      { fixture: UMBRACO_MAIN_CONTENT_TESTIMONIAL_FIXTURE, slug: "testimonial-demo", expectedRegistry: "testimonial_block" },
      { fixture: UMBRACO_MAIN_CONTENT_QUOTE_FIXTURE, slug: "quote-demo", expectedRegistry: "quote_block" },
      { fixture: UMBRACO_MAIN_CONTENT_NEWSLETTER_FIXTURE, slug: "newsletter-demo", expectedRegistry: "newsletter_signup" },
      { fixture: UMBRACO_MAIN_CONTENT_FORM_EMBED_FIXTURE, slug: "form-embed-demo", expectedRegistry: "form_embed" },
    ];
    for (const { fixture, slug, expectedRegistry } of cases) {
      const row = mapUmbracoDeliveryItemToContentBySlugResult(fixture, { slug });
      expect(row).not.toBeNull();
      const blocks = parseBody(row!.body);
      expect(blocks.length).toBe(1);
      const b = blocks[0]!;
      const { registryType, data } = resolveBlockForEnterpriseRender({
        type: b.type,
        data: b.data as Record<string, unknown>,
      });
      expect(registryType, `${slug}: ${b.type}`).toBe(expectedRegistry);
      expect(isEnterpriseRegistryBlockType(registryType)).toBe(true);
      expect(Object.keys(data).length).toBeGreaterThan(0);
    }
  });

  test("Umbraco banners maps every nested bannerItem into banner_carousel.slides", () => {
    const fx = structuredClone(UMBRACO_MAIN_CONTENT_BANNERS_FIXTURE) as typeof UMBRACO_MAIN_CONTENT_BANNERS_FIXTURE;
    const bannerRoot = fx.properties.mainContent.items[0]!.content.properties.bannerItems as {
      items: unknown[];
    };
    bannerRoot.items.push({
      content: {
        contentType: "bannerItem",
        id: "banner-item-2",
        properties: {
          title: "Høstkampanje",
          subtitle: "15 % rabatt",
          link: "/host",
          buttonText: "Se tilbud",
          image: null,
        },
      },
    });
    const row = mapUmbracoDeliveryItemToContentBySlugResult(fx, { slug: "banners-demo" });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks[0]!.type).toBe("banners");
    const { registryType, data } = resolveBlockForEnterpriseRender({
      type: blocks[0]!.type,
      data: blocks[0]!.data as Record<string, unknown>,
    });
    expect(registryType).toBe("banner_carousel");
    const slides = data.slides as Array<{ title?: string }>;
    expect(Array.isArray(slides)).toBe(true);
    expect(slides.length).toBe(2);
    expect(slides[0]!.title).toBe("Sommerkampanje");
    expect(slides[1]!.title).toBe("Høstkampanje");
  });

  test("Umbraco accordionOrTab maps to accordion_tabs with all nested items and displayMode", () => {
    const fx = structuredClone(UMBRACO_MAIN_CONTENT_ACCORDION_FIXTURE) as typeof UMBRACO_MAIN_CONTENT_ACCORDION_FIXTURE;
    const items = fx.properties.mainContent.items[0]!.content.properties.accordionItems as { items: unknown[] };
    items.items.push({
      content: {
        contentType: "accordionOrTabItem",
        id: "acc-item-2",
        properties: { title: "Fakturering", body: "Standard NET 14." },
      },
    });
    (fx.properties.mainContent.items[0]!.content.properties as { displayMode: string }).displayMode = "tabs";
    const row = mapUmbracoDeliveryItemToContentBySlugResult(fx, { slug: "accordion-demo" });
    expect(row).not.toBeNull();
    const blocks = parseBody(row!.body);
    expect(blocks[0]!.type).toBe("accordionOrTab");
    const { registryType, data } = resolveBlockForEnterpriseRender({
      type: blocks[0]!.type,
      data: blocks[0]!.data as Record<string, unknown>,
    });
    expect(registryType).toBe("accordion_tabs");
    expect(data.displayMode).toBe("tabs");
    const panels = data.items as Array<{ title?: string }>;
    expect(panels.length).toBe(2);
    expect(panels[0]!.title).toBe("Levering");
    expect(panels[1]!.title).toBe("Fakturering");
  });
});

describe("Umbraco Delivery — parseBody + normalizeBlockForRender + renderBlock", () => {
  const pipelineCases: Array<{ fixture: unknown; slug: string; needle: string }> = [
    { fixture: UMBRACO_MAIN_CONTENT_SECTION_INTRO_FIXTURE, slug: "section-intro-demo", needle: "Kontroll og trygghet" },
    { fixture: UMBRACO_MAIN_CONTENT_LOGO_CLOUD_FIXTURE, slug: "logo-cloud-demo", needle: "partner-a.png" },
    { fixture: UMBRACO_MAIN_CONTENT_STATS_BLOCK_FIXTURE, slug: "stats-demo", needle: "99 %" },
    { fixture: UMBRACO_MAIN_CONTENT_TESTIMONIAL_FIXTURE, slug: "testimonial-demo", needle: "Strålende service" },
    { fixture: UMBRACO_MAIN_CONTENT_QUOTE_FIXTURE, slug: "quote-demo", needle: "Kvalitet og forutsigbarhet" },
    { fixture: UMBRACO_MAIN_CONTENT_NEWSLETTER_FIXTURE, slug: "newsletter-demo", needle: 'name="email"' },
    { fixture: UMBRACO_MAIN_CONTENT_FORM_EMBED_FIXTURE, slug: "form-embed-demo", needle: "https://forms.test/embed" },
  ];

  for (const { fixture, slug, needle } of pipelineCases) {
    test(`pipeline renders (${slug})`, () => {
      const row = mapUmbracoDeliveryItemToContentBySlugResult(fixture, { slug });
      expect(row).not.toBeNull();
      const blocks = parseBody(row!.body);
      expect(blocks.length).toBe(1);
      const b = blocks[0]!;
      const node = normalizeBlockForRender(
        {
          id: typeof b.id === "string" && b.id.trim() ? b.id : "b0",
          type: b.type,
          data: (b.data ?? {}) as Record<string, unknown>,
        },
        0,
      );
      const out = renderBlock(node, "prod", "nb");
      const html = renderToStaticMarkup(React.createElement(React.Fragment, null, out));
      expect(html).toContain(needle);
    });
  }
});
