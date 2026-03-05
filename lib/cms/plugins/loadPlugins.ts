/**
 * Phase 18: Local-only plugin loader.
 * Explicit imports; deterministic registration order.
 */

import { registerPlugin } from "./registry";
import { plugin as coreBlocks } from "@/plugins/coreBlocks";
import { plugin as webhookPlugin } from "@/plugins/webhookPlugin";

let initialized = false;

export function initPluginsOnce(): void {
  if (initialized) return;
  initialized = true;
  registerPlugin(coreBlocks);
  registerPlugin(webhookPlugin);
}
