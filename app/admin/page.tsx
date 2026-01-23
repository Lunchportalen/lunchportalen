// app/admin/page.tsx
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { supabaseServer } from "@/lib/supabase/server";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { getMenuForDatesAdmin, type MenuContent } from "@/lib/sanity/queries";

import EmployeesTable from "@/components/admin/EmployeesTable";
import LocationsPanel from "@/components/admin/LocationsPanel";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";
type CompanyStatus = "active" | "paused" | "closed";
type SystemLevel = "ok" | "followup" | "critical";

/* =========================================================
   Role helpers (samme prinsipp som middleware)
========================================================= */
function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function roleByEmail(email: string | null | undefined): Role | null {
  const e = normEmail(email);
  if (e === "superadmin@lunchportalen.no") return "superadmin";
  if (e === "kjokken@lunchportalen.no") return "kitchen";
  if (e === "driver@lunchportalen.no") return "driver";
  return null;
}

function roleFromMetadata(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

function computeRole(user: any, profileRole?: any): Role {
  const byEmail = roleByEmail(user?.email);
  if (byEmail) return byEmail;

  const pr = String(profileRole ?? "").toLowerCase();
  if (pr === "company_admin") return "company_admin";
  if (pr === "superadmin") return "superadmin";
  if (pr === "kitchen") return "kitchen";
  if (pr === "driver") return "driver";
  if (pr === "employee") return "employee";

  return roleFromMetadata(user);
}

/* =========================================================
   UI helpers
========================================================= */
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

async function countExact(q: any): Promise<number> {
  const { count, error } = await q;
  if (error) throw error;
  return Number(count ?? 0);
}

/* =========================================================
   Page
========================================================= */
export default async function AdminPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin");

  // --- robust profile load (støtter både profiles.user_id og profiles.id) ---
  let profile:
    | {
        role: Role | null;
        full_name: string | null;
        email: string | null;
        company_id: string | null;
        location_id: string | null;
      }
    | null = null;

  // 1) prøv user_id
  {
    const { data: p } = await supabase
      .from("profiles")
      .select("role, full_name, email, company_id, location_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (p) profile = p as any;
  }

  // 2) fallback: prøv id (hvis dere bruker id = auth.user.id)
  if (!profile) {
    const { data: p2 } = await supabase
      .from("profiles")
      .select("role, full_name, email, company_id, location_id")
      .eq("id", user.id)
      .maybeSingle();

    if (p2) profile = p2 as any;
  }

  const role = computeRole(user, profile?.role);

  // ✅ Admin-siden er kun for superadmin og company_admin
  if (role !== "superadmin" && role !== "company_admin") {
    redirect("/week");
  }

  const isSuperadmin = role === "superadmin";

  // ✅ company_admin må ha company_id for å kunne bruke admin
  if (!isSuperadmin && !profile?.company_id) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <h1 className="text-2xl font-semibold tracking-tight">Admin – Kontrollsenter</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
            Full innsikt. Full kontroll. Null dag-til-dag-støy.
          </p>

          <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="text-sm font-semibold">Mangler firmatilknytning</div>
            <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Kontoen din er ikke knyttet til et firma. Ta kontakt med superadmin.
            </div>

            <div className="mt-4 text-xs text-[rgb(var(--lp-muted))]">
              Innlogget: <span className="font-mono">{user.email ?? user.id}</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ----------------------------
  // Company admin: firmastatus + dashboard-tall
  // ----------------------------
  let companyStatus: CompanyStatus | null = null;

  let dash:
    | {
        employees: { total: number; active: number; disabled: number };
        orders: { today: { active: number; cancelled: number }; week: { active: number; cancelled: number } };
        todayISO: string;
        weekStartISO: string;
        weekEndISO: string;
      }
    | null = null;

  if (!isSuperadmin && profile?.company_id) {
    const { data: company } = await supabase
      .from("companies")
      .select("status")
      .eq("id", profile.company_id)
      .maybeSingle();

    companyStatus = (company?.status as CompanyStatus | undefined) ?? "active";

    const todayISO = osloTodayISODate();
    const weekStart = startOfWeekISO(todayISO);
    const weekEnd = addDaysISO(weekStart, 7); // exclusive

    const employeesTotalP = countExact(
      supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .eq("role", "employee")
    );

    const employeesActiveP = countExact(
      supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .eq("role", "employee")
        .is("disabled_at", null)
    );

    const employeesDisabledP = countExact(
      supabase
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .eq("role", "employee")
        .not("disabled_at", "is", null)
    );

    const ordersTodayActiveP = countExact(
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .eq("date", todayISO)
        .eq("status", "ACTIVE")
    );

    const ordersTodayCancelledP = countExact(
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .eq("date", todayISO)
        .eq("status", "CANCELLED")
    );

    const ordersWeekActiveP = countExact(
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .gte("date", weekStart)
        .lt("date", weekEnd)
        .eq("status", "ACTIVE")
    );

    const ordersWeekCancelledP = countExact(
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", profile.company_id)
        .gte("date", weekStart)
        .lt("date", weekEnd)
        .eq("status", "CANCELLED")
    );

    const [
      employeesTotal,
      employeesActive,
      employeesDisabled,
      ordersTodayActive,
      ordersTodayCancelled,
      ordersWeekActive,
      ordersWeekCancelled,
    ] = await Promise.all([
      employeesTotalP,
      employeesActiveP,
      employeesDisabledP,
      ordersTodayActiveP,
      ordersTodayCancelledP,
      ordersWeekActiveP,
      ordersWeekCancelledP,
    ]);

    dash = {
      employees: { total: employeesTotal, active: employeesActive, disabled: employeesDisabled },
      orders: {
        today: { active: ordersTodayActive, cancelled: ordersTodayCancelled },
        week: { active: ordersWeekActive, cancelled: ordersWeekCancelled },
      },
      todayISO,
      weekStartISO: weekStart,
      weekEndISO: weekEnd,
    };
  }

  // ----------------------------
  // Superadmin: systemstatus (aggregert)
  // ----------------------------
  let counts = { active: 0, paused: 0, closed: 0 };
  let alerts: { kind: "followup" | "critical"; text: string }[] = [];
  let systemLevel: SystemLevel = "ok";

  if (isSuperadmin) {
    const { data: companies } = await supabase.from("companies").select("status").limit(5000);
    const list = (companies ?? []) as { status: CompanyStatus | null }[];

    for (const c of list) {
      const s = (c.status ?? "active") as CompanyStatus;
      if (s === "active") counts.active++;
      else if (s === "paused") counts.paused++;
      else counts.closed++;
    }

    if (counts.paused > 0) alerts.push({ kind: "followup", text: `${counts.paused} firma er pauset (krever oppfølging).` });
    if (counts.closed > 0) alerts.push({ kind: "followup", text: `${counts.closed} firma er stengt (kontroller kontrakt/status).` });

    const todayISO = osloTodayISODate();
    const thisWeekStart = startOfWeekISO(todayISO);
    const nextWeekStart = addDaysISO(thisWeekStart, 7);
    const nextWeekDates = Array.from({ length: 5 }).map((_, i) => addDaysISO(nextWeekStart, i));

    const sanityRows: MenuContent[] = await getMenuForDatesAdmin(nextWeekDates);
    const byDate = new Map<string, MenuContent>();
    for (const m of sanityRows) byDate.set(m.date, m);

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
        alerts.push({ kind: "followup", text: "Kunne ikke verifisere publiseringsstatus i DB (menu_visibility_days)." });
      }
    } else {
      alerts.push({ kind: "followup", text: "SUPABASE_SERVICE_ROLE_KEY mangler – publiseringsstatus kan ikke verifiseres." });
    }

    let missingCount = 0;
    let unpublishedCount = 0;

    for (const date of nextWeekDates) {
      const menu = byDate.get(date);
      const title = menu?.title ?? null;
      const description = menu?.description ?? null;
      const allergens = menu?.allergens ?? null;

      const missing = !menu || !hasText(title) || !hasText(description) || !hasAllergens(allergens);

      if (missing) {
        missingCount++;
        continue;
      }

      const published = (canCheckDb ? dbPublished.get(date) ?? false : false) || (menu?.isPublished ?? false);
      if (!published) unpublishedCount++;
    }

    if (missingCount > 0) alerts.push({ kind: "followup", text: `${missingCount} dager mangler innhold i neste ukemeny (Man–Fre).` });
    if (unpublishedCount > 0) alerts.push({ kind: "followup", text: `${unpublishedCount} dager er ikke publisert for neste uke.` });

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
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Full innsikt. Full kontroll. Null dag-til-dag-støy.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isSuperadmin ? (
              <span className={chipClass(systemLevel)}>Status: {chipLabel(systemLevel)}</span>
            ) : (
              <span className="lp-chip lp-chip-neutral">Firma: {companyStatus ?? "—"}</span>
            )}
          </div>
        </div>

        {/* Tabs / nav */}
        <div className="mt-6 flex flex-wrap gap-2">
          {isSuperadmin ? (
            <>
              <Link href="/admin/companies" className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90">
                Firma
              </Link>
              <Link href="/admin/menus" className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90">
                Meny
              </Link>
              <Link href="/admin/users" className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90">
                Brukere
              </Link>
              <Link href="/admin/audit" className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90">
                Audit
              </Link>
            </>
          ) : (
            <>
              <Link href="/admin" className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90">
                Dashboard
              </Link>

              <a href="#employees" className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90">
                Ansatte
              </a>

              <a href="#locations" className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90">
                Lokasjoner
              </a>

              <Link href="/admin/orders" className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/90">
                Ordrer
              </Link>

              <span className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))]">
                Firma-ID: <span className="font-mono">{profile?.company_id ?? "—"}</span>
              </span>
            </>
          )}
        </div>

        {/* Content */}
        {isSuperadmin ? (
          <>
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

            <div className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold">Varsler</div>
                <div className="flex gap-3">
                  <Link href="/admin/menus" className="text-xs text-[rgb(var(--lp-muted))] hover:underline">
                    Gå til meny →
                  </Link>
                  <Link href="/admin/companies" className="text-xs text-[rgb(var(--lp-muted))] hover:underline">
                    Gå til firma →
                  </Link>
                </div>
              </div>

              {alerts.length === 0 ? (
                <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Ingen varsler. Systemet er rolig.</div>
              ) : (
                <ul className="mt-3 space-y-2 text-sm text-[rgb(var(--lp-muted))]">
                  {alerts.slice(0, 6).map((a, idx) => (
                    <li key={idx}>• {a.text}</li>
                  ))}
                </ul>
              )}
            </div>

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
                <div className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Kontrollsenter. Ingen unntak. Systemet er fasit.</div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Ordrer i dag (ACTIVE)</div>
                <div className="mt-1 text-2xl font-semibold">{dash?.orders.today.active ?? 0}</div>
                <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Avbestilt: {dash?.orders.today.cancelled ?? 0}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Ordrer denne uken (ACTIVE)</div>
                <div className="mt-1 text-2xl font-semibold">{dash?.orders.week.active ?? 0}</div>
                <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Avbestilt: {dash?.orders.week.cancelled ?? 0}</div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Ansatte (aktive)</div>
                <div className="mt-1 text-2xl font-semibold">{dash?.employees.active ?? 0}</div>
                <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                  Deaktivert: {dash?.employees.disabled ?? 0} · Totalt: {dash?.employees.total ?? 0}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
                <div className="text-xs text-[rgb(var(--lp-muted))]">Cut-off</div>
                <div className="mt-1 text-2xl font-semibold">08:00</div>
                <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Europe/Oslo · Ingen unntak</div>
              </div>
            </div>

            <div className="mt-6 rounded-3xl bg-[rgb(var(--lp-surface))] p-5 ring-1 ring-[rgb(var(--lp-border))]">
              <h2 className="text-sm font-semibold">Admin (firma)</h2>
              <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
                Du administrerer kun innenfor avtalen. Ingen cut-off-overstyring. Ingen unntak.
              </p>

              <div className="mt-4 text-sm text-[rgb(var(--lp-muted))]">
                Firma-ID: <span className="font-mono">{profile?.company_id ?? "—"}</span>
              </div>

              <div className="mt-2 text-xs text-[rgb(var(--lp-muted))]">
                Periode: <span className="font-mono">{dash?.weekStartISO ?? "—"}</span> →{" "}
                <span className="font-mono">{dash?.weekEndISO ?? "—"}</span>
              </div>
            </div>

            <div id="employees" className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
              <EmployeesTable />
            </div>

            <div id="locations" className="mt-6 rounded-3xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
              <LocationsPanel />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
