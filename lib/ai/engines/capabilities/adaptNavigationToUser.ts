/**
 * Adaptive navigation AI capability: adaptNavigationToUser.
 * Adapts a navigation tree to the current user: filter by role/segment,
 * reorder by recency or priority, promote frequently used items. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "adaptNavigationToUser";

const adaptNavigationToUserCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Adaptive navigation AI: adapts a navigation tree to the current user. Filters items by role and segment, reorders by recent paths and priority, promotes frequently used links. Returns adapted tree and optional promoted items. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Adapt navigation input",
    properties: {
      userContext: {
        type: "object",
        description: "Current user/visitor context",
        properties: {
          role: { type: "string", description: "e.g. employee, company_admin, superadmin" },
          segmentId: { type: "string", description: "e.g. new_user, active, power_user" },
          recentPathIds: {
            type: "array",
            description: "Recently visited nav item IDs or paths (promote to top)",
            items: { type: "string" },
          },
          locale: { type: "string", description: "nb | en" },
        },
      },
      navigation: {
        type: "array",
        description: "Full navigation tree: items with id, label, path, children?, roles?, segmentIds?, order",
        items: {
          type: "object",
          required: ["id", "label"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            path: { type: "string" },
            order: { type: "number" },
            roles: { type: "array", items: { type: "string" }, description: "Show only for these roles; empty = all" },
            segmentIds: { type: "array", items: { type: "string" }, description: "Show only for these segments; empty = all" },
            children: { type: "array", description: "Nested items (same shape)" },
          },
        },
      },
      maxDepth: { type: "number", description: "Max nesting depth (default: 2)" },
      maxTopLevelItems: { type: "number", description: "Max items at top level (default: 12)" },
      promoteRecentCount: { type: "number", description: "How many recent items to promote (default: 3)" },
      locale: { type: "string", description: "Override locale (nb | en)" },
    },
    required: ["navigation"],
  },
  outputSchema: {
    type: "object",
    description: "Adapted navigation result",
    required: ["adaptedNavigation", "promotedIds", "summary", "generatedAt"],
    properties: {
      adaptedNavigation: {
        type: "array",
        description: "Filtered and reordered navigation tree",
        items: {
          type: "object",
          required: ["id", "label"],
          properties: {
            id: { type: "string" },
            label: { type: "string" },
            path: { type: "string" },
            order: { type: "number" },
            children: { type: "array" },
          },
        },
      },
      promotedIds: {
        type: "array",
        description: "IDs promoted to top due to recency",
        items: { type: "string" },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is adapted structure only; no nav or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(adaptNavigationToUserCapability);

export type NavItemInput = {
  id: string;
  label: string;
  path?: string | null;
  order?: number | null;
  roles?: string[] | null;
  segmentIds?: string[] | null;
  children?: NavItemInput[] | null;
};

export type NavItemOutput = {
  id: string;
  label: string;
  path?: string | null;
  order?: number | null;
  children?: NavItemOutput[] | null;
};

export type UserNavContext = {
  role?: string | null;
  segmentId?: string | null;
  recentPathIds?: string[] | null;
  locale?: string | null;
};

export type AdaptNavigationToUserInput = {
  userContext?: UserNavContext | null;
  navigation: NavItemInput[];
  maxDepth?: number | null;
  maxTopLevelItems?: number | null;
  promoteRecentCount?: number | null;
  locale?: "nb" | "en" | null;
};

export type AdaptNavigationToUserOutput = {
  adaptedNavigation: NavItemOutput[];
  promotedIds: string[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeRoleList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase()).filter(Boolean);
}

function roleOrSegmentMatch(
  item: NavItemInput,
  role: string,
  segmentId: string
): boolean {
  const roles = safeRoleList(item.roles);
  const segments = safeRoleList(item.segmentIds);
  if (roles.length === 0 && segments.length === 0) return true;
  if (role && roles.length > 0 && !roles.includes(role.toLowerCase())) return false;
  if (segmentId && segments.length > 0 && !segments.includes(segmentId.toLowerCase())) return false;
  return true;
}

function filterAndMap(
  items: NavItemInput[],
  role: string,
  segmentId: string,
  depth: number,
  maxDepth: number
): NavItemOutput[] {
  if (depth > maxDepth) return [];
  const out: NavItemOutput[] = [];
  for (const it of items) {
    if (!roleOrSegmentMatch(it, role, segmentId)) continue;
    const children =
      Array.isArray(it.children) && it.children.length > 0 && depth < maxDepth
        ? filterAndMap(it.children as NavItemInput[], role, segmentId, depth + 1, maxDepth)
        : undefined;
    out.push({
      id: it.id,
      label: safeStr(it.label) || it.id,
      path: it.path ?? undefined,
      order: typeof it.order === "number" ? it.order : undefined,
      children: children?.length ? children : undefined,
    });
  }
  return out;
}

/**
 * Adapts navigation tree to user: filter by role/segment, reorder by recency, apply depth/count limits. Deterministic.
 */
export function adaptNavigationToUser(input: AdaptNavigationToUserInput): AdaptNavigationToUserOutput {
  const userContext = input.userContext && typeof input.userContext === "object" ? input.userContext : {};
  const role = safeStr(userContext.role);
  const segmentId = safeStr(userContext.segmentId);
  const recentPathIds = Array.isArray(userContext.recentPathIds)
    ? userContext.recentPathIds.map((x) => String(x).trim()).filter(Boolean)
    : [];
  const nav = Array.isArray(input.navigation) ? input.navigation : [];
  const maxDepth = Math.max(1, Math.min(5, Number(input.maxDepth) || 2));
  const maxTopLevel = Math.max(1, Math.min(50, Number(input.maxTopLevelItems) || 12));
  const promoteCount = Math.max(0, Math.min(10, Number(input.promoteRecentCount) || 3));
  const isEn = (input.locale ?? userContext.locale) === "en";

  const filtered = filterAndMap(nav, role, segmentId, 0, maxDepth);

  const recentSet = new Set(recentPathIds.map((x) => x.toLowerCase()));
  const promotedIds: string[] = [];
  const rest: NavItemOutput[] = [];

  for (const item of filtered) {
    const idLower = item.id.toLowerCase();
    if (recentSet.has(idLower) || recentSet.has((item.path ?? "").toLowerCase())) {
      if (promotedIds.length < promoteCount) promotedIds.push(item.id);
    }
    rest.push(item);
  }

  const orderOf = (item: NavItemOutput): number => {
    const idx = recentPathIds.findIndex(
      (r) => r.toLowerCase() === item.id.toLowerCase() || r.toLowerCase() === (item.path ?? "").toLowerCase()
    );
    if (idx >= 0) return idx;
    return typeof item.order === "number" ? item.order : 9999;
  };
  rest.sort((a, b) => orderOf(a) - orderOf(b));

  const adaptedNavigation = rest.slice(0, maxTopLevel);

  const summary = isEn
    ? `Adapted navigation to ${adaptedNavigation.length} top-level item(s). Role: ${role || "any"}. Promoted: ${promotedIds.length} recent.`
    : `Tilpasset navigasjon til ${adaptedNavigation.length} toppnivå-element(er). Rolle: ${role || "alle"}. Fremhevet: ${promotedIds.length} nylige.`;

  return {
    adaptedNavigation,
    promotedIds,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { adaptNavigationToUserCapability, CAPABILITY_NAME };
