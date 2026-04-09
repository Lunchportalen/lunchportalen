import "server-only";

import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";

const POST_ID_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;
const ROUTE = "upsert_lead_social";

function normEmail(v: string | null | undefined): string | null {
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (!s || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

function safePostId(v: string | null | undefined): string | null {
  const s = String(v ?? "").trim();
  return POST_ID_RE.test(s) ? s : null;
}

/** Når kontaktskjema mangler SoMe-post: unik, ikke-null `source_post_id` (ingen FK til social_posts i basemigrering). */
function syntheticKontaktSourceId(rid: string): string {
  const raw = String(rid ?? "").trim();
  const s = raw.replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 100);
  const base = s || "anon";
  const out = `kontakt:${base}`;
  return out.length <= 128 ? out : out.slice(0, 128);
}

export type UpsertLeadFromSocialInput = {
  postId: string | null | undefined;
  company: string | null | undefined;
  email: string | null | undefined;
  /** Valgfri A/B-variant (fra lp_growth_ab_v1) — sporbarhet i funnel. */
  abVariantId?: string | null | undefined;
};

type CoreInput = {
  email: string;
  companyName: string;
  /** Ny rad: alltid satt (SoMe-post-id eller syntetisk kontakt-id). */
  sourcePostId: string;
  /** Oppdater `social_posts.lead_id` kun når satt (gyldig SoMe-id). */
  linkPostId: string | null;
  abVariantId?: string | null;
  metaSource: "social" | "contact";
};

async function upsertLeadPipelineCore(input: CoreInput): Promise<{ id: string }> {
  const { email, companyName, sourcePostId, linkPostId, abVariantId, metaSource } = input;

  const admin = supabaseAdmin();
  const lpOk = await verifyTable(admin, "lead_pipeline", ROUTE);
  const spOk = await verifyTable(admin, "social_posts", ROUTE);
  if (!lpOk) {
    const msg = "lead_pipeline: tabell utilgjengelig eller ikke verifisert";
    console.error("[LEAD_PIPELINE_UNAVAILABLE]", msg);
    throw new Error(msg);
  }

  const { data: existing, error: exErr } = await admin
    .from("lead_pipeline")
    .select("id")
    .eq("contact_email", email)
    .maybeSingle();

  if (exErr) {
    console.error("[LEAD_SELECT_ERROR]", exErr);
    throw new Error(exErr.message);
  }

  if (existing && typeof existing === "object" && "id" in existing && typeof (existing as { id: unknown }).id === "string") {
    const leadId = (existing as { id: string }).id;
    if (linkPostId && spOk) {
      const { error: linkErr } = await admin.from("social_posts").update({ lead_id: leadId }).eq("id", linkPostId);
      if (linkErr) console.error("[upsertLeadFromSocial] link existing", linkErr.message);
    }
    console.log("[LEAD_CREATED]", { id: leadId, postId: linkPostId, reused: true });
    return { id: leadId };
  }

  const insertPayload = {
    source_post_id: sourcePostId,
    status: "new" as const,
    contact_email: email,
    meta: {
      company_name: companyName,
      pipeline_stage: "lead",
      probability: 0.1,
      source: metaSource,
      ...(typeof abVariantId === "string" && abVariantId.trim()
        ? { ab_variant_id: abVariantId.trim() }
        : {}),
    },
  };

  const { data, error } = await admin.from("lead_pipeline").insert(insertPayload).select("id");

  if (error) {
    if (error.code === "23505") {
      const { data: retry, error: rErr } = await admin.from("lead_pipeline").select("id").eq("contact_email", email).maybeSingle();
      if (rErr) {
        console.error("[LEAD_INSERT_ERROR]", rErr);
        throw new Error(rErr.message);
      }
      if (!retry || typeof retry !== "object" || typeof (retry as { id?: unknown }).id !== "string") {
        console.error("[LEAD_INSERT_EMPTY]", "race after duplicate key");
        throw new Error("Lead insert returned empty after duplicate key");
      }
      const leadId = (retry as { id: string }).id;
      if (linkPostId && spOk) {
        const { error: linkErr } = await admin.from("social_posts").update({ lead_id: leadId }).eq("id", linkPostId);
        if (linkErr) console.error("[upsertLeadFromSocial] link after race", linkErr.message);
      }
      console.log("[LEAD_CREATED]", { id: leadId, postId: linkPostId, reusedAfterRace: true });
      return { id: leadId };
    }
    console.error("[LEAD_INSERT_ERROR]", error);
    throw new Error(error.message);
  }

  if (!data || data.length === 0) {
    console.error("[LEAD_INSERT_EMPTY]");
    throw new Error("Lead insert returned empty");
  }

  const lead = data[0] as { id?: unknown };
  if (!lead || typeof lead.id !== "string") {
    console.error("[LEAD_INSERT_EMPTY]");
    throw new Error("Lead insert returned empty");
  }

  const newId = lead.id;
  console.log("[LEAD_CREATED]", lead);

  if (linkPostId && spOk) {
    const { error: linkErr } = await admin.from("social_posts").update({ lead_id: newId }).eq("id", linkPostId);
    if (linkErr) console.error("[upsertLeadFromSocial] link new", linkErr.message);
  }

  return { id: newId };
}

/**
 * Finnes lead på e-post → returner den (idempotent). Ellers opprett ny rad og koble `social_posts.lead_id`.
 * Fail-safe: mangler postId eller e-post → null. DB-feil → kaster (synlig i logger / catch hos kaller).
 */
export async function upsertLead(input: UpsertLeadFromSocialInput): Promise<{ id: string } | null> {
  const postId = safePostId(input.postId);
  const email = normEmail(input.email);
  if (!postId || !email) return null;

  const companyName = String(input.company ?? "").trim() || "Ukjent";
  return upsertLeadPipelineCore({
    email,
    companyName,
    sourcePostId: postId,
    linkPostId: postId,
    abVariantId: input.abVariantId,
    metaSource: "social",
  });
}

/**
 * Kontaktskjema: alltid forsøk lead når e-post er gyldig.
 * Med `postId`: samme sporbarhet som SoMe (kobler `social_posts.lead_id`).
 * Uten `postId`: ny rad med `source_post_id = kontakt:<rid>` (ingen SoMe-lenke).
 */
export async function upsertLeadFromContactForm(input: {
  email: string | null | undefined;
  company: string | null | undefined;
  postId?: string | null | undefined;
  post_id?: string | null | undefined;
  rid: string;
  abVariantId?: string | null | undefined;
}): Promise<{ id: string } | null> {
  const email = normEmail(input.email);
  if (!email) return null;

  const rawPost = safePostId(input.postId) ?? safePostId(input.post_id);
  const companyName = String(input.company ?? "").trim() || "Ukjent";
  const sourcePostId = rawPost ?? syntheticKontaktSourceId(input.rid);

  return upsertLeadPipelineCore({
    email,
    companyName,
    sourcePostId,
    linkPostId: rawPost,
    abVariantId: input.abVariantId,
    metaSource: "contact",
  });
}

/** Alias — samme som {@link upsertLead}. */
export const upsertLeadFromSocial = upsertLead;
