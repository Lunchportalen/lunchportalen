// app/kitchen/report/page.tsx
/** @deprecated Bruk /kitchen?tab=aggregate (kanonisk kjøkkenflate). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";

export default function KitchenReportPage() {
  redirect("/kitchen?tab=aggregate");
}
