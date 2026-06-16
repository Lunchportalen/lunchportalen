// app/superadmin/users/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import SuperadminUsersClient from "@/components/superadmin/SuperadminUsersClient";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";
import {
  SuperadminHero,
  SuperadminPageShell,
  SuperadminSection,
  SuperadminStatusRail,
} from "@/components/superadmin/shell/SuperadminShell";

export default async function SuperadminUsersPage() {
  const sb = await supabaseServer();

  // Auth gate
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) redirect("/login?next=/superadmin/users");

  // Role gate: profiles.role === "superadmin"
  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title="Brukere"
        lead="Full oversikt over roller, tilgang og firmatilknytning. Deaktivering og sletting auditeres."
      />

      <SuperadminStatusRail
        ariaLabel="Brukerstyring"
        items={[
          { label: "Omfang", value: "Alle roller" },
          { label: "Handlinger", value: "Deaktiver / slett" },
          { label: "Sporbarhet", value: "Audit" },
        ]}
      />

      <SuperadminSection title="Brukerliste" lead="Søk på e-post, navn eller firma-ID. Filtrer etter rolle." flat>
        <SuperadminUsersClient />
      </SuperadminSection>
    </SuperadminPageShell>
  );
}
