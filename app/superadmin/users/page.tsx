// app/superadmin/users/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";

/** Legacy bookmark — brukere håndteres kontekstuelt under firma. */
export default function SuperadminUsersPage() {
  redirect("/superadmin/companies");
}
