// app/superadmin/audit/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import React from "react";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";
import AuditClient from "./audit-client";
import {
  SuperadminHero,
  SuperadminPageShell,
  SuperadminSection,
} from "@/components/superadmin/shell/SuperadminShell";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null; disabled_at?: string | null };

function makeUiRid() {
  return crypto.randomUUID().slice(0, 8);
}

function ErrorSurface(props: { title?: string; message: string }) {
  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title={props.title ?? "Revisjon"}
        lead={props.message}
      />
    </SuperadminPageShell>
  );
}

export default async function SuperadminAuditPage() {
  const supabase = await supabaseServer();

  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    redirect("/login?next=/superadmin/audit");
  }

  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role,disabled_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (pErr) {
    const errorRid = makeUiRid();
    console.error("Audit profile verification failed", { rid: errorRid, error: pErr });
    return <ErrorSurface message={`Noe gikk galt. Referanse: ${errorRid}`} />;
  }

  if (profile?.disabled_at) {
    redirect("/login?next=/superadmin/audit");
  }

  if (!profile?.role || profile.role !== "superadmin") {
    redirect("/login?next=/superadmin/audit");
  }

  return (
    <SuperadminPageShell>
      <SuperadminHero
        variant="command"
        eyebrow="Superadmin"
        title="Revisjon"
        lead="Spor hendelser på RID, aktør, handling og entity. Filtrer operativ drift for avtale- og firmastatushendelser."
      />

      <SuperadminSection title="Auditlogg" lead="Bred tabellflate — kopier ID-er uten layout-brudd." flat>
        <AuditClient />
      </SuperadminSection>
    </SuperadminPageShell>
  );
}
