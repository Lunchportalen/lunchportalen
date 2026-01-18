// lib/sanity/queries.ts
import { sanity } from "./client";

/* =========================================================
   Types
========================================================= */
export type Announcement = {
  _id: string;
  title: string;
  message: string;
  severity: "info" | "warning" | "critical";
};

export type MenuContent = {
  _id: string;
  date: string; // YYYY-MM-DD

  // ✅ UI-felt (superadmin / menyvisning)
  title?: string | null;
  tier?: "BASIS" | "PREMIUM" | null;

  // ✅ Tekstinnhold
  description?: string | null;
  allergens?: string[] | null;

  /**
   * isPublished brukes i UI og betyr:
   * - enten legacy isPublished==true
   * - eller (approvedForPublish==true && customerVisible==true)
   * og aldri drafts.*
   */
  isPublished: boolean;

  // Nye kontrollfelter (kan mangle på eksisterende docs)
  approvedForPublish?: boolean | null;
  approvedAt?: string | null;
  customerVisible?: boolean | null;
  customerVisibleSetAt?: string | null;
};

// Bakoverkompatibilitet: enkelte filer kan importere SanityMenuDay
export type SanityMenuDay = MenuContent;

/* =========================================================
   Helpers
========================================================= */
function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

/**
 * ✅ FASET: Kunde-synlig meny med BACKWARD COMPAT
 * Synlig hvis:
 *  - legacy isPublished == true
 *    ELLER
 *  - approvedForPublish == true && customerVisible == true
 *  OG alltid: ikke drafts.*
 */
const CUSTOMER_VISIBLE_FILTER = `
(
  isPublished == true
  ||
  (approvedForPublish == true && customerVisible == true)
)
&&
!(_id in path("drafts.**"))
`;

/* =========================================================
   Announcement
========================================================= */
export async function getActiveAnnouncement(): Promise<Announcement | null> {
  return sanity.fetch(
    `*[_type == "announcement" && active == true][0]{
      _id,
      title,
      message,
      severity
    }`
  );
}

/* =========================================================
   Menu - single date (customer-visible)
========================================================= */
export async function getMenuForDate(date: string): Promise<MenuContent | null> {
  if (!isISODate(date)) {
    throw new Error(
      `[getMenuForDate] Invalid date (expected YYYY-MM-DD): ${date}`
    );
  }

  return sanity.fetch(
    `*[
      _type == "menuContent" &&
      date == $date &&
      ${CUSTOMER_VISIBLE_FILTER}
    ][0]{
      _id,
      date,
      title,
      tier,
      description,
      allergens,

      approvedForPublish,
      approvedAt,
      customerVisible,
      customerVisibleSetAt,

      "isPublished": (
        isPublished == true
        ||
        (approvedForPublish == true && customerVisible == true)
      ) && !(_id in path("drafts.**"))
    }`,
    { date }
  );
}

/* =========================================================
   Menu - list of dates (customer-visible)
========================================================= */
export async function getMenuForDates(dates: string[]): Promise<MenuContent[]> {
  const cleaned = uniq(dates).filter(Boolean);

  if (!cleaned.length) return [];
  for (const d of cleaned) {
    if (!isISODate(d)) {
      throw new Error(
        `[getMenuForDates] Invalid date (expected YYYY-MM-DD): ${d}`
      );
    }
  }

  return sanity.fetch(
    `*[
      _type == "menuContent" &&
      date in $dates &&
      ${CUSTOMER_VISIBLE_FILTER}
    ] | order(date asc){
      _id,
      date,
      title,
      tier,
      description,
      allergens,

      approvedForPublish,
      approvedAt,
      customerVisible,
      customerVisibleSetAt,

      "isPublished": (
        isPublished == true
        ||
        (approvedForPublish == true && customerVisible == true)
      ) && !(_id in path("drafts.**"))
    }`,
    { dates: cleaned }
  );
}

/* =========================================================
   Menu - range (inclusive) (customer-visible)
========================================================= */
export async function getMenuForRange(
  from: string,
  to: string
): Promise<MenuContent[]> {
  if (!isISODate(from)) {
    throw new Error(
      `[getMenuForRange] Invalid from-date (expected YYYY-MM-DD): ${from}`
    );
  }
  if (!isISODate(to)) {
    throw new Error(
      `[getMenuForRange] Invalid to-date (expected YYYY-MM-DD): ${to}`
    );
  }
  if (from > to) {
    throw new Error(
      `[getMenuForRange] Invalid range: from (${from}) > to (${to})`
    );
  }

  return sanity.fetch(
    `*[
      _type == "menuContent" &&
      date >= $from && date <= $to &&
      ${CUSTOMER_VISIBLE_FILTER}
    ] | order(date asc){
      _id,
      date,
      title,
      tier,
      description,
      allergens,

      approvedForPublish,
      approvedAt,
      customerVisible,
      customerVisibleSetAt,

      "isPublished": (
        isPublished == true
        ||
        (approvedForPublish == true && customerVisible == true)
      ) && !(_id in path("drafts.**"))
    }`,
    { from, to }
  );
}

/* =========================================================
   ✅ Admin: list of dates (superadmin)
   - Henter ALT (også upublisert)
   - Filtrerer bort drafts.*
========================================================= */
export async function getMenuForDatesAdmin(dates: string[]): Promise<MenuContent[]> {
  const cleaned = uniq(dates).filter(Boolean);

  if (!cleaned.length) return [];
  for (const d of cleaned) {
    if (!isISODate(d)) {
      throw new Error(
        `[getMenuForDatesAdmin] Invalid date (expected YYYY-MM-DD): ${d}`
      );
    }
  }

  return sanity.fetch(
    `*[
      _type == "menuContent" &&
      date in $dates &&
      !(_id in path("drafts.**"))
    ] | order(date asc){
      _id,
      date,
      title,
      tier,
      description,
      allergens,

      approvedForPublish,
      approvedAt,
      customerVisible,
      customerVisibleSetAt,

      "isPublished": (
        isPublished == true
        ||
        (approvedForPublish == true && customerVisible == true)
      ) && !(_id in path("drafts.**"))
    }`,
    { dates: cleaned }
  );
}
