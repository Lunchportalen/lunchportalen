/**
 * Single entry for date-based `menuContent` reads (and related Sanity query helpers).
 * Implementation lives in lib/sanity — this module is the only import surface for app/api/components.
 */
import "server-only";

export type { Announcement, MenuContent, SanityMenuDay } from "@/lib/sanity/queries";

export {
  getActiveAnnouncement,
  getMenuForDate,
  getPublishedMenuForDate,
  getMenuForDates,
  getMenuForRange,
  getMenuForDatesAdmin,
} from "@/lib/sanity/queries";

export { getClosedDatesForDate } from "@/lib/sanity/getClosedDatesForDate";
