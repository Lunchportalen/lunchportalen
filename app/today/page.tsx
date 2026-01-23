// app/today/page.tsx

import { redirect } from "next/navigation";

/**
 * Legacy redirect.
 * /today brukes ikke lenger – /week er hovedvisning.
 * Denne redirecten er permanent i praksis, men uten HTTP 301,
 * siden App Router håndterer redirecten server-side.
 */
export default function TodayRedirect() {
  redirect("/week");
}
