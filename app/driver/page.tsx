// app/driver/page.tsx
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

import "server-only";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import DriverRuntimeClient from "./DriverRuntimeClient";
import PageSection from "@/components/layout/PageSection";
import BlockedState from "@/components/admin/BlockedState";
import type { Role } from "@/lib/auth/role";
import { normalizeRoleDefaultEmployee } from "@/lib/auth/role";
import { systemRoleByEmail } from "@/lib/system/emails";
import { getDesignSettings } from "@/lib/cms/design/getDesignSettings";
import { getOverlayBySlug } from "@/lib/cms/public/getOverlayByKey";
import { APP_OVERLAYS } from "@/lib/cms/overlays/registry";
import { renderOverlaySlot } from "@/lib/public/blocks/renderOverlaySlot";

type ProfileRow = {
  role: Role | string | null;
  disabled_at: string | null;
  is_active?: boolean | null;
  company_id?: string | null;
  location_id?: string | null;
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Hard role override (kun for systemkonti).
 * NB: Dette er "first match" før profiles, slik at systembrukere alltid kommer inn.
 */
function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function loginNext(urlPath: string) {
  return `/login?next=${encodeURIComponent(urlPath)}&code=NO_SESSION`;
}

export default async function DriverPage() {
  const supabase = await supabaseServer();

  /* =========================
     🔐 AUTH
  ========================= */
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect(loginNext("/driver"));
  }

  /* =========================
     🔐 ROLE (email hard first, then profiles)
     FASET:
     - profiles.id = auth.users.id (primary)
     - fallback: profiles.user_id = auth.users.id (legacy)
  ========================= */
  const { data: profile, error: pErr } = (await supabase
    .from("profiles")
    .select("role, disabled_at, is_active, company_id, location_id")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle()) as { data: ProfileRow | null; error: any };

  // Fail-closed: hvis vi ikke klarer å lese profilen => ut
  if (pErr || !profile) redirect(loginNext("/driver"));

  // Deaktiverte kontoer skal ikke inn
  if (profile.disabled_at) redirect(loginNext("/driver"));
  if (profile.is_active === false) redirect(loginNext("/driver"));

  const emailRole = roleByEmail(user.email);
  const role: Role = emailRole ?? normalizeRoleDefaultEmployee(profile.role);

  // Kun driver og superadmin
  if (role !== "driver" && role !== "superadmin") {
    redirect("/week");
  }

  if (role === "driver" && (!safeStr(profile.company_id) || !safeStr(profile.location_id))) {
    return (
      <PageSection title="Sjåfør" subtitle="Tilgang er blokkert inntil scope er korrekt tildelt.">
        <BlockedState
          level="critical"
          title="Scope mangler"
          body="Sjåfør-rollen er tenant-bound og krever både firma og lokasjon."
          nextSteps={[
            "Tildel company_id og location_id på brukerprofilen.",
            "Verifiser tilgang via API og RLS før ny innlogging.",
          ]}
          meta={[
            { label: "code", value: "SCOPE_NOT_ASSIGNED" },
            { label: "role", value: role },
            { label: "company_id", value: safeStr(profile.company_id) || "null" },
            { label: "location_id", value: safeStr(profile.location_id) || "null" },
          ]}
        />
      </PageSection>
    );
  }

  const [overlay, designSettings] = await Promise.all([
    getOverlayBySlug(APP_OVERLAYS.driver.slug, { locale: "nb", environment: "prod" }),
    getDesignSettings(),
  ]);
  const topBanner = overlay.ok ? renderOverlaySlot(overlay.blocks, "topBanner", "prod", "nb", designSettings) : null;
  const headerSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "header", "prod", "nb", designSettings) : null;
  const helpSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "help", "prod", "nb", designSettings) : null;
  const footerCtaSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "footerCta", "prod", "nb", designSettings) : null;

  /* =========================
     ✅ PAGE
  ========================= */
  return (
    <>
      {topBanner ? <div className="mb-3 print:hidden">{topBanner}</div> : null}
      {headerSlot ? <div className="mb-3 print:hidden">{headerSlot}</div> : null}
      <div className="print:hidden">
        <PageSection
          title="Sjåfør"
          subtitle="Én leveringsflate: stopp per vindu, firma og lokasjon — status og «markér levert» fra samme API-grunnlag."
          right={
            <aside className="hidden w-full max-w-sm rounded-2xl bg-white px-4 py-3 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))] md:block">
              <div className="font-semibold text-slate-900">Driftsnotat</div>
              <ul className="mt-2 space-y-1">
                <li>Dagens stopp følger Oslo-tid.</li>
                <li>Følg tidsvinduene for hver lokasjon.</li>
                <li>Eventuelle avvik registreres etter levering.</li>
              </ul>
            </aside>
          }
        >
          <div className="flex flex-wrap gap-2 text-xs text-[rgb(var(--lp-muted))]">
            <span className="rounded-full bg-black/5 px-3 py-1">🚚 Dagens stopp</span>
            <span className="rounded-full bg-black/5 px-3 py-1">🗺️ Lokasjoner</span>
            <span className="rounded-full bg-black/5 px-3 py-1">☎️ Kontakt</span>
          </div>
        </PageSection>
      </div>

      <div className="mb-4 hidden print:block">
        <div className="text-xl font-semibold">Sjåfør – leveranser</div>
        <div className="text-xs text-slate-600">Generert fra Lunchportalen</div>
      </div>

      <div className="mt-6 print:mt-0">
        <DriverRuntimeClient />
      </div>
      {helpSlot ? <div className="mt-6 print:hidden">{helpSlot}</div> : null}
      {footerCtaSlot ? <div className="mt-6 print:hidden">{footerCtaSlot}</div> : null}
    </>
  );
}
