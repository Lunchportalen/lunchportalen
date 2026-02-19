// app/superadmin/companies/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import CompaniesClient from "./companies-client";

import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { computeRole, hasRole, type Role } from "@/lib/auth/roles";

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

  return (
    <main className="lp-select-text mx-auto max-w-6xl px-4 py-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Firma</h1>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Administrer firma, status og avtaler uten avbrudd.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/superadmin"
            className="rounded-2xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
          >
            Dashboard
          </Link>

          <Link
            href="/superadmin/audit"
            className="rounded-2xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
          >
            Audit
          </Link>

          <Link
            href="/superadmin/system"
            className="rounded-2xl border bg-white px-3 py-2 text-xs font-semibold hover:bg-neutral-50"
          >
            System
          </Link>
        </div>
      </header>

      <div className="mt-8">
        <CompaniesClient />
      </div>
    </main>
  );
}
