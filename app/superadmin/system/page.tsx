// app/superadmin/system/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import SystemClient from "./SystemClient";
import { supabaseServer } from "@/lib/supabase/server";
import {
  SuperadminCommandList,
  SuperadminHero,
  SuperadminPageShell,
} from "@/components/superadmin/shell/SuperadminShell";

export default async function SuperadminSystemPage() {
  const sb = await supabaseServer();

  // ✅ Kun sjekk at bruker finnes (ikke gjør role/email/next-logikk her)
  // Redirect-autoritet er /api/auth/redirect (og middleware)
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  // Fail closed
  if (error || !user) {
    // ✅ ikke send next her — unngår loop
    redirect("/login");
  }

  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title="Systemhelse"
        lead="Systemstatus, flytsjekk, SLO/alarmer og driftsoppsummering — system truth uten grønnvasking."
        meta={
          <SuperadminCommandList
            items={[
              { label: "Driftsoppsummering", href: "/superadmin/system/operations", description: "Operativ status og SLO" },
              { label: "Flytdiagnostikk", href: "/superadmin/system#flytdiagnostikk", description: "OK / WARN / FAIL" },
              { label: "Kjøkken", href: "/kitchen", description: "Produksjonssjekk (superadmin-tilgang)" },
            ]}
          />
        }
      />

      <SystemClient />
    </SuperadminPageShell>
  );
}
