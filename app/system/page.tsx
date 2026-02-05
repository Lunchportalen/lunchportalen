// app/system/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";

export default async function SystemIndex() {
  redirect("/system/how-it-works");
}
