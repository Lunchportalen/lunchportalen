// app/superadmin/audit/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import React from "react";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";
import AuditClient from "./audit-client";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null; disabled_at?: string | null };

/* =========================
   Helpers (enterprise-safe)
========================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}

/** Minimal, enterprise-grade error surface (no leaks) */
function ErrorSurface(props: { title?: string; message: string; detail?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lp-select-text">
      <div className="lp-glass-card rounded-card p-6">
        <div className="flex items-center justify-between">
          <div className="text-xs font-extrabold tracking-wide text-neutral-600">SUPERADMIN MODE</div>
          <div className="text-xs font-extrabold text-rose-700">AUDIT</div>
        </div>

        <div className="mt-2 text-2xl font-black tracking-tight text-neutral-950">{props.title ?? "Audit"}</div>
        <p className="mt-2 text-sm font-semibold text-[rgb(var(--lp-muted))]">{props.message}</p>

        {props.detail ? (
          <pre className="mt-4 overflow-auto rounded-2xl bg-white p-3 text-xs font-semibold text-rose-700 ring-1 ring-neutral-200">
            {props.detail}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

/* =========================
   Page
========================= */
export default async function SuperadminAuditPage() {
  const supabase = await supabaseServer();

  /* =========================================================
     1) Auth (fail-closed)
  ========================================================= */
  const { data: userRes, error: userErr } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    redirect("/login?next=/superadmin/audit");
  }

  /* =========================================================
     2) Profile read (profiles.user_id = auth.users.id)
     - profiles.role === "superadmin"
  ========================================================= */
  const { data: profile, error: pErr } = await supabase
    .from("profiles")
    .select("role,disabled_at")
    .eq("user_id", user.id)
    .maybeSingle<ProfileRow>();

  // Fail-closed hvis profiles ikke kan leses
  if (pErr) {
    return <ErrorSurface message="Kunne ikke verifisere superadmin-profil." detail={safeStr(pErr.message)} />;
  }

  // Disabled gate
  if (profile?.disabled_at) {
    redirect("/login?next=/superadmin/audit");
  }

  if (!profile?.role || profile.role !== "superadmin") {
    redirect("/login?next=/superadmin/audit");
  }

  /* =========================================================
     3) Render client UI (shell)
  ========================================================= */
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 lp-select-text">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Audit</h1>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
            Spor hendelser på rid, actor, action og entity – deterministisk og uten støy.
          </p>
        </div>
      </header>

      <AuditClient />
    </main>
  );
}
