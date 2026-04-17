import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { parseWeekdayMealTiersFromJson, type WeekdayMealTiers } from "@/lib/registration/weekdayMealTiers";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function isUuid(v: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v);
}

/** Kjerne felter fra `company_registrations` (+ join `companies`). */
export type CompanyRegistrationInboxCore = {
  company_id: string;
  company_name: string | null;
  company_orgnr: string | null;
  company_status: string | null;
  employee_count: number;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address_line: string;
  postal_code: string;
  city: string;
  created_at: string;
  updated_at: string | null;
};

/** Ledger + lesbar pipeline (samme semantikk som firmaliste / registreringsdetalj). */
export type CompanyRegistrationInboxPipeline = {
  ledger_pending_agreement_id: string | null;
  ledger_active_agreement_id: string | null;
  pipeline_stage_label: string;
  pipeline_next_label: string;
  pipeline_next_href: string | null;
  pipeline_primary_href: string;
};

export type CompanyRegistrationInboxItem = CompanyRegistrationInboxCore & CompanyRegistrationInboxPipeline;

/** Ren, deterministisk mapping for tester og API. */
export function mapCompanyRegistrationInboxRow(raw: Record<string, unknown>): CompanyRegistrationInboxCore | null {
  const company_id = safeStr(raw.company_id);
  if (!company_id) return null;

  const comp = raw.companies;
  let company_name: string | null = null;
  let company_orgnr: string | null = null;
  let company_status: string | null = null;
  if (comp && typeof comp === "object" && !Array.isArray(comp)) {
    const c = comp as Record<string, unknown>;
    company_name = safeStr(c.name) || null;
    company_orgnr = safeStr(c.orgnr) || null;
    company_status = safeStr(c.status).toUpperCase() || null;
  } else if (Array.isArray(comp) && comp[0] && typeof comp[0] === "object") {
    const c = comp[0] as Record<string, unknown>;
    company_name = safeStr(c.name) || null;
    company_orgnr = safeStr(c.orgnr) || null;
    company_status = safeStr(c.status).toUpperCase() || null;
  }

  const ec = Number(raw.employee_count);
  const employee_count = Number.isFinite(ec) ? Math.floor(ec) : 0;

  return {
    company_id,
    company_name,
    company_orgnr,
    company_status,
    employee_count,
    contact_name: safeStr(raw.contact_name) || "—",
    contact_email: safeStr(raw.contact_email) || "—",
    contact_phone: safeStr(raw.contact_phone) || "—",
    address_line: safeStr(raw.address_line) || "—",
    postal_code: safeStr(raw.postal_code) || "—",
    city: safeStr(raw.city) || "—",
    created_at: safeStr(raw.created_at) || "",
    updated_at: raw.updated_at != null ? safeStr(raw.updated_at) : null,
  };
}

export async function loadCompanyRegistrationsInbox(): Promise<
  { ok: true; items: CompanyRegistrationInboxItem[] } | { ok: false; message: string; code?: string }
> {
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("company_registrations")
    .select(
      "company_id,employee_count,contact_name,contact_email,contact_phone,address_line,postal_code,city,created_at,updated_at,weekday_meal_tiers,delivery_window_from,delivery_window_to,terms_binding_months,terms_notice_months,companies:company_id ( id, name, orgnr, status )"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return { ok: false, message: error.message || "Kunne ikke hente registreringer.", code: safeStr(error.code) || "DB_ERROR" };
  }

  const cores: CompanyRegistrationInboxCore[] = [];
  for (const row of data ?? []) {
    const m = mapCompanyRegistrationInboxRow(row as Record<string, unknown>);
    if (m) cores.push(m);
  }

  const ids = cores.map((c) => c.company_id).filter(Boolean);
  let pendingIdByCompany = new Map<string, string>();
  let activeIdByCompany = new Map<string, string>();

  if (ids.length) {
    const { data: agrLedgerRows, error: agrLedgerErr } = await admin
      .from("agreements")
      .select("id,company_id,status,created_at")
      .in("company_id", ids)
      .in("status", ["PENDING", "ACTIVE"]);

    if (agrLedgerErr) {
      return {
        ok: false,
        message: agrLedgerErr.message || "Kunne ikke hente avtalestatus for innboks.",
        code: safeStr(agrLedgerErr.code) || "DB_ERROR",
      };
    }
    const idx = indexLedgerAgreementsByCompanyId((agrLedgerRows ?? []) as Record<string, unknown>[]);
    pendingIdByCompany = idx.pendingIdByCompany;
    activeIdByCompany = idx.activeIdByCompany;
  }

  const items: CompanyRegistrationInboxItem[] = cores.map((core) => {
    const ledger_pending_agreement_id = pendingIdByCompany.get(core.company_id) ?? null;
    const ledger_active_agreement_id = activeIdByCompany.get(core.company_id) ?? null;
    const pipe = deriveSuperadminRegistrationPipelineNext({
      company_status: core.company_status,
      ledger_pending_agreement_id,
      ledger_active_agreement_id,
    });
    const pipeline_primary_href = deriveSuperadminRegistrationPipelinePrimaryHref({
      company_id: core.company_id,
      company_status: core.company_status,
      ledger_pending_agreement_id,
      ledger_active_agreement_id,
      registration_exists: true,
      pipe,
    });
    return {
      ...core,
      ledger_pending_agreement_id,
      ledger_active_agreement_id,
      pipeline_stage_label: pipe.stage_label,
      pipeline_next_label: pipe.next_label,
      pipeline_next_href: pipe.next_href,
      pipeline_primary_href,
    };
  });

  items.sort((a, b) => {
    const pa = registrationInboxActionPriority({
      company_status: a.company_status,
      ledger_pending_agreement_id: a.ledger_pending_agreement_id,
      ledger_active_agreement_id: a.ledger_active_agreement_id,
    });
    const pb = registrationInboxActionPriority({
      company_status: b.company_status,
      ledger_pending_agreement_id: b.ledger_pending_agreement_id,
      ledger_active_agreement_id: b.ledger_active_agreement_id,
    });
    if (pa !== pb) return pa - pb;
    const ta = Date.parse(a.created_at) || 0;
    const tb = Date.parse(b.created_at) || 0;
    return tb - ta;
  });

  return { ok: true, items };
}

export type CompanyRegistrationDetail = CompanyRegistrationInboxCore & {
  company_created_at: string | null;
  company_updated_at: string | null;
  /** Canonical operative registreringsplan (man–fre BASIS/LUXUS). */
  weekday_meal_tiers: WeekdayMealTiers | null;
  delivery_window_from: string | null;
  delivery_window_to: string | null;
  terms_binding_months: number | null;
  terms_notice_months: number | null;
  /** `public.agreements` nyeste PENDING for firmaet, om den finnes. */
  ledger_pending_agreement_id: string | null;
  /** `public.agreements` ACTIVE for firmaet, om den finnes. */
  ledger_active_agreement_id: string | null;
};

/** Superadmin: lesbar fase + neste lovlige steg (ingen ny workflow-motor — kun visning). */
export function deriveSuperadminRegistrationPipelineNext(opts: {
  company_status: string | null;
  ledger_pending_agreement_id: string | null;
  ledger_active_agreement_id: string | null;
}): { stage_label: string; next_label: string; next_href: string | null } {
  const cs = safeStr(opts.company_status).toUpperCase();
  if (cs === "CLOSED") {
    return {
      stage_label: "Firma stengt",
      next_label: "Ingen operative avtalehandlinger på stengt firma.",
      next_href: null,
    };
  }
  const pid = safeStr(opts.ledger_pending_agreement_id);
  const aid = safeStr(opts.ledger_active_agreement_id);
  const hasP = !!pid;
  const hasA = !!aid;

  if (hasA && hasP) {
    return {
      stage_label: "Avvik: både aktiv og pending ledger-avtale (krever manuell kontroll)",
      next_label: "Åpne aktiv avtale",
      next_href: `/superadmin/agreements/${encodeURIComponent(aid)}`,
    };
  }
  if (hasA) {
    return {
      stage_label: "Aktiv ledger-avtale",
      next_label: "Åpne avtaledetalj (pause m.m. etter behov)",
      next_href: `/superadmin/agreements/${encodeURIComponent(aid)}`,
    };
  }
  if (hasP) {
    return {
      stage_label: "Avtaleutkast venter (PENDING)",
      next_label: "Godkjenn avtale (gjør avtalen gjeldende)",
      next_href: `/superadmin/agreements/${encodeURIComponent(pid)}`,
    };
  }
  return {
    stage_label: "Registrert — mangler ledger-avtaleutkast",
    next_label: "Opprett avtaleutkast",
    next_href: null,
  };
}

/** Én felles URL for «anbefalt neste steg» (superadmin firmaliste + registreringsinnboks). */
export function deriveSuperadminRegistrationPipelinePrimaryHref(opts: {
  company_id: string;
  company_status: string | null;
  ledger_pending_agreement_id: string | null;
  ledger_active_agreement_id: string | null;
  registration_exists: boolean;
  pipe?: { next_href: string | null };
}): string {
  const cid = safeStr(opts.company_id);
  const pipe =
    opts.pipe ??
    deriveSuperadminRegistrationPipelineNext({
      company_status: opts.company_status,
      ledger_pending_agreement_id: opts.ledger_pending_agreement_id,
      ledger_active_agreement_id: opts.ledger_active_agreement_id,
    });
  if (!cid) return "/superadmin/companies";
  if (pipe.next_href) return pipe.next_href;
  if (safeStr(opts.company_status).toUpperCase() === "CLOSED") {
    return `/superadmin/companies/${encodeURIComponent(cid)}`;
  }
  const hasP = !!safeStr(opts.ledger_pending_agreement_id);
  const hasA = !!safeStr(opts.ledger_active_agreement_id);
  if (!hasP && !hasA && opts.registration_exists) {
    return `/superadmin/registrations/${encodeURIComponent(cid)}`;
  }
  return `/superadmin/companies/${encodeURIComponent(cid)}`;
}

/**
 * Superadmin avtaleliste: firmas operative fase (derive) + neste lovlige steg for denne avtaleraden.
 * Gjenbruker samme ledger-pekere som firmaliste/registrering.
 */
export function deriveSuperadminAgreementListRowPresentation(opts: {
  agreement_id: string;
  agreement_status: string | null;
  company_status: string | null;
  ledger_pending_agreement_id: string | null;
  ledger_active_agreement_id: string | null;
}): { pipeline_stage_label: string; next_label: string; next_href: string } {
  const aid = safeStr(opts.agreement_id);
  const href = `/superadmin/agreements/${encodeURIComponent(aid)}`;
  const ast = safeStr(opts.agreement_status).toUpperCase();
  const pipe = deriveSuperadminRegistrationPipelineNext({
    company_status: opts.company_status,
    ledger_pending_agreement_id: opts.ledger_pending_agreement_id,
    ledger_active_agreement_id: opts.ledger_active_agreement_id,
  });
  const pid = safeStr(opts.ledger_pending_agreement_id);
  const actId = safeStr(opts.ledger_active_agreement_id);
  const isLedgerPending = !!pid && aid === pid;
  const isLedgerActive = !!actId && aid === actId;

  if (ast === "PENDING" && isLedgerPending) {
    return { pipeline_stage_label: pipe.stage_label, next_label: "Godkjenn eller avslå avtale", next_href: href };
  }
  if (ast === "ACTIVE" && isLedgerActive) {
    return {
      pipeline_stage_label: pipe.stage_label,
      next_label: "Åpne detalj for pause av aktiv ledger-avtale (ingen resume-RPC)",
      next_href: href,
    };
  }
  if (ast === "PENDING" || ast === "ACTIVE") {
    return {
      pipeline_stage_label: `${pipe.stage_label} · Avtalerad: ${ast} (eldre/arkiv)`,
      next_label: "Åpne detalj",
      next_href: href,
    };
  }
  if (ast === "PAUSED") {
    return {
      pipeline_stage_label: "Ledger-avtale pauset (public.agreements)",
      next_label: "Ingen canonical gjenopptaks-RPC for ledger — åpne detalj for innsyn og sporbarhet",
      next_href: href,
    };
  }
  if (ast === "REJECTED" || ast === "TERMINATED") {
    return { pipeline_stage_label: "Avsluttet avtale", next_label: "Se detalj / historikk", next_href: href };
  }
  return { pipeline_stage_label: pipe.stage_label, next_label: "Åpne avtale", next_href: href };
}

/** Lavere tall = høyere prioritet i innboks (superadmin). */
export function registrationInboxActionPriority(opts: {
  company_status: string | null;
  ledger_pending_agreement_id: string | null;
  ledger_active_agreement_id: string | null;
}): number {
  const cs = safeStr(opts.company_status).toUpperCase();
  if (cs === "CLOSED") return 80;
  const hasP = !!safeStr(opts.ledger_pending_agreement_id);
  const hasA = !!safeStr(opts.ledger_active_agreement_id);
  if (hasP) return 10;
  if (!hasP && !hasA) return 20;
  if (hasA) return 50;
  return 60;
}

/**
 * Grupperer `public.agreements`-rader (forventes filtrert til PENDING/ACTIVE) per firma.
 * Nyeste PENDING per `company_id` (etter `created_at`), én ACTIVE per firma (første treff).
 */
export function indexLedgerAgreementsByCompanyId(
  rows: ReadonlyArray<Record<string, unknown>>
): { pendingIdByCompany: Map<string, string>; activeIdByCompany: Map<string, string> } {
  const pendingIdByCompany = new Map<string, string>();
  const pendingTsByCompany = new Map<string, number>();
  const activeIdByCompany = new Map<string, string>();

  for (const raw of rows) {
    const cid = safeStr(raw.company_id);
    const id = safeStr(raw.id);
    if (!cid || !id) continue;
    const st = safeStr(raw.status).toUpperCase();
    if (st === "ACTIVE") {
      if (!activeIdByCompany.has(cid)) activeIdByCompany.set(cid, id);
      continue;
    }
    if (st === "PENDING") {
      const tsRaw = raw.created_at != null ? Date.parse(String(raw.created_at)) : NaN;
      const ts = Number.isFinite(tsRaw) ? tsRaw : 0;
      const prev = pendingTsByCompany.get(cid);
      if (prev === undefined || ts >= prev) {
        pendingTsByCompany.set(cid, ts);
        pendingIdByCompany.set(cid, id);
      }
    }
  }

  return { pendingIdByCompany, activeIdByCompany };
}

/** Eksponert for enhetstest (samme operativ mapping som detalj-GET). */
export function mapCompanyRegistrationDetailRow(raw: Record<string, unknown>): CompanyRegistrationDetail | null {
  const base = mapCompanyRegistrationInboxRow(raw);
  if (!base) return null;

  const comp = raw.companies;
  let company_created_at: string | null = null;
  let company_updated_at: string | null = null;
  if (comp && typeof comp === "object" && !Array.isArray(comp)) {
    const c = comp as Record<string, unknown>;
    company_created_at = c.created_at != null ? safeStr(c.created_at) : null;
    company_updated_at = c.updated_at != null ? safeStr(c.updated_at) : null;
  } else if (Array.isArray(comp) && comp[0] && typeof comp[0] === "object") {
    const c = comp[0] as Record<string, unknown>;
    company_created_at = c.created_at != null ? safeStr(c.created_at) : null;
    company_updated_at = c.updated_at != null ? safeStr(c.updated_at) : null;
  }

  const ecn = Number(raw.terms_binding_months);
  const ncn = Number(raw.terms_notice_months);

  return {
    ...base,
    company_created_at,
    company_updated_at,
    weekday_meal_tiers: parseWeekdayMealTiersFromJson(raw.weekday_meal_tiers),
    delivery_window_from: raw.delivery_window_from != null ? safeStr(raw.delivery_window_from) || null : null,
    delivery_window_to: raw.delivery_window_to != null ? safeStr(raw.delivery_window_to) || null : null,
    terms_binding_months: Number.isFinite(ecn) && ecn > 0 ? Math.floor(ecn) : null,
    terms_notice_months: Number.isFinite(ncn) && ncn >= 0 ? Math.floor(ncn) : null,
    ledger_pending_agreement_id: null,
    ledger_active_agreement_id: null,
  };
}

export async function loadCompanyRegistrationDetail(companyId: string): Promise<
  | { ok: true; item: CompanyRegistrationDetail }
  | { ok: false; notFound: true }
  | { ok: false; message: string; code?: string }
> {
  const id = safeStr(companyId);
  if (!id || !isUuid(id)) {
    return { ok: false, notFound: true };
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("company_registrations")
    .select(
      "company_id,employee_count,contact_name,contact_email,contact_phone,address_line,postal_code,city,created_at,updated_at,weekday_meal_tiers,delivery_window_from,delivery_window_to,terms_binding_months,terms_notice_months,companies:company_id ( id, name, orgnr, status, created_at, updated_at )"
    )
    .eq("company_id", id)
    .maybeSingle();

  if (error) {
    return { ok: false, message: error.message || "Kunne ikke hente registrering.", code: safeStr(error.code) || "DB_ERROR" };
  }
  if (!data) {
    return { ok: false, notFound: true };
  }

  const item = mapCompanyRegistrationDetailRow(data as Record<string, unknown>);
  if (!item) {
    return { ok: false, notFound: true };
  }

  const { data: pendList } = await admin
    .from("agreements")
    .select("id")
    .eq("company_id", id)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1);

  const { data: actRow } = await admin.from("agreements").select("id").eq("company_id", id).eq("status", "ACTIVE").maybeSingle();

  const ledger_pending_agreement_id =
    Array.isArray(pendList) && pendList[0] && safeStr((pendList[0] as { id?: unknown }).id) ? safeStr((pendList[0] as { id?: unknown }).id) : null;
  const ledger_active_agreement_id = actRow && safeStr((actRow as { id?: unknown }).id) ? safeStr((actRow as { id?: unknown }).id) : null;

  return {
    ok: true,
    item: {
      ...item,
      ledger_pending_agreement_id,
      ledger_active_agreement_id,
    },
  };
}
