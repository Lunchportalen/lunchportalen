/**
 * Phase 18: Optional webhook plugin (best-effort onPublish).
 * Enable with CMS_PLUGINS_ENABLED=core-blocks,webhook or do not set CMS_PLUGINS_DISABLED.
 * Webhook URL from env: CMS_WEBHOOK_PUBLISH_URL (no default).
 */

import type { CMSPlugin } from "@/lib/cms/plugins/types";

const PUBLISH_URL = typeof process !== "undefined" && process.env?.CMS_WEBHOOK_PUBLISH_URL;

export const plugin: CMSPlugin = {
  id: "webhook",
  name: "Webhook (on Publish)",
  enabledByDefault: false,
  hooks: {
    async onPublish(ctx) {
      if (!PUBLISH_URL) return;
      try {
        await fetch(PUBLISH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "publish",
            env: ctx.env,
            locale: ctx.locale,
            pageId: ctx.pageId,
            variantId: ctx.variantId,
            slug: ctx.slug,
          }),
        });
      } catch (_) {
        // best-effort; already logged by runHooks
      }
    },
  },
};
