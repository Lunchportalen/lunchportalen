import { sanity } from "@/lib/sanity/client";

export type Dish = {
  _id: string;
  title: string;
  description?: string | null;
  allergens?: string[] | null;
  tags?: string[] | null;
};

export type WeekDay = {
  date: string; // ISO YYYY-MM-DD
  level: "BASIS" | "LUXUS";
  dishes: Dish[];
};

export type WeekPlan = {
  _id: string;
  weekStart: string; // ISO YYYY-MM-DD
  publishedAt?: string | null;
  lockedAt?: string | null;
  days: WeekDay[];
};

const NEXT_PUBLISHED_WEEKPLAN_GROQ = /* groq */ `
*[_type=="weekPlan"
  && approvedForPublish==true
  && customerVisible==true
  && defined(publishedAt)
  && weekStart >= $today
] | order(weekStart asc)[0]{
  _id,
  weekStart,
  publishedAt,
  lockedAt,
  days[]{
    date,
    level,
    "dishes": dishes[]->{
      _id,
      title,
      description,
      allergens,
      tags
    }
  }
}
`;

export async function fetchNextPublishedWeekPlan(todayISO: string): Promise<WeekPlan | null> {
  return sanity.fetch(NEXT_PUBLISHED_WEEKPLAN_GROQ, { today: todayISO });
}
