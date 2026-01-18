// app/admin/page.tsx
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { getMenuForDatesAdmin, type MenuContent } from "@/lib/sanity/queries";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "active" | "paused" | "closed";
type SystemLevel = "ok" | "followup" | "critical";

function chipClass(level: SystemLevel) {
  if (level === "critical") return "lp-chip lp-chip-crit";
  if (level === "followup") return "lp-chip lp-chip-warn";
  return "lp-chip lp-chip-ok";
}

function chipLabel(level: SystemLevel) {
  if (level === "critical") return "Kritisk";
  if (level === "followup") return "Krever oppfølging";
  return "Alt OK";
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

function hasText(v: unknown) {
  return typeof v === "string" && v.trim().length > 0;
}

function hasAllergens(v: unknown) {
  return Array.isArray(v) && v.length > 0;
}

export default async function AdminPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name, company_id, location_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const role = (profile?.role as Role | undefined) ?? undefined;

  if (!role || (role !== "superadmin" && role !== "company_admin")) {
    redirect("/week");
  }

  const isSuperadmin = role === "superadmin";

  // ----------------------------
  // Company admin: firmastatus (lite)
  // ----------------------------
  let companyStatus: CompanyStatus | null = null;
  if (!isSuperadmin && profile?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("status")
      .eq("id", profile.company_id)
      .maybeSingle();

    companyStatus = (company?.status as CompanyStatus | undefined) ?? "active";
  }

  // ----------------------------
  // Superadmin: systemstatus (aggregert)
  // ----------------------------
  let counts = { active: 0, paused: 0, closed: 0 };
  let alerts: { kind: "followup" | "critical"; text: string }[] = [];
  let systemLevel: SystemLevel = "ok";

  if (isSuperadmin) {
    // A) Firma-telling
    const { data: companies } = await supabase
      .from("companies")
      .select("status")
      .limit(5000);

    const list = (companies ?? []) as { status: CompanyStatus | null }[];

    for (const c of list) {
      const s = (c.status ?? "active") as CompanyStatus;
      if (s === "active") counts.active++;
      else if (s === "paused") counts.paused++;
      else counts.closed++;
    }

    // Aggregert varsling – rolig, ledervennlig
    if (counts.paused > 0) {
      alerts.push({
        kind: "followup",
        text: `${counts.paused} firma er pauset (krever oppfølging).`,
      });
    }
    if (counts.closed > 0) {
      alerts.push({
        kind: "followup",
        text: `${counts.closed} firma er stengt (kontroller kontrakt/status).`,
      });
    }

    // B) 🍽️ Menyvarsler for NESTE uke (Man–Fre)
    // Neste uke = startOfWeek(today) + 7
    const todayISO = osloTodayISODate();
    const thisWeekStart = startOfWeekISO(todayISO);
    const nextWeekStart = addDaysISO(thisWeekStart, 7);

    const nextWeekDates = Array.from({ length: 5 }).map((_, i) =>
      addDaysISO(nextWeekStart, i)
    );

    // Sanity: hent ALT (også upublisert, aldri drafts)
    const sanityRows: MenuContent[] = await getMenuForDatesAdmin(nextWeekDates);
    const byDate = new Map<string, MenuContent>();
    for (const m of sanityRows) byDate.set(m.date, m);

    // DB mirror: publiseringsstatus (menu_visibility_days)
    let dbPublished = new Map<string, boolean>();
    let canCheckDb = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (canCheckDb) {
      const admin = supabaseAdmin();
      const { data: visRows, error: visErr } = await admin
        .from("menu_visibility_days")
        .select("date,is_published")
        .in("date", nextWeekDates);

      if (!visErr) {
        for (const r of visRows ?? []) {
          dbPublished.set(String((r as any).date), Boolean((r as any).is_published));
        }
      } else {
        canCheckDb = false;
        alerts.push({
          kind: "followup",
          text: "Kunne ikke verifisere publiseringsstatus i DB (menu_visibility_days).",
        });
      }
    } else {
      alerts.push({
        kind: "followup",
        text: "SUPABASE_SERVICE_ROLE_KEY mangler – publiseringsstatus kan ikke verifiseres.",
      });
    }

    let missingCount = 0;
    let unpublishedCount = 0;

    for (const date of nextWeekDates) {
      const menu = byDate.get(date);

      const title = menu?.title ?? null;
      const description = menu?.description ?? null;
      const allergens = menu?.allergens ?? null;

      // Missing = enten ingen doc, eller ufullstendig
      const missing =
        !menu ||
        !hasText(title) ||
        !hasText(description) ||
        !hasAllergens(allergens);

      if (missing) {
        missingCount++;
        continue;
      }

      // Published = DB mirror styrer "synlighet" (fallback: menu.isPublished)
      const published =
        (canCheckDb ? (dbPublished.get(date) ?? false) : false) ||
        (menu?.isPublished ?? false);

      if (!published) unpublishedCount++;
    }

    if (missingCount > 0) {
      alerts.push({
        kind: "followup",
        text: `${missingCount} dager mangler innhold i neste ukemeny (Man–Fre).`,
      });
    }

    if (unpublishedCount > 0) {
      alerts.push({
        kind: "followup",
        text: `${unpublishedCount} dager er ikke publisert for neste uke.`,
      });
    }

    // Systemnivå (rolig)
    systemLevel = "ok";
    if (alerts.length > 0) systemLevel = "followup";
    if (missingCount >= 3) systemLevel = "critical";
    if (counts.paused >= 10) systemLevel = "critical";
  }

  const criticalCount = alerts.filter((a) => a.kind === "critical").length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        {/* Header */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isSuperadmin ? "Superadmin" : "Admin"} – Kontrollsenter
            </h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Full innsikt. Full kontroll. Null dag-til-dag-støy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperadmin ? (
              <span className={chipClass(systemLevel)}>
                Status: {chipLabel(systemLevel)}
              </span>
            ) : (
              <span className="lp-chip lp-chip-neutral">
                Firma: {companyStatus ?? "—"}
              </span>
            )}

            <Link
              href="/week"
              className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            >
              Til uke
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-6 flex flex-wrap gap-2">
          {isSuperadmin ? (
            <>
              <Link
                href="/admin/companies"
                className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
              >
                Firma
              </Link>

              <Link
                href="/admin/menus"
                className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
              >
                Meny
              </Link>

              <Link
                href="/admin/users"
                className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
              >
                Brukere
              </Link>

              <Link
                href="/admin/audit"
                className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
              >
                Audit
              </Link>
            </>
          ) : (
            <Link
              href="/orders"
              className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90"
            >
              Bestillinger
            </Link>
          )}
        </div>

        {/* Content */}
        {isSuperadmin ? (
          <>
            {/* Systemstatus cards */}
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Active firma</div>
                <div className="mt-1 text-2xl font-semibold">{counts.active}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Paused firma</div>
                <div className="mt-1 text-2xl font-semibold">{counts.paused}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Closed firma</div>
                <div className="mt-1 text-2xl font-semibold">{counts.closed}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Kritiske varsler</div>
                <div className="mt-1 text-2xl font-semibold">{criticalCount}</div>
              </div>
            </div>

            {/* Alerts panel */}
            <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Varsler</div>

                <div className="flex gap-3">
                  <Link
                    href="/admin/menus"
                    className="text-xs text-[rgb(var(--lp-muted))] hover:underline"
                  >
                    Gå til meny →
                  </Link>
                  <Link
                    href="/admin/companies"
                    className="text-xs text-[rgb(var(--lp-muted))] hover:underline"
                  >
                    Gå til firma →
                  </Link>
                </div>
              </div>

              {alerts.length === 0 ? (
                <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
                  Ingen varsler. Systemet er rolig.
                </div>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--lp-muted))]">
                  {alerts.slice(0, 6).map((a, idx) => (
                    <li key={idx}>• {a.text}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Identity */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Innlogget</div>
                <div className="mt-1 text-sm font-medium">{user.email ?? user.id}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Rolle</div>
                <div className="mt-1 text-sm font-medium">{role}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Prinsipp</div>
                <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                  Kontrollsenter. Ingen unntak. Systemet er fasit.
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Admin lite */}
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Innlogget</div>
                <div className="mt-1 text-sm font-medium">{user.email ?? user.id}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Rolle</div>
                <div className="mt-1 text-sm font-medium">{role}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Firmastatus</div>
                <div className="mt-1 text-sm font-medium">{companyStatus ?? "—"}</div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-[rgb(var(--lp-surface))] p-5 ring-1 ring-[rgb(var(--lp-border))]">
              <h2 className="text-sm font-semibold">Admin (lite)</h2>
              <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                Du administrerer kun innenfor avtalen. Ingen overstyring av cut-off
                eller unntak.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/orders" className="lp-btn">
                  Bestillinger
                </Link>
                <Link href="/week" className="lp-btn">
                  Til uke
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
