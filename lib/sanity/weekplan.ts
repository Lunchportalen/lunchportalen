// lib/sanity/weekplan.ts
// Sanity `weekPlan`-type: redaksjonell ukeplan (Studio/cron). Ikke operativ employee-sannhet — se GET /api/week + menuContent.
import "server-only";
import { sanity as sanityRead } from "./client";

export type WeekPlanStatus = "draft" | "open" | "current" | "archived";

export type WeekPlanDay = {
  date: string; // YYYY-MM-DD
  level: "BASIS" | "LUXUS";
  dishes: any[]; // references or resolved docs, avhenger av GROQ
  kitchenNote?: string | null;
};

export type WeekPlanDoc = {
  _id: string;
  _type: "weekPlan";
  weekKey?: string;
  weekStart?: string; // YYYY-MM-DD
  status?: WeekPlanStatus;
  approvedForPublish?: boolean;
  customerVisible?: boolean;
  publishedAt?: string | null;
  lockedAt?: string | null;
  locked?: boolean;
  visibleFrom?: string | null;
  becomesCurrentAt?: string | null;
  days?: WeekPlanDay[];
  noteForKitchen?: string | null;
};

/**
 * GROQ – vi resolver dish-referanser lett (title + allergens) uten å overdrive payload.
 * Du kan utvide senere.
 */
const WEEKPLAN_PROJECTION = `{
  _id,
  _type,
  weekKey,
  weekStart,
  status,
  approvedForPublish,
  customerVisible,
  publishedAt,
  lockedAt,
  locked,
  visibleFrom,
  becomesCurrentAt,
  noteForKitchen,
  "days": days[]{
    date,
    level,
    kitchenNote,
    "dishes": dishes[]->{
      _id,
      title,
      allergens,
      tags
    }
  }
}`;

/** Live reads: exclude Sanity drafts; require same publish flags as POST /api/weekplan/publish. */
const WEEKPLAN_LIVE_FILTER = `!(_id in path("drafts.**")) && approvedForPublish == true && customerVisible == true`;

export async function fetchCurrentWeekPlan(todayISO: string): Promise<WeekPlanDoc | null> {
  // current er fasit: status=="current"
  // fallback: nyeste godkjent + synlig (aldri utkast)
  const q = `
    coalesce(
      *[_type=="weekPlan" && status=="current" && ${WEEKPLAN_LIVE_FILTER}][0]${WEEKPLAN_PROJECTION},
      *[_type=="weekPlan" && ${WEEKPLAN_LIVE_FILTER}] | order(weekStart desc)[0]${WEEKPLAN_PROJECTION},
      null
    )
  `;

  const plan = await sanityRead.fetch<WeekPlanDoc | null>(q, { todayISO });
  return plan ?? null;
}

export async function fetchNextOpenWeekPlan(todayISO: string): Promise<WeekPlanDoc | null> {
  // "next" betyr: status=="open" OG weekStart etter i dag (robust)
  const q = `
    *[
      _type=="weekPlan" &&
      status=="open" &&
      defined(weekStart) &&
      weekStart > $todayISO &&
      ${WEEKPLAN_LIVE_FILTER}
    ] | order(weekStart asc)[0]${WEEKPLAN_PROJECTION}
  `;

  const plan = await sanityRead.fetch<WeekPlanDoc | null>(q, { todayISO });
  return plan ?? null;
}

/**
 * Back-compat: gammel funksjon som tidligere het "published".
 * Nå betyr det i praksis "open".
 */
export async function fetchNextPublishedWeekPlan(todayISO: string) {
  return fetchNextOpenWeekPlan(todayISO);
}
