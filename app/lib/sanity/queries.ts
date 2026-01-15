import { sanity } from "./client";

export type Announcement = {
  _id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
};

export type MenuContent = {
  _id: string;
  date: string; // YYYY-MM-DD
  description?: string;
  allergens?: string[];
  isPublished?: boolean;
};

export async function getActiveAnnouncement(): Promise<Announcement | null> {
  return sanity.fetch(
    `*[_type == "announcement" && active == true][0]{ _id, title, message, severity }`
  );
}

export async function getMenuForDate(date: string): Promise<MenuContent | null> {
  return sanity.fetch(
    `*[_type == "menuContent" && date == $date][0]{
      _id, date, description, allergens, isPublished
    }`,
    { date }
  );
}

export async function getMenuForDates(dates: string[]): Promise<MenuContent[]> {
  return sanity.fetch(
    `*[_type == "menuContent" && date in $dates] | order(date asc){
      _id, date, description, allergens, isPublished
    }`,
    { dates }
  );
}

/**
 * ✅ Hent menyinnhold for et datointervall (inklusive)
 * Brukes til ukemeny (Man–Fre). Returnerer alle funn i intervallet sortert på dato.
 */
export async function getMenuForRange(from: string, to: string): Promise<MenuContent[]> {
  return sanity.fetch(
    `*[_type == "menuContent" && date >= $from && date <= $to] | order(date asc){
      _id, date, description, allergens, isPublished
    }`,
    { from, to }
  );
}
