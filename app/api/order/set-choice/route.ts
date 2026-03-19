// app/api/order/set-choice/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { assertCompanyActiveOr403 } from "@/lib/guards/assertCompanyActiveApi";
import { supabaseAdmin } from "@/lib/supabase/admin";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING";

type Body = {
  date: string; // YYYY-MM-DD
  choice_key: string; // f.eks. "salatbar", "varmmat"
  note?: string | null; // variant note / valgfri for andre valg
};

type Choice = { key: string; label?: string };

/* =========================
   DB-typer lokalt (for å stoppe TS "never")
========================= */
type ProfileRow = {
  user_id: string;
  company_id: string | null;
  location_id: string | null;
  role?: string | null;
};

type CompanyRow = {
  id: string;
  status?: CompanyStatus | null;
  paused_reason?: string | null;
  closed_reason?: string | null;

  contract_week_tier: Record<string, "BASIS" | "PREMIUM"> | null;
  contract_basis_choices: Choice[] | null;
  contract_premium_choices: Choice[] | null;
};

type DayChoiceUpsert = {
  company_id: string;
  location_id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  choice_key: string;
  note: string | null;
  status: "ACTIVE";
};

type DayChoiceSelect = {
  id: string;
  date: string;
  choice_key: string;
  note: string | null;
  status: string | null;
  updated_at: string | null;
};

type ParsedBody = {
  date: string;
  choice_key: string;
  note: string | null;
};

function logApiError(scope: string, err: any, extra?: Record<string, any>) {
  try {
    console.error(`[${scope}]`, err?.message || err, { ...extra, err });
  } catch {
    console.error(`[${scope}]`, err?.message || err);
  }
}

function assertEnv(name: string, v: string | undefined) {
  if (!v) throw new Error(`Server mangler env: ${name}`);
  return v;
}

/** Europe/Oslo "nå" -> (YYYY-MM-DD, HH:MM) */
function osloNowParts() {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = fmt.formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  return {
    dateISO: `${get("year")}-${get("month")}-${get("day")}`, // YYYY-MM-DD
    timeHM: `${get("hour")}:${get("minute")}`, // HH:MM
  };
}

/** Lås etter 08:00 Europe/Oslo samme dag */
function cutoffState(dateISO: string) {
  const now = osloNowParts();
  const cutoffTime = "08:00";

  const locked = dateISO < now.dateISO ? true : dateISO > now.dateISO ? false : now.timeHM >= cutoffTime;

  return { locked, cutoffTime, now: `${now.dateISO}T${now.timeHM}` };
}

function weekdayKeyOslo(dateISO: string): "mon" | "tue" | "wed" | "thu" | "fri" {
  // Midday UTC for stable weekday calc
  const d = new Date(`${dateISO}T12:00:00Z`);
  const wd = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    weekday: "short",
  }).format(d);

  const map: Record<string, "mon" | "tue" | "wed" | "thu" | "fri"> = {
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
  };

  const key = map[wd];
  if (!key) throw new Error("Dato må være Man–Fre.");
  return key;
}

function cleanNote(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  return s.length > 280 ? s.slice(0, 280) : s;
}

/* =========================
   Variant gate (driftsikkert)
   - Salatbar/Påsmurt krever variant note med riktig type
   - Godtar:
     - "variant||Påsmurt: Roastbiff"
     - "Påsmurt: Roastbiff"
========================= */

function requiresVariant(choiceKey: string) {
  const k = String(choiceKey ?? "").trim().toLowerCase();
  return k === "salatbar" || k === "paasmurt";
}

function parseVariantTypeFromNote(note: string | null): "salatbar" | "paasmurt" | null {
  const n = String(note ?? "").trim();
  if (!n) return null;

  const parts = n.split("||").map((x) => x.trim()).filter(Boolean);
  const payload = parts.length >= 2 ? parts.slice(1).join("||").trim() : parts[0] ?? "";

  const m = /^(Salatbar|Påsmurt)\s*:\s*(.+)$/i.exec(payload);
  if (!m?.[2]) return null;

  const typeRaw = String(m[1]).trim().toLowerCase();
  const value = String(m[2]).trim();
  if (!value) return null;

  // normalize "påsmurt" -> "paasmurt"
  if (typeRaw === "salatbar") return "salatbar";
  if (typeRaw === "påsmurt" || typeRaw === "paasmurt") return "paasmurt";
  return null;
}

async function getAuthedUserId() {
  const url = assertEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anon = assertEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const cookieStore = await cookies();

  const supa = createServerClient(url, anon, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      // Route handlers trenger normalt ikke å sette cookies
      set() {},
      remove() {},
    },
  });

  const { data, error } = await supa.auth.getUser();
  if (error || !data?.user?.id) return null;
  return data.user.id;
}

function supabaseService() {
  return supabaseAdmin();
}

/* =========================
   Tier choice helpers
   - PREMIUM inkluderer BASIS (union)
========================= */
function mergeChoices(basis: Choice[] = [], premium: Choice[] = []) {
  const seen = new Set<string>();
  const out: Choice[] = [];
  for (const c of basis) {
    if (!c?.key || seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  for (const c of premium) {
    if (!c?.key || seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
}

export function parseSetChoiceBody(raw: Partial<Body> | null | undefined, rid: string): ParsedBody | Response {
  const date = String(raw?.date ?? "").trim();
  const choice_key = String(raw?.choice_key ?? "").trim();
  const note = cleanNote(raw?.note);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return jsonErr(rid, "Ugyldig datoformat. Bruk YYYY-MM-DD.", 400, "BAD_DATE");
  }
  if (!choice_key) {
    return jsonErr(rid, "choice_key mangler.", 400, "MISSING_CHOICE_KEY");
  }

  return { date, choice_key, note };
}

export function validateCutoffAndWeekday(date: string, rid: string) {
  const cutoff = cutoffState(date);
  if (cutoff.locked) {
    return {
      errorRes: jsonErr(rid, "Dagen er låst etter 08:00.", 423, {
        code: "LOCKED",
        detail: { locked: true, cutoffTime: cutoff.cutoffTime, canAct: false },
      }),
      cutoff,
      dayKey: null,
    } as const;
  }

  try {
    const dayKey = weekdayKeyOslo(date);
    return { errorRes: null, cutoff, dayKey } as const;
  } catch {
    return {
      errorRes: jsonErr(rid, "Dato må være Man–Fre. Helg bestilles ikke i portalen.", 400, {
        code: "WEEKDAY_ONLY",
        detail: { locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      }),
      cutoff,
      dayKey: null,
    } as const;
  }
}

export async function POST(req: Request) {
  const rid = makeRid();

  try {
    const rawBody = (await req.json().catch(() => null)) as Partial<Body> | null;
    const parsed = parseSetChoiceBody(rawBody, rid);
    if (parsed instanceof Response) return parsed;

    const { date, choice_key, note } = parsed;

    // 1) Auth (cookie-basert)
    const user_id = await getAuthedUserId();
    if (!user_id) {
      return jsonErr(rid, "Ikke innlogget.", 401, "UNAUTH");
    }

    // 2) Cutoff-lås
    const cutoffResult = validateCutoffAndWeekday(date, rid);
    if (cutoffResult.errorRes) return cutoffResult.errorRes;
    const cutoff = cutoffResult.cutoff;
    const dayKey = cutoffResult.dayKey!;

    // 4) Service role for DB (ingen RLS)
    const supa = supabaseService();

    // 5) Profil -> firma + lokasjon
    const { data: profileRaw, error: pErr } = await (supa as any)
      .from("profiles")
      .select("user_id, company_id, location_id, role")
      .eq("user_id", user_id)
      .maybeSingle();

    const profile = (profileRaw ?? null) as ProfileRow | null;

    if (pErr) {
      logApiError("POST /api/order/set-choice profile failed", pErr, { rid, user_id, date });
      return jsonErr(rid, "Kunne ikke hente profil.", 500, {
        code: "PROFILE_LOOKUP_FAILED",
        detail: { detail: pErr.message, locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    if (!profile) {
      return jsonErr(rid, "Fant ikke profil.", 403, {
        code: "PROFILE_NOT_FOUND",
        detail: { locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    const company_id = profile.company_id;
    const location_id = profile.location_id;

    if (!company_id || !location_id) {
      return jsonErr(rid, "Profil mangler company_id/location_id.", 403, {
        code: "PROFILE_MISSING_SCOPE",
        detail: { locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    // 6) Company status gate
    const gate = await assertCompanyActiveOr403({
      supa: supa as any,
      companyId: company_id,
      rid,
    });
    if (gate.ok === false) return gate.res;

    // 7) Hent kontrakt fra companies
    const { data: companyRaw, error: cErr } = await (supa as any)
      .from("companies")
      .select("id, contract_week_tier, contract_basis_choices, contract_premium_choices")
      .eq("id", company_id)
      .single();

    const company = (companyRaw ?? null) as CompanyRow | null;

    if (cErr || !company) {
      logApiError("POST /api/order/set-choice company failed", cErr, { rid, company_id });
      return jsonErr(rid, "Fant ikke firma/kontrakt.", 403, {
        code: "COMPANY_CONTRACT_NOT_FOUND",
        detail: { locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    const weekTier = company.contract_week_tier;
    if (!weekTier) {
      return jsonErr(rid, "Kontrakt mangler contract_week_tier.", 400, {
        code: "CONTRACT_MISSING_WEEK_TIER",
        detail: { locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    const tier = weekTier[dayKey];
    if (!tier) {
      return jsonErr(rid, "Kontrakt mangler tier-plan for denne dagen.", 400, {
        code: "CONTRACT_MISSING_DAY_TIER",
        detail: { locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    // ✅ PREMIUM inkluderer BASIS (driftsikkert)
    const basis = Array.isArray(company.contract_basis_choices) ? company.contract_basis_choices : [];
    const premiumRaw = Array.isArray(company.contract_premium_choices) ? company.contract_premium_choices : [];
    const premium = mergeChoices(basis, premiumRaw);
    const allowed = tier === "BASIS" ? basis : premium;

    if (!Array.isArray(allowed) || allowed.length === 0) {
      return jsonErr(rid, "Kontrakt mangler menyvalg.", 400, {
        code: "CONTRACT_MISSING_CHOICES",
        detail: { locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    if (!allowed.some((x) => x?.key === choice_key)) {
      return jsonErr(rid, `Ugyldig valg for ${tier}-dag.`, 400, {
        code: "INVALID_CHOICE",
        detail: { locked: false, cutoffTime: cutoff.cutoffTime, canAct: false },
      });
    }

    // 7.1) ✅ Variant gate (server-fasit)
    if (requiresVariant(choice_key)) {
      const t = parseVariantTypeFromNote(note);
      const ck = String(choice_key).toLowerCase();
      if (!t || t !== ck) {
        const label = ck === "salatbar" ? "Salatbar" : "Påsmurt";
        return jsonErr(rid, `Velg variant for ${label}.`, 400, "MISSING_VARIANT");
      }
    }

    // 8) Upsert til day_choices (idempotent) + receipt
    const payload: DayChoiceUpsert = {
      company_id,
      location_id,
      user_id,
      date,
      choice_key,
      note,
      status: "ACTIVE",
    };

    const { data: savedRaw, error: uErr } = await (supa as any)
      .from("day_choices")
      .upsert(payload, { onConflict: "company_id,location_id,user_id,date" })
      .select("id, date, choice_key, note, status, updated_at")
      .single();

    const saved = (savedRaw ?? null) as DayChoiceSelect | null;

    if (uErr || !saved) {
      logApiError("POST /api/order/set-choice upsert failed", uErr, {
        rid,
        company_id,
        location_id,
        user_id,
        date,
        choice_key,
      });

      return jsonErr(rid, "Kunne ikke lagre valg.", 500, { code: "SAVE_FAILED", detail: uErr?.message });
    }

    return jsonOk(
      rid,
      {
        ok: true,
        rid,

        receipt: {
          orderId: saved.id,
          status: "ACTIVE",
          date: saved.date,
          updatedAt: saved.updated_at ?? null,
        },

        date: saved.date,
        choice_key: saved.choice_key,
        note: saved.note ?? null,
        tier,
        updated_at: saved.updated_at ?? null,
        locked: false,
        cutoffTime: cutoff.cutoffTime,
        canAct: true,
        scope: { company_id, location_id, user_id },
      },
      200
    );
  } catch (e: any) {
    logApiError("POST /api/order/set-choice failed", e, { rid });
    return jsonErr(rid, "Uventet feil.", 500, { code: "SERVER_ERROR", detail: String(e?.message ?? e) });
  }
}
