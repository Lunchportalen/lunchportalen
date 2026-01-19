// app/today/page.tsx
import { redirect } from "next/navigation";

/**
 * Legacy redirect.
 * /today brukes ikke lenger – UKE er hovedvisning.
 * Denne redirecten hindrer 404 og redirect-loops.
 */
export default function TodayRedirect() {
  redirect("/week");
}
