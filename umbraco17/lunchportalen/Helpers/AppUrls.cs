namespace Lunchportalen.Helpers;

/// <summary>
/// Canonical cross-domain links to the Next.js app (presentation-only in Umbraco).
/// Routing is intent-driven: call sites choose the resolver method, not URL substring guessing.
/// </summary>
public static class AppUrls
{
    public const string Login = "https://app.lunchportalen.no/login";

    private const string StartBase = "https://app.lunchportalen.no/start";
    private const string DemoBase = "https://app.lunchportalen.no/demo";

    private static readonly string[] LoginPaths = ["/login", "/logg-inn"];

    private static readonly string[] LeadCapturePaths =
    [
        "/start",
        "/demo",
        "/kom-i-gang",
        "/kontakt",
        "/registrer-firma",
    ];

    public const string LosningenPath = "/loesningen/";

    private static readonly string[] SameOriginHosts =
    [
        "lunchportalen.no",
        "www.lunchportalen.no",
        "app.lunchportalen.no",
    ];

    public static string Demo(string source)
    {
        return Start(source, "demo");
    }

    /// <summary>Geography-first entry: always routes to app /start before demo or registration.</summary>
    public static string Start(string source, string intent = "demo")
    {
        var normalized = NormalizeSource(source);
        var normalizedIntent = string.Equals(intent, "register", StringComparison.OrdinalIgnoreCase)
            ? "register"
            : "demo";
        var qs = string.IsNullOrEmpty(normalized)
            ? $"?intent={Uri.EscapeDataString(normalizedIntent)}"
            : $"?source={Uri.EscapeDataString(normalized)}&intent={Uri.EscapeDataString(normalizedIntent)}";
        return $"{StartBase}{qs}";
    }

    /// <summary>Lead-capture intent: geography gate before demo/registration.</summary>
    public static string ResolveLeadCapture(string source) => Start(source, "demo");

    /// <summary>
    /// Generic landing-hero secondary slot: lead paths → app, # → anchor, else → internal nav.
    /// Marketing /demo/ page routing is footer-only — never resolved here.
    /// </summary>
    public static string ResolveGenericHeroSecondary(
        string? url,
        string leadCaptureSource,
        string anchorFallback = "#demo-video")
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return ResolveNavigation(null, LosningenPath);
        }

        if (url.StartsWith("#", StringComparison.Ordinal))
        {
            return ResolveSamePageAnchor(url, anchorFallback);
        }

        if (IsLeadCapturePath(ExtractPath(url)))
        {
            return ResolveLeadCapture(leadCaptureSource);
        }

        return ResolveNavigation(url, LosningenPath);
    }

    /// <summary>Login intent: case-insensitive login paths; same-origin fail-closed to app login.</summary>
    public static string ResolveLogin(string? url = null)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return Login;
        }

        if (IsMailOrTel(url))
        {
            return url;
        }

        if (Uri.TryCreate(url, UriKind.Absolute, out var absolute) && !IsSameOrigin(absolute))
        {
            return url;
        }

        if (IsLoginPath(ExtractPath(url)))
        {
            return Login;
        }

        return Login;
    }

    /// <summary>Marketing SEO demo page: only /demo/ on lunchportalen.no (relative).</summary>
    public static string ResolveMarketingDemoPage(string? url = null, string fallback = "/demo/")
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return NormalizeMarketingDemoPath(fallback);
        }

        if (IsMailOrTel(url))
        {
            return url;
        }

        var path = NormalizePath(ExtractPath(url));
        if (IsMarketingDemoPath(path))
        {
            return "/demo/";
        }

        return NormalizeMarketingDemoPath(fallback);
    }

    /// <summary>Internal marketing navigation — never used for lead/login routing.</summary>
    public static string ResolveNavigation(string? url, string fallback)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return NormalizeNavPath(fallback);
        }

        if (IsMailOrTel(url))
        {
            return url;
        }

        if (url.StartsWith("#", StringComparison.Ordinal))
        {
            return url.Trim();
        }

        if (Uri.TryCreate(url, UriKind.Absolute, out var absolute))
        {
            return IsSameOrigin(absolute)
                ? NormalizeNavPath(absolute.AbsolutePath)
                : url;
        }

        return NormalizeNavPath(url);
    }

    /// <summary>Same-page fragment anchors (#kontakt, #demo-video).</summary>
    public static string ResolveSamePageAnchor(string? url, string fallback)
    {
        if (!string.IsNullOrWhiteSpace(url) && url.StartsWith("#", StringComparison.Ordinal))
        {
            return url.Trim();
        }

        return fallback;
    }

    private static bool IsLeadCapturePath(string path) =>
        LeadCapturePaths.Any(p => string.Equals(NormalizePath(path), p, StringComparison.OrdinalIgnoreCase));

    private static bool IsMarketingDemoPath(string path) =>
        string.Equals(NormalizePath(path), "/demo", StringComparison.OrdinalIgnoreCase);

    private static bool IsLoginPath(string path)
    {
        var normalized = NormalizePath(path);
        return LoginPaths.Any(p => string.Equals(normalized, p, StringComparison.OrdinalIgnoreCase));
    }

    private static bool IsMailOrTel(string url) =>
        url.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
        || url.StartsWith("tel:", StringComparison.OrdinalIgnoreCase);

    private static bool IsSameOrigin(Uri absolute) =>
        SameOriginHosts.Any(h => absolute.Host.Equals(h, StringComparison.OrdinalIgnoreCase));

    private static string NormalizeMarketingDemoPath(string path)
    {
        if (IsMarketingDemoPath(ExtractPath(path)))
        {
            return "/demo/";
        }

        return "/demo/";
    }

    private static string NormalizeNavPath(string path)
    {
        var trimmed = path.Trim();
        if (!trimmed.StartsWith('/'))
        {
            trimmed = "/" + trimmed;
        }

        if (trimmed.Length > 1 && !trimmed.EndsWith('/'))
        {
            trimmed += "/";
        }

        if (string.Equals(NormalizePath(trimmed), "/losningen", StringComparison.OrdinalIgnoreCase))
        {
            return LosningenPath;
        }

        return trimmed;
    }

    private static string ExtractPath(string url)
    {
        if (url.StartsWith("#", StringComparison.Ordinal))
        {
            return url;
        }

        if (Uri.TryCreate(url, UriKind.Absolute, out var absolute))
        {
            return absolute.AbsolutePath;
        }

        var path = url.Split('?', '#')[0].Trim();
        if (!path.StartsWith('/'))
        {
            path = "/" + path;
        }

        return path;
    }

    private static string NormalizePath(string path)
    {
        if (path.StartsWith("#", StringComparison.Ordinal))
        {
            return path;
        }

        var trimmed = path.Trim().TrimEnd('/');
        return string.IsNullOrEmpty(trimmed) ? "/" : trimmed;
    }

    private static string NormalizeSource(string source) =>
        string.IsNullOrWhiteSpace(source) ? string.Empty : source.Trim();
}
