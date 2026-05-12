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

export { getClosedDatesForDate } from "@/lib/sanity/getClosedDatesForDate";
