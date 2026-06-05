namespace Lunchportalen.Helpers;

/// <summary>
/// Canonical cross-domain links to the Next.js app (presentation-only in Umbraco).
/// </summary>
public static class AppUrls
{
    public const string Login = "https://app.lunchportalen.no/login";

    private const string DemoBase = "https://app.lunchportalen.no/demo";

    private static readonly HashSet<string> LeadCapturePaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/demo",
        "/kom-i-gang",
        "/kontakt",
        "/registrer-firma",
    };

    public static string Demo(string source)
    {
        var normalized = NormalizeSource(source);
        return string.IsNullOrEmpty(normalized)
            ? DemoBase
            : $"{DemoBase}?source={Uri.EscapeDataString(normalized)}";
    }

    public static string ResolveLogin(string? url = null)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            return Login;
        }

        return IsLoginPath(ExtractPath(url)) ? Login : url;
    }

    /// <summary>
    /// Maps marketing capture intents (demo, kom-i-gang, kontakt, anchors) to the app demo form.
    /// Non-capture URLs (e.g. /priser/) pass through unchanged.
    /// </summary>
    public static string ResolveLeadCapture(string? url, string source)
    {
        if (string.IsNullOrWhiteSpace(url) || ShouldRedirectToDemo(url))
        {
            return Demo(source);
        }

        return url;
    }

    private static bool ShouldRedirectToDemo(string url)
    {
        if (url.StartsWith("#", StringComparison.Ordinal))
        {
            return url.StartsWith("#book-demo", StringComparison.OrdinalIgnoreCase);
        }

        if (url.StartsWith("mailto:", StringComparison.OrdinalIgnoreCase)
            || url.StartsWith("tel:", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        if (Uri.TryCreate(url, UriKind.Absolute, out var absolute))
        {
            if (absolute.Host.Equals("app.lunchportalen.no", StringComparison.OrdinalIgnoreCase)
                && absolute.AbsolutePath.StartsWith("/demo", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (absolute.Host is "lunchportalen.no" or "www.lunchportalen.no")
            {
                return IsLeadCapturePath(absolute.AbsolutePath);
            }

            return false;
        }

        return IsLeadCapturePath(ExtractPath(url));
    }

    private static bool IsLeadCapturePath(string path)
    {
        return LeadCapturePaths.Contains(NormalizePath(path));
    }

    private static bool IsLoginPath(string path)
    {
        var normalized = NormalizePath(path);
        return normalized is "/login" or "/logg-inn";
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
