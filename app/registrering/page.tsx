// app/registrering/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";

export default function RegistreringRedirect() {
  redirect("/register");
}
