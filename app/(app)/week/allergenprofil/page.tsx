export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import UserAllergenProfileForm from "@/components/employee/UserAllergenProfileForm";
import { requireActiveAgreement } from "@/lib/agreements/requireActiveAgreement";
import { readLocalDevAuthSession } from "@/lib/auth/devBypass";
import { normalizeRoleDefaultEmployee, type Role } from "@/lib/auth/role";
import { supabaseServer } from "@/lib/supabase/server";
import { systemRoleByEmail } from "@/lib/system/emails";
import { hasSupabaseSsrAuthCookieInJar } from "@/lib/supabase/ssrSessionCookies";

export const metadata: Metadata = {
  title: "Allergenprofil – Lunchportalen",
  description: "Din allergenprofil som ekstra info til kjøkkenet.",
  robots: { index: false, follow: false },
};

export default async function AllergenProfilPage() {
  const cookieStore = await cookies();
  const devBypass = readLocalDevAuthSession(cookieStore);
  if (!devBypass && !hasSupabaseSsrAuthCookieInJar(cookieStore.getAll())) {
    redirect("/login?next=/week/allergenprofil");
  }

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) {
    redirect("/login?next=/week/allergenprofil");
  }

  const email = data.user.email ?? null;
  const emailRole = systemRoleByEmail(email);
  const metaRole = normalizeRoleDefaultEmployee((data.user.user_metadata as { role?: unknown })?.role);
  const role: Role = (emailRole ?? metaRole) as Role;

  if (role !== "employee" && role !== "company_admin") {
    redirect("/week");
  }

  await requireActiveAgreement();

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 text-center sm:max-w-2xl">
      <h1 className="lp-h1">Allergenprofil</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-[rgb(var(--lp-muted))]">
        Generell profil på deg som bruker — ikke knyttet til en enkelt dag eller bestilling.
      </p>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link href="/week" className="lp-btn lp-btn--secondary lp-neon-focus min-h-touch">
          Ukeplan
        </Link>
        <Link href="/week/bestillingsprofil" className="lp-btn lp-btn--secondary lp-neon-focus min-h-touch">
          Bestillingsprofil
        </Link>
      </div>

      <UserAllergenProfileForm />
    </div>
  );
}
