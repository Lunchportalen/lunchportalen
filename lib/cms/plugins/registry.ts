/**
 * Phase 18: CMS plugin registry.
 * Deterministic registration; ENV toggles for enabled plugins.
 */

import type { CMSBlockDefinition, CMSHooks, CMSPlugin } from "./types";

const plugins: CMSPlugin[] = [];

function getEnvList(key: string): string[] | null {
  if (typeof process === "undefined" || !process.env) return null;
  const v = process.env[key];
  if (typeof v !== "string" || !v.trim()) return null;
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

export function isPluginEnabled(pluginId: string, enabledByDefault = true): boolean {
  const enabledList = getEnvList("CMS_PLUGINS_ENABLED");
  if (enabledList !== null) return enabledList.includes(pluginId);
  const disabledList = getEnvList("CMS_PLUGINS_DISABLED");
  if (disabledList !== null) return !disabledList.includes(pluginId);
  return enabledByDefault;
}

export function registerPlugin(plugin: CMSPlugin): void {
  if (plugins.some((p) => p.id === plugin.id)) {
    if (process.env.NODE_ENV === "development") {
      throw new Error(`CMS plugin id already registered: ${plugin.id}`);
    }
    return;
  }
  const blockTypes = new Set(plugins.flatMap((p) => (p.blocks ?? []).map((b) => b.type)));
  for (const block of plugin.blocks ?? []) {
    if (blockTypes.has(block.type)) {
      if (process.env.NODE_ENV === "development") {
        throw new Error(`CMS block type already registered: ${block.type}`);
      }
      return;
    }
    blockTypes.add(block.type);
  }
  plugins.push(plugin);
}

export function getPlugins(): CMSPlugin[] {
  return [...plugins];
}

export function getAllBlocks(): CMSBlockDefinition[] {
  const out: CMSBlockDefinition[] = [];
  for (const p of plugins) {
    if (!isPluginEnabled(p.id, p.enabledByDefault !== false)) continue;
    for (const b of p.blocks ?? []) out.push(b);
  }
  return out;
}

export function getBlockDefinition(type: string): CMSBlockDefinition | null {
  for (const p of plugins) {
    if (!isPluginEnabled(p.id, p.enabledByDefault !== false)) continue;
    const block = (p.blocks ?? []).find((b) => b.type === type);
    if (block) return block;
  }
  return null;
}

export function getHooks(): CMSHooks[] {
  const list: CMSHooks[] = [];
  for (const p of plugins) {
    if (!isPluginEnabled(p.id, p.enabledByDefault !== false) || !p.hooks) continue;
    list.push(p.hooks);
  }
  return list;
}
