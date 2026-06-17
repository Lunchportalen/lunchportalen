// app/superadmin/companies/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import React from "react";
import { redirect } from "next/navigation";

import CompaniesClient from "./companies-client";

import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { computeRole, hasRole, type Role } from "@/lib/auth/roles";
import { getSuperadminCompaniesCmsCopy } from "@/lib/cms/backoffice/getSuperadminCompaniesContent";
import {
  SuperadminCommandList,
  SuperadminHero,
  SuperadminPageShell,
  SuperadminSection,
} from "@/components/superadmin/shell/SuperadminShell";

/* =========================================================
   Superadmin Companies Page
   - Hard gate: must be superadmin
   - Fail-closed
========================================================= */

export default async function SuperadminCompaniesPage() {
  // 🔒 AUTH GATE
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;

  if (error || !user) {
    redirect("/login?next=/superadmin/companies");
  }

  let profileRole: any = null;
  try {
    profileRole = await getRoleForUser(user.id);
  } catch {
    profileRole = null;
  }

  const role: Role = computeRole(user, profileRole);

  if (!hasRole(role, ["superadmin"])) {
    // Fail-closed: no leakage of superadmin UI
    redirect("/status?state=paused&next=/superadmin/companies");
  }

  const cms = await getSuperadminCompaniesCmsCopy();
  const title = cms?.title ?? "Cateringfirma";
  const intro = cms?.intro ?? "Administrer leverandører, kunder, avtaler og drift uten avbrudd.";

  return (
    <SuperadminPageShell fullWidth>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title={title}
        lead={intro}
        meta={
          <SuperadminCommandList
            items={[
              { label: "Revisjon", href: "/superadmin/audit", description: "Auditlogg og sporbarhet" },
              { label: "Systemhelse", href: "/superadmin/system", description: "Flytsjekk og drift" },
            ]}
          />
        }
      />

      <SuperadminSection
        title="Cateringfirma og leverandører"
        lead="Administrer leverandører, kunder, avtaler og drift uten avbrudd."
        flat
      >
        <CompaniesClient
          cmsCopy={{
            searchPlaceholder: cms?.searchPlaceholder ?? null,
            emptyStateTitle: cms?.emptyStateTitle ?? null,
            emptyStateText: cms?.emptyStateText ?? null,
          }}
        />
      </SuperadminSection>
    </SuperadminPageShell>
  );
}
