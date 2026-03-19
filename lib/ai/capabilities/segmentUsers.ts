/**
 * User segmentation AI capability: segmentUsers.
 * Segments users from behavioral signals (tenure, activity, orders, logins, NPS).
 * Returns segment definitions with member counts and per-user primary segment.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "segmentUsers";

const segmentUsersCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "User segmentation AI: from user list with signals (userId, tenureDays, daysSinceLastActivity, orderCount, loginCount, npsScore), assigns segments: new_user, active, at_risk, churned, power_user, casual. Returns segments with member counts and per-user primary segment. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Segment users input",
    properties: {
      users: {
        type: "array",
        description: "Users with signals: userId, tenureDays?, daysSinceLastActivity?, orderCount?, loginCount?, npsScore?",
        items: {
          type: "object",
          required: ["userId"],
          properties: {
            userId: { type: "string" },
            tenureDays: { type: "number" },
            daysSinceLastActivity: { type: "number" },
            orderCount: { type: "number" },
            loginCount: { type: "number" },
            npsScore: { type: "number" },
          },
        },
      },
      locale: { type: "string", description: "Locale (nb | en) for segment names/descriptions" },
    },
    required: ["users"],
  },
  outputSchema: {
    type: "object",
    description: "User segmentation result",
    required: ["segments", "userSegments", "summary", "segmentedAt"],
    properties: {
      segments: {
        type: "array",
        items: {
          type: "object",
          required: ["segmentId", "name", "description", "userIds", "count"],
          properties: {
            segmentId: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            userIds: { type: "array", items: { type: "string" } },
            count: { type: "number" },
          },
        },
      },
      userSegments: {
        type: "array",
        items: {
          type: "object",
          required: ["userId", "primarySegment"],
          properties: {
            userId: { type: "string" },
            primarySegment: { type: "string" },
            segmentIds: { type: "array", items: { type: "string" } },
          },
        },
      },
      summary: { type: "string" },
      segmentedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is segmentation only; no user or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(segmentUsersCapability);

export type UserSignals = {
  userId: string;
  tenureDays?: number | null;
  daysSinceLastActivity?: number | null;
  orderCount?: number | null;
  loginCount?: number | null;
  npsScore?: number | null;
};

export type SegmentUsersInput = {
  users: UserSignals[];
  locale?: "nb" | "en" | null;
};

export type SegmentDefinition = {
  segmentId: string;
  name: string;
  description: string;
  userIds: string[];
  count: number;
};

export type UserSegmentAssignment = {
  userId: string;
  primarySegment: string;
  segmentIds: string[];
};

export type SegmentUsersOutput = {
  segments: SegmentDefinition[];
  userSegments: UserSegmentAssignment[];
  summary: string;
  segmentedAt: string;
};

const NEW_USER_TENURE_DAYS = 7;
const CHURNED_DAYS = 60;
const AT_RISK_DAYS = 30;
const POWER_USER_ORDERS = 10;
const POWER_USER_LOGINS = 20;
const CASUAL_ORDERS_MAX = 2;

function assignPrimarySegment(u: UserSignals): string {
  const tenure = Math.max(0, Number(u.tenureDays) ?? 0);
  const daysInactive = Math.max(0, Number(u.daysSinceLastActivity) ?? 0);
  const orders = Math.max(0, Number(u.orderCount) ?? 0);
  const logins = Math.max(0, Number(u.loginCount) ?? 0);

  if (tenure < NEW_USER_TENURE_DAYS) return "new_user";
  if (daysInactive >= CHURNED_DAYS) return "churned";
  if (daysInactive >= AT_RISK_DAYS) return "at_risk";
  if (orders >= POWER_USER_ORDERS && logins >= POWER_USER_LOGINS) return "power_user";
  if (orders <= CASUAL_ORDERS_MAX && tenure > 30) return "casual";
  return "active";
}

/**
 * Segments users from signals. Deterministic; no external calls.
 */
export function segmentUsers(input: SegmentUsersInput): SegmentUsersOutput {
  const users = Array.isArray(input.users) ? input.users : [];
  const isEn = input.locale === "en";

  const bySegment = new Map<string, string[]>();
  const userAssignments: UserSegmentAssignment[] = [];

  for (const u of users) {
    const userId = String(u?.userId ?? "").trim();
    if (!userId) continue;

    const primary = assignPrimarySegment(u as UserSignals);
    userAssignments.push({ userId, primarySegment: primary, segmentIds: [primary] });

    if (!bySegment.has(primary)) bySegment.set(primary, []);
    bySegment.get(primary)!.push(userId);
  }

  const segmentMeta: Record<string, { nameEn: string; nameNb: string; descEn: string; descNb: string }> = {
    new_user: {
      nameEn: "New user",
      nameNb: "Ny bruker",
      descEn: "Recently signed up (first 7 days).",
      descNb: "Nylig registrert (første 7 dager).",
    },
    active: {
      nameEn: "Active",
      nameNb: "Aktiv",
      descEn: "Engaged with recent activity and orders.",
      descNb: "Engasjert med nylig aktivitet og bestillinger.",
    },
    at_risk: {
      nameEn: "At risk",
      nameNb: "I risiko",
      descEn: "No activity 30–60 days; re-engagement opportunity.",
      descNb: "Ingen aktivitet 30–60 dager; re-engagement-mulighet.",
    },
    churned: {
      nameEn: "Churned",
      nameNb: "Churned",
      descEn: "No activity 60+ days; win-back or sunset.",
      descNb: "Ingen aktivitet 60+ dager; win-back eller avslutning.",
    },
    power_user: {
      nameEn: "Power user",
      nameNb: "Powerbruker",
      descEn: "High orders and logins; loyalty and upsell.",
      descNb: "Høye bestillinger og innlogginger; lojalitet og oppsalg.",
    },
    casual: {
      nameEn: "Casual",
      nameNb: "Tilfeldig",
      descEn: "Low order count; nurture or activation.",
      descNb: "Lav bestillingsantall; næring eller aktivering.",
    },
  };

  const order: string[] = ["new_user", "active", "power_user", "casual", "at_risk", "churned"];
  const segments: SegmentDefinition[] = [];

  for (const segmentId of order) {
    const userIds = bySegment.get(segmentId) ?? [];
    if (userIds.length === 0) continue;

    const meta = segmentMeta[segmentId] ?? {
      nameEn: segmentId,
      nameNb: segmentId,
      descEn: "",
      descNb: "",
    };
    segments.push({
      segmentId,
      name: isEn ? meta.nameEn : meta.nameNb,
      description: isEn ? meta.descEn : meta.descNb,
      userIds,
      count: userIds.length,
    });
  }

  const summary = isEn
    ? `Segmented ${userAssignments.length} user(s) into ${segments.length} segment(s). Use for targeting and messaging.`
    : `Segmenterte ${userAssignments.length} bruker(e) i ${segments.length} segment(er). Bruk for målretting og budskap.`;

  return {
    segments,
    userSegments: userAssignments,
    summary,
    segmentedAt: new Date().toISOString(),
  };
}

export { segmentUsersCapability, CAPABILITY_NAME };
