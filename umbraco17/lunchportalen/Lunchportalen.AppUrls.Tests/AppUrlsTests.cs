using Lunchportalen.Helpers;
using Xunit;

namespace Lunchportalen.Helpers.Tests;

public class AppUrlsTests
{
    [Theory]
    [InlineData("hero")]
    [InlineData("cta-band")]
    [InlineData("header-cta")]
    public void ResolveLeadCapture_AlwaysReturnsAppDemoWithSource(string source)
    {
        var result = AppUrls.ResolveLeadCapture(source);
        Assert.Equal($"https://app.lunchportalen.no/demo?source={source}", result);
    }

    [Fact]
    public void ResolveLeadCapture_IsUnconditional_RegardlessOfLegacyUrlInputs()
    {
        foreach (var ignored in new[] { null, "/Demo", "/demo/", "Demo", "/kontakt", "https://example.com/x" })
        {
            _ = ignored;
            var result = AppUrls.ResolveLeadCapture("test-source");
            Assert.StartsWith("https://app.lunchportalen.no/demo?source=", result);
            Assert.DoesNotContain("lunchportalen.no/demo/", result);
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("/login")]
    [InlineData("/Login")]
    [InlineData("/LOGG-INN")]
    [InlineData("/logg-inn/")]
    [InlineData("/registrering")]
    [InlineData("/week")]
    public void ResolveLogin_SameOriginFailClosedToAppLogin(string? url)
    {
        Assert.Equal(AppUrls.Login, AppUrls.ResolveLogin(url));
    }

    [Fact]
    public void ResolveLogin_ExternalAbsolute_Passthrough()
    {
        const string external = "https://example.com/login";
        Assert.Equal(external, AppUrls.ResolveLogin(external));
    }

    [Theory]
    [InlineData(null, "/demo/")]
    [InlineData("", "/demo/")]
    [InlineData("/Demo", "/demo/")]
    [InlineData("/demo", "/demo/")]
    [InlineData("/demo/", "/demo/")]
    [InlineData("/priser/", "/demo/")]
    public void ResolveMarketingDemoPage_OnlyAllowsMarketingDemoRelative(string? url, string expected)
    {
        Assert.Equal(expected, AppUrls.ResolveMarketingDemoPage(url));
    }

    [Theory]
    [InlineData(null, "/loesningen/", "/loesningen/")]
    [InlineData("/priser", "/priser/", "/priser/")]
    [InlineData("/loesningen", "/loesningen/", "/loesningen/")]
    [InlineData("/losningen", "/loesningen/", "/loesningen/")]
    [InlineData("/losningen/", "/loesningen/", "/loesningen/")]
    public void ResolveNavigation_NormalizesInternalRelative(string? url, string fallback, string expected)
    {
        Assert.Equal(expected, AppUrls.ResolveNavigation(url, fallback));
    }

    [Theory]
    [InlineData("/Demo/", "hero-secondary", "https://app.lunchportalen.no/demo?source=hero-secondary")]
    [InlineData("/kontakt/", "hero-secondary", "https://app.lunchportalen.no/demo?source=hero-secondary")]
    [InlineData("/kom-i-gang", "kom-i-gang-hero-secondary", "https://app.lunchportalen.no/demo?source=kom-i-gang-hero-secondary")]
    [InlineData("#demo-video", "hero-secondary", "#demo-video")]
    [InlineData(null, "hero-secondary", "/loesningen/")]
    [InlineData("/loesningen/", "hero-secondary", "/loesningen/")]
    [InlineData("/losningen/", "hero-secondary", "/loesningen/")]
    public void ResolveGenericHeroSecondary_ClassifiesIntent(string? url, string source, string expected)
    {
        Assert.Equal(expected, AppUrls.ResolveGenericHeroSecondary(url, source));
    }

    [Theory]
    [InlineData("#kontakt", "#kontakt", "#kontakt")]
    [InlineData("#demo-video", "#demo-video", "#demo-video")]
    [InlineData(null, "#kontakt", "#kontakt")]
    [InlineData("/demo/", "#demo-video", "#demo-video")]
    public void ResolveSamePageAnchor_OnlyAcceptsFragment(string? url, string fallback, string expected)
    {
        Assert.Equal(expected, AppUrls.ResolveSamePageAnchor(url, fallback));
    }
}
