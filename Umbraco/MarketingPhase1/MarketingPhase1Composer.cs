using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace MarketingPhase1;

public sealed class MarketingPhase1Composer : IComposer
{
    public void Compose(IUmbracoBuilder builder) =>
        builder.AddNotificationHandler<Umbraco.Cms.Core.Notifications.UmbracoApplicationStartedNotification, MarketingPhase1StartupHandler>();
}
