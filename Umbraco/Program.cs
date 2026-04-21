try
{
    WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

    // Umbraco.Cms.DevelopmentMode.Backoffice (InMemoryModelFactory) must not run outside local dev:
    // appsettings.Development.json sets ModelsMode=InMemoryAuto; Azure mis-set ASPNETCORE_ENVIRONMENT=Development
    // or a bad publish graph must not activate that path.
    bool onAzureAppService = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WEBSITE_SITE_NAME"));
    if (onAzureAppService || !builder.Environment.IsDevelopment())
    {
        builder.Configuration.AddInMemoryCollection(
            new Dictionary<string, string?> { ["Umbraco:CMS:ModelsBuilder:ModelsMode"] = "Nothing" });
    }

    builder.CreateUmbracoBuilder()
        .AddBackOffice()
        .AddWebsite()
        .AddDeliveryApi()
        .AddComposers()
        .Build();

    WebApplication app = builder.Build();


    await app.BootUmbracoAsync();

    // Surface unhandled request exceptions to stderr (Azure Log stream / stdout logs) while preserving default status handling.
    app.Use(async (context, next) =>
    {
        try
        {
            await next();
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[Umbraco] Unhandled exception (request pipeline):");
            Console.Error.WriteLine(ex.ToString());
            throw;
        }
    });

    app.UseUmbraco()
        .WithMiddleware(u =>
        {
            u.UseBackOffice();
            u.UseWebsite();
        })
        .WithEndpoints(u =>
        {
            u.UseBackOfficeEndpoints();
            u.UseWebsiteEndpoints();
        });

    await app.RunAsync();
}
catch (Exception ex)
{
    Console.Error.WriteLine("Umbraco startup failed:");
    Console.Error.WriteLine(ex.ToString());
    throw;
}
