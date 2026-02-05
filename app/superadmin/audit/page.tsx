// app/superadmin/audit/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import AuditClient from "./audit-client";
import { isSuperadminEmail } from "@/lib/system/emails";


type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type ProfileRow = { role: Role | null; disabled_at?: string | null };

/* =========================
   Helpers (enterprise-safe)
========================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}
function isHardSuperadmin(email: string | null | undefined) {
  return isSuperadminEmail(email);
}

/** Minimal, enterprise-grade error surface (no leaks) */
function ErrorSurface(props: { title?: string; message: string; detail?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 lp-select-text">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))] shadow-sm backdrop-blur">
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
     2) Hard gate (email først)
     ✅ Superadmin skal ikke være avhengig av metadata for å "bli" superadmin.
  ========================================================= */
  if (!isHardSuperadmin(user.email)) {
    redirect("/login?next=/superadmin/audit");
  }

  /* =========================================================
     3) Profile read (FASET hos dere: profiles.user_id = auth.users.id)
     - Brukes kun som ekstra sikkerhetslag (disabled / mismatch)
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

  // Ekstra lag: hvis role finnes og er noe annet enn superadmin -> stopp
  if (profile?.role && profile.role !== "superadmin") {
    redirect("/login?next=/superadmin/audit");
  }

  /* =========================================================
     4) Render client UI
  ========================================================= */
  return <AuditClient />;
}
