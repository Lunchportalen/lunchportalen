using System.Linq;

using System.Text.Json;

using Microsoft.Extensions.Logging;

using Umbraco.Cms.Core;

using Umbraco.Cms.Core.Events;

using Umbraco.Cms.Core.Models;

using Umbraco.Cms.Core.Notifications;

using Umbraco.Cms.Core.Services;

using Umbraco.Extensions;



namespace MarketingPhase1;



/// <summary>

/// Phase-1 marketing <strong>content</strong> bootstrap only.

/// <para><strong>Schema</strong> (document types, elements, data types, block list) lives in <c>uSync/v17</c> and is imported at startup (<c>appsettings.json</c>).</para>

/// <para>Creates <c>home</c> / <c>phase1-demo</c> from code only if missing; fills empty <c>home</c> bodyBlocks when safe.</para>

/// </summary>

public sealed class MarketingPhase1StartupHandler : INotificationHandler<UmbracoApplicationStartedNotification>

{

    private const int UserId = Constants.Security.SuperUserId;



    private readonly IRuntimeState _runtimeState;

    private readonly IContentTypeService _contentTypeService;

    private readonly IContentService _contentService;

    private readonly ILogger<MarketingPhase1StartupHandler> _logger;



    public MarketingPhase1StartupHandler(

        IRuntimeState runtimeState,

        IContentTypeService contentTypeService,

        IContentService contentService,

        ILogger<MarketingPhase1StartupHandler> logger)

    {

        _runtimeState = runtimeState;

        _contentTypeService = contentTypeService;

        _contentService = contentService;

        _logger = logger;

    }



    public void Handle(UmbracoApplicationStartedNotification notification)

    {

        if (_runtimeState.Level != RuntimeLevel.Run)

        {

            return;

        }



        try

        {

            EnsureSchemaAndContent();

            PopulateHomeBodyBlocksIfEmpty();

        }

        catch (Exception ex)

        {

            _logger.LogError(ex, "MarketingPhase1: content bootstrap failed.");

        }

    }



    private void EnsureSchemaAndContent()

    {

        IContentType? doc = _contentTypeService.Get(MarketingPhase1Guids.DocumentMarketingPage)

            ?? _contentTypeService.GetAll().FirstOrDefault(ct => ct.Alias.InvariantEquals("marketingPage"));



        if (doc == null)

        {

            _logger.LogWarning(

                "MarketingPhase1: document type alias marketingPage not found. Ensure uSync is enabled (uSync:Settings:ImportAtStartup = All) and uSync/v17 is present in the repo. See uSync/README.md.");

            return;

        }



        if (CanSeedMarketingPages(doc))

        {

            EnsurePublishedContent();

        }

    }



    /// <summary>Creates published seed pages only when missing (fallback if uSync content is not imported).</summary>

    private static bool CanSeedMarketingPages(IContentType doc)

    {

        IEnumerable<string> aliases = doc.PropertyTypes

            .Concat(doc.CompositionPropertyTypes)

            .Select(p => p.Alias)

            .Distinct(StringComparer.OrdinalIgnoreCase);



        static bool Has(IEnumerable<string> a, string alias) => a.Any(x => x.InvariantEquals(alias));



        return Has(aliases, "pageTitle")

            && Has(aliases, "routeSlug")

            && Has(aliases, "bodyBlocks");

    }



    private void EnsurePublishedContent()

    {

        if (_contentService.GetById(MarketingPhase1Guids.ContentHome) == null)

        {

            SeedPage(

                MarketingPhase1Guids.ContentHome,

                "Hjem",

                "Hjem",

                "home",

                heroDemo: false,

                includeRichText: true);

        }



        if (_contentService.GetById(MarketingPhase1Guids.ContentPhase1Demo) == null)

        {

            SeedPage(

                MarketingPhase1Guids.ContentPhase1Demo,

                "Phase1 demo",

                "Phase1 demo side",

                "phase1-demo",

                heroDemo: true,

                includeRichText: false);

        }

    }



    private void PopulateHomeBodyBlocksIfEmpty()

    {

        IContent? home = _contentService.GetById(MarketingPhase1Guids.ContentHome) ?? FindHomeMarketingPageByRoute();

        if (home == null || !home.ContentType.Alias.InvariantEquals("marketingPage"))

        {

            return;

        }



        string? raw = home.GetValue<string>("bodyBlocks");

        if (HasNonEmptyBlockListRaw(raw))

        {

            return;

        }



        Guid heroKey = Guid.NewGuid();

        Guid richKey = Guid.NewGuid();

        home.SetValue(

            "bodyBlocks",

            BuildBodyBlocksJson(

                MarketingPhase1Guids.ElementLpHero,

                MarketingPhase1Guids.ElementLpRichText,

                heroKey,

                richKey,

                heroDemo: false));



        _contentService.Save(home, UserId);

        _contentService.Publish(home, new[] { "*" }, UserId);

        _logger.LogDebug("MarketingPhase1: populated bodyBlocks on home ({HomeId}).", home.Key);

    }



    private IContent? FindHomeMarketingPageByRoute()

    {

        return FindHomeMarketingPageRecursive(Constants.System.Root);

    }



    private IContent? FindHomeMarketingPageRecursive(int parentId)

    {

        IEnumerable<IContent> children = _contentService.GetPagedChildren(parentId, 0, 500, out _);

        foreach (IContent c in children)

        {

            if (c.ContentType.Alias.InvariantEquals("marketingPage"))

            {

                string? slug = c.GetValue<string>("routeSlug");

                if (!string.IsNullOrWhiteSpace(slug) && slug.InvariantEquals("home"))

                {

                    return c;

                }



                if (!string.IsNullOrWhiteSpace(c.Name) && c.Name.InvariantEquals("home"))

                {

                    return c;

                }

            }



            IContent? nested = FindHomeMarketingPageRecursive(c.Id);

            if (nested != null)

            {

                return nested;

            }

        }



        return null;

    }



    private static bool HasNonEmptyBlockListRaw(string? raw)

    {

        if (string.IsNullOrWhiteSpace(raw))

        {

            return false;

        }



        try

        {

            using JsonDocument doc = JsonDocument.Parse(raw);

            if (!doc.RootElement.TryGetProperty("layout", out JsonElement layout) &&

                !doc.RootElement.TryGetProperty("Layout", out layout))

            {

                return true;

            }



            if (!layout.TryGetProperty("Umbraco.BlockList", out JsonElement list) || list.ValueKind != JsonValueKind.Array)

            {

                return true;

            }



            return list.GetArrayLength() > 0;

        }

        catch (JsonException)

        {

            return false;

        }

    }



    private void SeedPage(Guid key, string nodeName, string pageTitle, string routeSlug, bool heroDemo, bool includeRichText)

    {

        IContent content = _contentService.Create(nodeName, Constants.System.Root, "marketingPage", UserId);

        content.Key = key;

        content.SetValue("pageTitle", pageTitle);

        content.SetValue("routeSlug", routeSlug);

        content.SetValue("seoTitle", $"{pageTitle} — SEO");

        content.SetValue("seoDescription", "Phase-1 Umbraco marketing seed for Delivery verification.");



        Guid heroKey = Guid.NewGuid();

        Guid? richTextKey = includeRichText ? Guid.NewGuid() : null;

        content.SetValue(

            "bodyBlocks",

            BuildBodyBlocksJson(MarketingPhase1Guids.ElementLpHero, MarketingPhase1Guids.ElementLpRichText, heroKey, richTextKey, heroDemo));



        _contentService.Save(content, UserId);

        _contentService.Publish(content, new[] { "*" }, UserId);

    }



    private static string BuildBodyBlocksJson(

        Guid lpHeroTypeKey,

        Guid lpRichTextTypeKey,

        Guid heroInstanceKey,

        Guid? richTextInstanceKey,

        bool heroDemo)

    {

        var layout = new List<Dictionary<string, string>>

        {

            new() { ["contentUdi"] = UdiElement(heroInstanceKey) },

        };



        var contentData = new List<Dictionary<string, object?>>

        {

            new()

            {

                ["udi"] = UdiElement(heroInstanceKey),

                ["contentTypeKey"] = lpHeroTypeKey.ToString(),

                ["title"] = heroDemo ? "Phase1-demo" : "Første live hero (Umbraco)",

                ["subtitle"] = heroDemo ? "Ekstra tillatt slug for dual-read" : "Kort undertekst for Delivery → adapter-test",

                ["imageId"] = "",

                ["imageAlt"] = "",

                ["ctaLabel"] = heroDemo ? "Hjem" : "Les mer",

                ["ctaHref"] = heroDemo ? "/" : "/kontakt",

            },

        };



        if (richTextInstanceKey is { } rtKey)

        {

            layout.Add(new Dictionary<string, string> { ["contentUdi"] = UdiElement(rtKey) });

            contentData.Add(

                new Dictionary<string, object?>

                {

                    ["udi"] = UdiElement(rtKey),

                    ["contentTypeKey"] = lpRichTextTypeKey.ToString(),

                    ["heading"] = "Første rich text-blokk",

                    ["body"] = "<p>Live <strong>bodyBlocks</strong> fra Umbraco via Delivery API.</p>",

                });

        }



        var blockListObject = new

        {

            layout = new Dictionary<string, object> { ["Umbraco.BlockList"] = layout },

            contentData,

            settingsData = Array.Empty<Dictionary<string, object?>>(),

        };



        return JsonSerializer.Serialize(blockListObject);

    }



    private static string UdiElement(Guid g) => "umb://element/" + g.ToString("N");

}


