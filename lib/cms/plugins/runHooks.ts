/**
 * Phase 18: Server-side hook runner (best-effort, never breaks flows).
 * Wire: (1) After successful variant publish + cache invalidation + search index upsert -> runOnPublish(ctx).
 *       (2) Scheduler: after publish transition -> runOnPublish; after expire -> runOnExpire.
 *       (3) Search indexer: after upsert/delete -> runOnSearchIndex(ctx).
 */

import type { CMSHookContext } from "./types";
import { initPluginsOnce } from "./loadPlugins";
import { getHooks } from "./registry";

export async function runOnPublish(ctx: CMSHookContext): Promise<void> {
  initPluginsOnce();
  const list = getHooks();
  for (const hooks of list) {
    if (!hooks.onPublish) continue;
    try {
      await hooks.onPublish(ctx);
    } catch (err) {
      console.error("[CMS hooks] onPublish", ctx.pageId, err);
    }
  }
}

export async function runOnExpire(ctx: CMSHookContext): Promise<void> {
  initPluginsOnce();
  const list = getHooks();
  for (const hooks of list) {
    if (!hooks.onExpire) continue;
    try {
      await hooks.onExpire(ctx);
    } catch (err) {
      console.error("[CMS hooks] onExpire", ctx.pageId, err);
    }
  }
}

export async function runOnSearchIndex(
  ctx: CMSHookContext & { action: "upsert" | "delete" }
): Promise<void> {
  initPluginsOnce();
  const list = getHooks();
  for (const hooks of list) {
    if (!hooks.onSearchIndex) continue;
    try {
      await hooks.onSearchIndex(ctx);
    } catch (err) {
      console.error("[CMS hooks] onSearchIndex", ctx.action, ctx.pageId, err);
    }
  }
}
