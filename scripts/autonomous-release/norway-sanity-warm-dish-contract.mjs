/**
 * Norway warm-dish Sanity contract helpers for production E2E.
 * Pure query/evaluation logic — no secrets printed.
 */

export const NORWAY_SANITY_PROJECT_ID = "4udoq5d8";
export const NORWAY_SANITY_DATASET = "production";
export const NORWAY_SANITY_API_VERSION = "2021-10-21";
export const NORWAY_SANITY_PERSPECTIVE = "published";
export const MELHUS_PROVIDER_REF = "11111111-1111-1111-1111-111111111111";
export const VARMRETT_TIERS = ["BASIS", "LUXUS", "ENTERPRISE"];
export const MENU_DAY_TYPE = "menuDay";
export const VARMRETT_CATEGORY = "varmrett";

/** Sanitize env project id; never accept empty/quoted garbage as authoritative. */
export function resolveSanityProjectId(envProjectId) {
  const raw = String(envProjectId || "")
    .trim()
    .replace(/^["']|["']$/g, "");
  if (/^[a-z0-9]{6,12}$/i.test(raw)) return raw.toLowerCase();
  return NORWAY_SANITY_PROJECT_ID;
}

export function menuDayDocId(date, tier) {
  return `menuDay-${date}-${String(tier).toUpperCase()}-${VARMRETT_CATEGORY}`;
}

/** Canonical dish identity for a provider/day (Melhus id scheme without provider segment). */
export function canonicalWarmDishKey(date) {
  return `menuDay-${date}-${VARMRETT_CATEGORY}`;
}

/**
 * Inline GROQ (no $params) — avoids CI query-string param binding failures
 * that return HTTP 200 with result=[].
 */
export function buildInlineWarmDishQuery(fromDate, providerRef = MELHUS_PROVIDER_REF) {
  const from = String(fromDate).slice(0, 10);
  const provider = String(providerRef);
  return (
    `*[_type=="${MENU_DAY_TYPE}" && category=="${VARMRETT_CATEGORY}"` +
    ` && date>="${from}" && provider._ref=="${provider}"]` +
    `{_id,_rev,date,planTier,mealTitle,description,allergens,"providerId":provider._ref,"draft":_id in path("drafts.**")}` +
    ` | order(date asc)`
  );
}

/**
 * @param {{
 *   projectId?: string,
 *   dataset?: string,
 *   apiVersion?: string,
 *   perspective?: string,
 *   fromDate: string,
 *   providerRef?: string,
 *   host?: string,
 * }} [opts]
 */
export function buildWarmDishQueryUrl({
  projectId = NORWAY_SANITY_PROJECT_ID,
  dataset = NORWAY_SANITY_DATASET,
  apiVersion = NORWAY_SANITY_API_VERSION,
  perspective = NORWAY_SANITY_PERSPECTIVE,
  fromDate = "",
  providerRef = MELHUS_PROVIDER_REF,
  host = "api",
} = {}) {
  const query = buildInlineWarmDishQuery(fromDate, providerRef);
  const base = `https://${projectId}.${host}.sanity.io/v${apiVersion}/data/query/${dataset}`;
  return `${base}?perspective=${encodeURIComponent(perspective)}&query=${encodeURIComponent(query)}`;
}

/**
 * Evaluate published warm-dish bank for one common canonical dish per day
 * across BASIS/LUXUS/ENTERPRISE using document IDs first, title as display only.
 */
export function evaluateWarmDishCanonical(rows, providerRef = MELHUS_PROVIDER_REF) {
  const byDate = new Map();
  let draftLeaks = 0;
  let wrongProvider = 0;
  let placeholder = 0;

  for (const r of rows || []) {
    const d = String(r.date || "").slice(0, 10);
    if (!d) continue;
    if (r.draft === true || String(r._id || "").startsWith("drafts.")) draftLeaks += 1;
    if (String(r.providerId || "") !== providerRef) wrongProvider += 1;
    if (/TODO|placeholder|lorem|FIXME/i.test(String(r.mealTitle || r.description || ""))) {
      placeholder += 1;
    }
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  }

  let duplicateWarm = 0;
  const sampleDates = [];

  for (const [date, list] of byDate) {
    const byTier = new Map();
    for (const row of list) {
      const tier = String(row.planTier || "").toUpperCase();
      if (!VARMRETT_TIERS.includes(tier)) continue;
      if (!byTier.has(tier)) byTier.set(tier, []);
      byTier.get(tier).push(row);
    }

    // Duplicate active published warm dishes = >1 doc per tier/day
    for (const tier of VARMRETT_TIERS) {
      const docs = byTier.get(tier) || [];
      if (docs.length > 1) duplicateWarm += 1;
    }

    const expectedIds = VARMRETT_TIERS.map((t) => menuDayDocId(date, t));
    const found = expectedIds.map((id) => list.find((x) => x._id === id) || null);
    const allPresent = found.every(Boolean);
    const canonicalKey = canonicalWarmDishKey(date);
    const titles = new Set(found.filter(Boolean).map((x) => String(x.mealTitle || "").trim()));
    const revs = found.filter(Boolean).map((x) => String(x._rev || ""));
    const norwegianTitle = [...titles][0] || null;
    const titleOk = Boolean(norwegianTitle) && !/TODO|placeholder|lorem|FIXME/i.test(norwegianTitle);

    if (allPresent && titles.size === 1 && titleOk) {
      sampleDates.push({
        date,
        canonicalKey,
        title: norwegianTitle,
        ids: expectedIds,
        revs,
        tiers: [...VARMRETT_TIERS],
        identity: "sanity_document_id",
      });
    } else if (allPresent && titles.size > 1) {
      duplicateWarm += 1;
    }
  }

  return {
    rowCount: Array.isArray(rows) ? rows.length : 0,
    duplicateWarm,
    wrongProvider,
    placeholder,
    draftLeaks,
    sampleDates,
    commonOk:
      sampleDates.length > 0 && duplicateWarm === 0 && wrongProvider === 0 && draftLeaks === 0 && placeholder === 0,
  };
}

/**
 * Trace Supabase published menu_service_days to Sanity menuDay document IDs.
 * orphan = mirror date with no published Sanity warm-dish docs for Melhus
 * stale = mirror Varmrett product snapshot title disagrees with Sanity mealTitle
 */
export function evaluateMirrorTraceability({
  mirrorDates = [],
  sanityRows = [],
  varmrettSnapshotsByDate = {},
  providerRef = MELHUS_PROVIDER_REF,
} = {}) {
  const byDate = new Map();
  for (const r of sanityRows || []) {
    if (String(r.providerId || "") !== providerRef) continue;
    const d = String(r.date || "").slice(0, 10);
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(r);
  }

  let orphaned = 0;
  let stale = 0;
  let wrongProvider = 0;
  let wrongDate = 0;
  const details = [];

  for (const m of mirrorDates) {
    const date = String(m.service_date || m.date || "").slice(0, 10);
    if (!date) continue;
    if (m.provider_id && String(m.provider_id) !== providerRef) {
      wrongProvider += 1;
      continue;
    }
    const docs = byDate.get(date) || [];
    const expectedIds = VARMRETT_TIERS.map((t) => menuDayDocId(date, t));
    const present = expectedIds.filter((id) => docs.some((d) => d._id === id));
    if (present.length === 0) {
      orphaned += 1;
      details.push({ date, kind: "ORPHANED_MENU_MIRROR" });
      continue;
    }
    if (present.length !== expectedIds.length) {
      stale += 1;
      details.push({ date, kind: "INCOMPLETE_TIER_MIRROR", present });
    }
    const sanityTitle = String(docs.find((d) => d._id === menuDayDocId(date, "BASIS"))?.mealTitle || "").trim();
    const snapTitle = String(varmrettSnapshotsByDate[date] || "").trim();
    if (snapTitle && sanityTitle && snapTitle !== sanityTitle) {
      stale += 1;
      details.push({ date, kind: "STALE_TITLE_MIRROR", snapTitle, sanityTitle });
    }
    // Date mismatch: sanity doc date field must equal mirror service_date
    for (const doc of docs) {
      if (String(doc.date || "").slice(0, 10) !== date) wrongDate += 1;
    }
  }

  return {
    ORPHANED_MENU_MIRRORS: orphaned,
    STALE_MENU_MIRRORS: stale,
    WRONG_PROVIDER_MIRRORS: wrongProvider,
    WRONG_DATE_MIRRORS: wrongDate,
    details: details.slice(0, 20),
    ok: orphaned === 0 && stale === 0 && wrongProvider === 0 && wrongDate === 0,
  };
}
