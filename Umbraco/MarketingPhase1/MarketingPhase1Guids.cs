namespace MarketingPhase1;

/// <summary>Stable keys for marketing phase-1 schema + seed content (uSync-friendly).</summary>
public static class MarketingPhase1Guids
{
    public static readonly Guid DataTypeBodyBlocks = Guid.Parse("a1b2c3d4-e5f6-4789-a012-345678901234");

    public static readonly Guid ElementLpHero = Guid.Parse("b2c3d4e0-f5a6-4890-b123-456789012345");
    public static readonly Guid ElementLpRichText = Guid.Parse("c3d4e5f6-a7b8-4901-c234-567890123456");
    public static readonly Guid ElementLpImage = Guid.Parse("d4e5f6a7-b8c9-4012-d345-678901234567");
    public static readonly Guid ElementLpCards = Guid.Parse("e5f6a7b8-c9d0-4123-e456-789012345678");
    public static readonly Guid ElementLpCta = Guid.Parse("f6a7b8c9-d0e1-4234-f567-890123456789");

    public static readonly Guid CompositionSeoMeta = Guid.Parse("a7b8c9d0-e1f2-4345-a678-901234567890");
    public static readonly Guid DocumentMarketingPage = Guid.Parse("b8c9d0e1-f2a3-4456-b789-012345678901");

    /** Canonical public page document types (same property aliases + SEO composition as marketingPage). */
    public static readonly Guid DocumentHomePage = Guid.Parse("c1a0f3e2-9b4d-4d8a-a3c1-7e2f9d0a1b01");

    public static readonly Guid DocumentContentPage = Guid.Parse("c1a0f3e2-9b4d-4d8a-a3c1-7e2f9d0a1b02");

    public static readonly Guid DocumentContactPage = Guid.Parse("c1a0f3e2-9b4d-4d8a-a3c1-7e2f9d0a1b03");

    public static readonly Guid DocumentLegalPage = Guid.Parse("c1a0f3e2-9b4d-4d8a-a3c1-7e2f9d0a1b04");

    public static readonly Guid DocumentLandingPage = Guid.Parse("c1a0f3e2-9b4d-4d8a-a3c1-7e2f9d0a1b05");
    public static readonly Guid DocumentGlobalSettings = Guid.Parse("a0cc0ded-2a00-4001-8001-000000000001");
    public static readonly Guid DocumentDesignSettings = Guid.Parse("a0cc0ded-3a00-4001-8001-000000000001");

    public static readonly Guid ContentHome = Guid.Parse("c9d0e1f2-a3b4-4567-c890-123456789012");
    public static readonly Guid ContentGlobalSettings = Guid.Parse("a0cc0ded-2c00-4001-8001-000000000001");
    public static readonly Guid ContentDesignSettingsDefault = Guid.Parse("a0cc0ded-3c00-4001-8001-000000000001");
    public static readonly Guid ContentDesignSettingsShop = Guid.Parse("a0cc0ded-3c00-4001-8001-000000000002");
    public static readonly Guid ContentPhase1Demo = Guid.Parse("d0e1f2a3-b4c5-4678-d901-234567890123");

    public static readonly Guid ElementAccordionOrTab = Guid.Parse("a0cc0ded-0001-4001-8001-000000000011");
    public static readonly Guid ElementAccordionOrTabItem = Guid.Parse("a0cc0ded-0001-4001-8001-000000000012");
    public static readonly Guid ElementAccordionOrTabSettings = Guid.Parse("a0cc0ded-0001-4001-8001-000000000013");
    public static readonly Guid DataTypeMainContentBlocks = Guid.Parse("a0cc0ded-0001-4001-8001-000000000020");
    public static readonly Guid DataTypeAccordionNestedItems = Guid.Parse("a0cc0ded-0001-4001-8001-000000000021");

    public static readonly Guid ElementAlertBox = Guid.Parse("a0cc0ded-0001-4001-8001-000000000030");
    public static readonly Guid ElementAlertBoxSettings = Guid.Parse("a0cc0ded-0001-4001-8001-000000000031");

    public static readonly Guid ElementAnchorNavigation = Guid.Parse("a0cc0ded-0001-4001-8001-000000000040");
    public static readonly Guid ElementAnchorNavigationLink = Guid.Parse("a0cc0ded-0001-4001-8001-000000000041");
    public static readonly Guid ElementAnchorNavigationSettings = Guid.Parse("a0cc0ded-0001-4001-8001-000000000042");
    public static readonly Guid DataTypeAnchorNavigationLinks = Guid.Parse("a0cc0ded-0001-4001-8001-000000000043");

    public static readonly Guid ElementBanners = Guid.Parse("a0cc0ded-0001-4001-8001-000000000050");
    public static readonly Guid ElementBannerItem = Guid.Parse("a0cc0ded-0001-4001-8001-000000000051");
    public static readonly Guid ElementBannersSettings = Guid.Parse("a0cc0ded-0001-4001-8001-000000000052");
    public static readonly Guid DataTypeBannersNestedItems = Guid.Parse("a0cc0ded-0001-4001-8001-000000000053");

    public static readonly Guid ElementCodeBlock = Guid.Parse("a0cc0ded-0001-4001-8001-000000000060");
    public static readonly Guid ElementCodeBlockSettings = Guid.Parse("a0cc0ded-0001-4001-8001-000000000061");
    public static readonly Guid DataTypeCodeBehaviour = Guid.Parse("a0cc0ded-0001-4001-8001-000000000062");

    public static readonly Guid ElementTextBlock = Guid.Parse("a0cc0ded-0001-4001-8001-000000000064");
    public static readonly Guid ElementTextBlockSettings = Guid.Parse("a0cc0ded-0001-4001-8001-000000000065");

    public static readonly Guid ElementHeroBannerBlock = Guid.Parse("a0cc0ded-0001-4001-8001-000000000070");
    public static readonly Guid ElementHeroBannerBlockSettings = Guid.Parse("a0cc0ded-0001-4001-8001-000000000071");
    public static readonly Guid ElementQuickLinkItem = Guid.Parse("a0cc0ded-0001-4001-8001-000000000072");
    public static readonly Guid ElementSublineItem = Guid.Parse("a0cc0ded-0001-4001-8001-000000000073");
    public static readonly Guid DataTypeHeroBannerQuickLinks = Guid.Parse("a0cc0ded-0001-4001-8001-000000000074");
    public static readonly Guid DataTypeHeroBannerSublineItems = Guid.Parse("a0cc0ded-0001-4001-8001-000000000075");
    public static readonly Guid DataTypeHeroBannerVariant = Guid.Parse("a0cc0ded-0001-4001-8001-000000000076");
    public static readonly Guid DataTypeHeroBannerTitleSize = Guid.Parse("a0cc0ded-0001-4001-8001-000000000077");

    public static readonly Guid ElementDualPromoCardsBlock = Guid.Parse("a0cc0ded-0001-4001-8001-000000000080");
    public static readonly Guid ElementDualPromoCardsBlockSettings = Guid.Parse("a0cc0ded-0001-4001-8001-000000000081");
    public static readonly Guid ElementPromoCardItem = Guid.Parse("a0cc0ded-0001-4001-8001-000000000082");
    public static readonly Guid DataTypeDualPromoCardItems = Guid.Parse("a0cc0ded-0001-4001-8001-000000000083");
    public static readonly Guid DataTypeDualPromoColumnsDesktop = Guid.Parse("a0cc0ded-0001-4001-8001-000000000084");
    public static readonly Guid DataTypeDualPromoContentPosition = Guid.Parse("a0cc0ded-0001-4001-8001-000000000085");
    public static readonly Guid DataTypeDualPromoContentBoxStyle = Guid.Parse("a0cc0ded-0001-4001-8001-000000000086");
    public static readonly Guid DataTypeDualPromoOverlayStyle = Guid.Parse("a0cc0ded-0001-4001-8001-000000000087");
}
