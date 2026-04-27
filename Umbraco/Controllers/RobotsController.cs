using Microsoft.AspNetCore.Mvc;

namespace Lunchportalen.Controllers
{
    public class RobotsController : Controller
    {
        [HttpGet("/robots.txt")]
        public IActionResult Index()
        {
            const string content = """
User-agent: *
Allow: /

Sitemap: https://lunchportalen.no/sitemap.xml
""";

            return Content(content, "text/plain");
        }
    }
}