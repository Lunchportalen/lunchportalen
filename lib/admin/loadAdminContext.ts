// lib/admin/loadAdminContext.ts
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin, hasSupabaseAdminConfig } from "@/lib/supabase/admin";
import { computeRole, homeForRole, type Role } from "@/lib/auth/roles";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";

export type CompanyStatusUI = "active" | "paused" | "closed" | "pending";

export type AdminProfile = {
  role: Role | null;
  email: string | null;
  company_id: string | null;
  location_id: string | null;
  disabled_at?: string | null;
};

export type CompanyRowMin = {
  id: string;
  name: string | null;
  status: any;
};

export type AdminCounts = {
  employeesTotal: number;
  employeesActive: number;
  employeesDisabled: number;
  /** company_locations rows for this company */
  locationsTotal: number;
  /** orders.status = ACTIVE for Oslo today */
  ordersTodayActive: number;
  /** ACTIVE orders in current ISO week (Mon–Sun window used by /api/admin/dashboard) */
  ordersWeekActive: number;
};

export type AdminDebug = {
  authUserId: string;
  authEmail: string;
  envSupabaseUrl: string | null;
  hasServiceKey: boolean;
  role?: string | null;
  companyIdPresent?: boolean;
  q_profile_user_id: { hasData: boolean; error: string | null } | null;
  q_profile_id: { hasData: boolean; error: string | null } | null;
  q_profile_email: { hasData: boolean; error: string | null } | null;
  q_company: { hasData: boolean; error: string | null } | null;
  q_counts: Record<string, string | null>;
};

export type BlockedReason =
  | "ACCOUNT_DISABLED"
  | "MISSING_COMPANY_ID"
  | "COMPANY_INACTIVE"
  | "COUNTS_FAILED"
  | "FORBIDDEN";

export type AdminContextOk = {
  ok: true;
  user: any;
  role: Role;
  profile: AdminProfile;
  companyId: string;
  companyStatus: CompanyStatusUI;
  company: CompanyRowMin | null;
  counts: AdminCounts;
  dbg: AdminDebug;
};

export type AdminContextBlocked = {
  ok: false;
  blocked: BlockedReason;
  user: any;
  role: Role;
  profile: AdminProfile | null;
  companyId: string | null;
  companyStatus: CompanyStatusUI | null;
  company: CompanyRowMin | null;
  counts: AdminCounts | null;
  dbg: AdminDebug;
  support: { reason: string; companyId: string | null; locationId: string | null };
  nextSteps: string[];
};

export type AdminContext = AdminContextOk | AdminContextBlocked;

/**
 * ✅ Type-guard for stabil TS narrowing i pages/components.
 * Bruk: if (isAdminContextBlocked(ctx)) { ... ctx.blocked ... }
 */
export function isAdminContextBlocked(ctx: AdminContext): ctx is AdminContextBlocked {
  return ctx.ok === false;
}

/* =========================================================
   Small helpers
========================================================= */
function errToText(e: any) {
  if (!e) return "—";
  if (typeof e === "string") return e;
  if (typeof e?.message === "string" && e.message.trim()) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function setDebugRole(dbg: AdminDebug, role: string | null, companyIdPresent: boolean) {
  if (process.env.NODE_ENV !== "production") {
    dbg.role = role;
    dbg.companyIdPresent = companyIdPresent;
  }
}

export function normalizeCompanyStatus(v: any): CompanyStatusUI {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE" || s === "active") return "active";
  if (s === "PAUSED" || s === "paused") return "paused";
  if (s === "CLOSED" || s === "closed") return "closed";
  return "pending";
}

/* =========================================================
   Core loader
========================================================= */
export async function loadAdminContext(opts?: {
  /**
   * Default: "/admin"
   * Brukes ved redirect til login med next=
   */
  nextPath?: string;
  /**
   * Default: true
   * Hvis true: redirects bort hvis role != company_admin
   * Hvis false: returnerer role og lar caller håndtere.
   */
  enforceCompanyAdmin?: boolean;
  /**
   * Default: false
   * Hvis true: returnerer blokkert state (i stedet for å krasje/returnere “tom UI”).
   * OBS: login-redirect vil fortsatt skje hvis ikke innlogget.
   */
  returnBlockedState?: boolean;
}): Promise<AdminContext> {
  const nextPath = opts?.nextPath ?? "/admin";
  const enforceCompanyAdmin = opts?.enforceCompanyAdmin ?? true;
  const returnBlockedState = opts?.returnBlockedState ?? false;

  // 1) Auth via cookie-session (RLS-safe)
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);

  // 2) Service role for robuste oppslag (unngår RLS)
  const admin = supabaseAdmin();

  const authUserId = user.id;
  const authEmail = String(user.email ?? "").trim().toLowerCase();

  const dbg: AdminDebug = {
    authUserId,
    authEmail,
    envSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? String(process.env.NEXT_PUBLIC_SUPABASE_URL).slice(0, 60) + "…"
      : null,
    hasServiceKey: hasSupabaseAdminConfig(),
    q_profile_user_id: null,
    q_profile_id: null,
    q_profile_email: null,
    q_company: null,
    q_counts: {},
  };

  // 3) Robust profile load (prioritet: user_id → id → email)
  let profile: AdminProfile | null = null;

  {
    const r = await admin
      .from("profiles")
      .select("role, email, company_id, location_id, disabled_at")
      .eq("user_id", authUserId)
      .maybeSingle();

    dbg.q_profile_user_id = { hasData: Boolean(r.data), error: r.error?.message ?? null };
    if (r.data) profile = r.data as any;
  }

  if (!profile) {
    const r = await admin
      .from("profiles")
      .select("role, email, company_id, location_id, disabled_at")
      .eq("id", authUserId)
      .maybeSingle();

    dbg.q_profile_id = { hasData: Boolean(r.data), error: r.error?.message ?? null };
    if (r.data) profile = r.data as any;
  }

  if (!profile && authEmail) {
    const r = await admin
      .from("profiles")
      .select("role, email, company_id, location_id, disabled_at, created_at")
      .ilike("email", authEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    dbg.q_profile_email = { hasData: Boolean(r.data), error: r.error?.message ?? null };
    if (r.data) profile = r.data as any;
  }

  // Rolle – profile.role hvis finnes, ellers metadata fallback
  const rawProfileRole = String(profile?.role ?? "").trim().toLowerCase();
  const normalizedProfileRole =
    rawProfileRole === "admin" || rawProfileRole === "companyadmin" ? "company_admin" : profile?.role;
  const role = computeRole(user, normalizedProfileRole);

  // Gate: /admin kun company_admin
  if (enforceCompanyAdmin && role !== "company_admin") {
    if (returnBlockedState) {
      setDebugRole(dbg, role, Boolean(profile?.company_id));
      return {
        ok: false,
        blocked: "FORBIDDEN",
        user,
        role,
        profile,
        companyId: profile?.company_id ?? null,
        companyStatus: null,
        company: null,
        counts: null,
        dbg,
        support: { reason: "ADMIN_FORBIDDEN_ROLE", companyId: profile?.company_id ?? null, locationId: profile?.location_id ?? null },
        nextSteps: [
          "Denne flaten krever rolle firmaadmin (company_admin) med tilknytning til ett firma.",
          "Superadmin- og systembeslutninger (firmastatus, avtalegodkjenning, tverrfirma) hører ikke til i /admin.",
        ],
      };
    }
    redirect(homeForRole(role));
  }

  const blocked = (payload: Omit<AdminContextBlocked, "ok" | "user" | "role" | "dbg">): AdminContextBlocked => {
    setDebugRole(dbg, role, Boolean(profile?.company_id));
    return {
      ok: false,
      user,
      role,
      dbg,
      ...payload,
    };
  };

  // Disabled gate
  if (profile?.disabled_at) {
    const out = blocked({
      blocked: "ACCOUNT_DISABLED",
      profile,
      companyId: profile.company_id ?? null,
      companyStatus: null,
      company: null,
      counts: null,
      support: {
        reason: "ACCOUNT_DISABLED_ADMIN_VIEW",
        companyId: profile.company_id ?? null,
        locationId: profile.location_id ?? null,
      },
      nextSteps: ["Kontakt superadmin for reaktivering dersom dette er en feil."],
    });

    // returnBlockedState påvirker ikke her (vi returnerer alltid blokkert object hvis det skjer)
    return out;
  }

  // Må ha company_id for company_admin
  if (role === "company_admin" && !profile?.company_id) {
    return blocked({
      blocked: "MISSING_COMPANY_ID",
      profile,
      companyId: null,
      companyStatus: null,
      company: null,
      counts: null,
      support: { reason: "COMPANY_ADMIN_MISSING_COMPANY_ID", companyId: null, locationId: null },
      nextSteps: [
        "Superadmin knytter profilen til firma (profiles.company_id + ev. profiles.location_id).",
        "Firma må være aktivert (ACTIVE) før full tilgang.",
      ],
    });
  }

  const companyId = profile?.company_id ?? null;
  if (!companyId) {
    return blocked({
      blocked: "MISSING_COMPANY_ID",
      profile,
      companyId: null,
      companyStatus: null,
      company: null,
      counts: null,
      support: { reason: "COMPANY_ADMIN_MISSING_COMPANY_ID", companyId: null, locationId: profile?.location_id ?? null },
      nextSteps: [
        "Superadmin knytter profilen til firma (profiles.company_id + ev. profiles.location_id).",
        "Firma må være aktivert (ACTIVE) før full tilgang.",
      ],
    });
  }
  setDebugRole(dbg, role, Boolean(companyId));

  // Firma
  const companyRes = await admin.from("companies").select("id, status, name").eq("id", companyId).maybeSingle();
  dbg.q_company = { hasData: Boolean(companyRes.data), error: companyRes.error?.message ?? null };

  const companyRow = (companyRes.data ?? null) as any as CompanyRowMin | null;
  const companyStatus = normalizeCompanyStatus(companyRow?.status);

  // Sperr hvis ikke ACTIVE
  if (companyStatus !== "active") {
    return blocked({
      blocked: "COMPANY_INACTIVE",
      profile,
      companyId,
      companyStatus,
      company: companyRow,
      counts: null,
      support: {
        reason:
          companyStatus === "paused"
            ? "COMPANY_PAUSED_ADMIN_VIEW"
            : companyStatus === "closed"
              ? "COMPANY_CLOSED_ADMIN_VIEW"
              : "COMPANY_PENDING_ADMIN_VIEW",
        companyId,
        locationId: profile.location_id ?? null,
      },
      nextSteps: ["Kontakt superadmin for status/reaktivering etter avtale."],
    });
  }

  // Count helper
  async function safeCountExact(name: string, q: any): Promise<number> {
    const { count, error } = await q;
    if (error) {
      dbg.q_counts[name] = error?.message ?? errToText(error);
      return 0;
    }
    dbg.q_counts[name] = null;
    return Number(count ?? 0);
  }

  // Ansatte-tall (admin-relevant)
  const employeesTotalP = safeCountExact(
    "employees_total",
    admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("company_id", companyId).eq("role", "employee")
  );

  const employeesActiveP = safeCountExact(
    "employees_active",
    admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("role", "employee")
      .is("disabled_at", null)
  );

  const employeesDisabledP = safeCountExact(
    "employees_disabled",
    admin
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("role", "employee")
      .not("disabled_at", "is", null)
  );

  const todayISO = osloTodayISODate();
  const weekStart = startOfWeekISO(todayISO);
  const weekEnd = addDaysISO(weekStart, 7);

  const locationsTotalP = safeCountExact(
    "locations_total",
    admin.from("company_locations").select("id", { count: "exact", head: true }).eq("company_id", companyId)
  );

  const ordersTodayActiveP = safeCountExact(
    "orders_today_active",
    admin.from("orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("date", todayISO).eq("status", "ACTIVE")
  );

  const ordersWeekActiveP = safeCountExact(
    "orders_week_active",
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .gte("date", weekStart)
      .lt("date", weekEnd)
      .eq("status", "ACTIVE")
  );

  const [
    employeesTotal,
    employeesActive,
    employeesDisabled,
    locationsTotal,
    ordersTodayActive,
    ordersWeekActive,
  ] = await Promise.all([
    employeesTotalP,
    employeesActiveP,
    employeesDisabledP,
    locationsTotalP,
    ordersTodayActiveP,
    ordersWeekActiveP,
  ]);

  const countErrors = Object.entries(dbg.q_counts).filter(([, v]) => v);

  if (countErrors.length) {
    return blocked({
      blocked: "COUNTS_FAILED",
      profile,
      companyId,
      companyStatus,
      company: companyRow,
      counts: {
        employeesTotal,
        employeesActive,
        employeesDisabled,
        locationsTotal,
        ordersTodayActive,
        ordersWeekActive,
      },
      support: {
        reason: "ADMIN_OVERVIEW_COUNTS_FAILED",
        companyId,
        locationId: profile.location_id ?? null,
      },
      nextSteps: ["Sjekk at profiles.disabled_at finnes.", "Sjekk at profiles.company_id og profiles.role er korrekte."],
    });
  }

  // OK
  return {
    ok: true,
    user,
    role,
    profile,
    companyId,
    companyStatus,
    company: companyRow,
    counts: {
      employeesTotal,
      employeesActive,
      employeesDisabled,
      locationsTotal,
      ordersTodayActive,
      ordersWeekActive,
    },
    dbg,
  };
}
