import "server-only";

/**
 * Canonical snapshot stored in page_versions.data (v1).
 * Rollback reapplies page row fields + body to the variant for (locale, environment) on the version row.
 */
export const PAGE_VERSION_DATA_SCHEMA = 1 as const;

export type PageVersionDataV1 = {
  schema: typeof PAGE_VERSION_DATA_SCHEMA;
  /** Soft diff hints (Norwegian labels), e.g. "Tittel", "CTA" */
  changedFields?: string[];
  page: {
    id: string;
    title: string;
    slug: string;
    status: string;
    published_at: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  };
  variant: {
    id: string | null;
    locale: string;
    environment: string;
  };
  body: unknown;
};

type SupabaseLike = {
  from: (t: string) => unknown;
  /** PostgREST-bygger er thenable; matcher `SupabaseClient.rpc` uten å kreve full `Promise`. */
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
};

export function parsePageVersionData(raw: unknown): PageVersionDataV1 | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.schema !== PAGE_VERSION_DATA_SCHEMA) return null;
  const page = o.page;
  if (!page || typeof page !== "object" || Array.isArray(page)) return null;
  const pr = page as Record<string, unknown>;
  const id = typeof pr.id === "string" ? pr.id.trim() : "";
  const title = typeof pr.title === "string" ? pr.title : "";
  const slug = typeof pr.slug === "string" ? pr.slug : "";
  const status = typeof pr.status === "string" ? pr.status : "";
  if (!id || (status !== "draft" && status !== "published")) return null;
  const published_at: string | null =
    pr.published_at === null ? null : typeof pr.published_at === "string" ? pr.published_at : null;

  const variant = o.variant;
  if (!variant || typeof variant !== "object" || Array.isArray(variant)) return null;
  const vr = variant as Record<string, unknown>;
  const loc = typeof vr.locale === "string" && vr.locale.trim() ? vr.locale.trim() : "";
  const env = typeof vr.environment === "string" && vr.environment.trim() ? vr.environment.trim() : "";
  if (!loc || !["prod", "staging", "preview"].includes(env)) return null;
  const variantId = vr.id === null ? null : typeof vr.id === "string" ? vr.id : null;

  if (o.body === undefined || o.body === null) return null;

  let changedFields: string[] | undefined;
  if (Array.isArray(o.changedFields)) {
    const cf = o.changedFields.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
    if (cf.length > 0) changedFields = cf;
  }

  return {
    schema: PAGE_VERSION_DATA_SCHEMA,
    ...(changedFields ? { changedFields } : {}),
    page: {
      id,
      title,
      slug,
      status,
      published_at,
      created_at:
        pr.created_at === null ? null : typeof pr.created_at === "string" ? pr.created_at : undefined,
      updated_at:
        pr.updated_at === null ? null : typeof pr.updated_at === "string" ? pr.updated_at : undefined,
    },
    variant: { id: variantId, locale: loc, environment: env },
    body: o.body,
  };
}

/** Compare stored snapshots for “matches live DB” (ignores changedFields). */
export function snapshotsContentEqual(a: PageVersionDataV1, b: PageVersionDataV1 | null): boolean {
  if (!b) return false;
  return (
    a.page.title === b.page.title &&
    a.page.slug === b.page.slug &&
    a.page.status === b.page.status &&
    a.page.published_at === b.page.published_at &&
    JSON.stringify(a.body) === JSON.stringify(b.body)
  );
}

export function extractChangedFieldsFromStoredData(data: unknown): string[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const o = data as Record<string, unknown>;
  if (!Array.isArray(o.changedFields)) return [];
  return o.changedFields
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim());
}

function normalizeRpcInsertRow(data: unknown): { id: string; version_number: number } | null {
  if (data == null) return null;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : null;
  const version_number = typeof r.version_number === "number" && Number.isFinite(r.version_number) ? r.version_number : null;
  if (!id || version_number == null) return null;
  return { id, version_number };
}

/**
 * Load current page + variant; build v1 snapshot. Fail-closed: returns null if page missing.
 * If variant row is missing, body defaults to empty blocks (still versionable).
 */
export async function fetchPageVersionSnapshot(
  supabase: SupabaseLike,
  pageId: string,
  locale: string,
  environment: string
): Promise<PageVersionDataV1 | null> {
  const { data: pageRow, error: pageErr } = await (supabase.from("content_pages") as any)
    .select("id, title, slug, status, created_at, updated_at, published_at")
    .eq("id", pageId)
    .maybeSingle();
  if (pageErr || !pageRow) return null;

  const { data: variantRow } = await (supabase.from("content_page_variants") as any)
    .select("id, body, locale, environment")
    .eq("page_id", pageId)
    .eq("locale", locale)
    .eq("environment", environment)
    .maybeSingle();

  const body = variantRow?.body ?? { version: 1, blocks: [] };

  return {
    schema: PAGE_VERSION_DATA_SCHEMA,
    page: {
      id: pageRow.id,
      title: pageRow.title ?? "",
      slug: pageRow.slug ?? "",
      status: pageRow.status ?? "draft",
      published_at: pageRow.published_at ?? null,
      created_at: pageRow.created_at ?? null,
      updated_at: pageRow.updated_at ?? null,
    },
    variant: {
      id: variantRow?.id ?? null,
      locale: variantRow?.locale ?? locale,
      environment: variantRow?.environment ?? environment,
    },
    body,
  };
}

export async function insertPageVersionRow(
  supabase: SupabaseLike,
  params: {
    pageId: string;
    locale: string;
    environment: string;
    data: PageVersionDataV1;
    createdBy: string | null;
    label?: string;
    action?: string;
  }
): Promise<{ id: string; version_number: number }> {
  const { data, error } = await supabase.rpc("lp_insert_page_version", {
    p_page_id: params.pageId,
    p_locale: params.locale,
    p_environment: params.environment,
    p_data: params.data,
    p_created_by: params.createdBy,
    p_label: params.label ?? "Manuell lagring",
    p_action: params.action ?? "save",
  });
  if (error) {
    throw new Error(error.message ?? "lp_insert_page_version failed");
  }
  const row = normalizeRpcInsertRow(data);
  if (!row) {
    throw new Error("lp_insert_page_version returned no row");
  }
  return row;
}

export async function recordPageContentVersion(
  supabase: SupabaseLike,
  params: {
    pageId: string;
    locale: string;
    environment: string;
    createdBy: string | null;
    label?: string;
    action?: string;
    changedFields?: string[];
  }
): Promise<{ id: string; version_number: number }> {
  const snapshot = await fetchPageVersionSnapshot(supabase, params.pageId, params.locale, params.environment);
  if (!snapshot) {
    throw new Error("recordPageContentVersion: page not found");
  }
  const data: PageVersionDataV1 = {
    ...snapshot,
    ...(params.changedFields && params.changedFields.length > 0 ? { changedFields: params.changedFields } : {}),
  };
  return insertPageVersionRow(supabase, {
    pageId: params.pageId,
    locale: params.locale,
    environment: params.environment,
    data,
    createdBy: params.createdBy,
    label: params.label ?? "Manuell lagring",
    action: params.action ?? "save",
  });
}

export async function listPageVersions(
  supabase: SupabaseLike,
  pageId: string,
  filters?: { locale?: string | null; environment?: string | null }
): Promise<
  Array<{
    id: string;
    page_id: string;
    locale: string;
    environment: string;
    version_number: number;
    created_at: string;
    created_by: string | null;
    label: string;
    action: string;
    data: unknown;
  }>
> {
  let q = (supabase.from("page_versions") as any)
    .select("id, page_id, locale, environment, version_number, created_at, created_by, label, action, data")
    .eq("page_id", pageId);
  if (filters?.locale) {
    q = q.eq("locale", filters.locale);
  }
  if (filters?.environment) {
    q = q.eq("environment", filters.environment);
  }
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message ?? "listPageVersions failed");
  return Array.isArray(data) ? data : [];
}

export async function getPageVersionById(
  supabase: SupabaseLike,
  versionId: string
): Promise<{
  id: string;
  page_id: string;
  locale: string;
  environment: string;
  version_number: number;
  data: unknown;
  created_at: string;
  created_by: string | null;
  label: string;
  action: string;
} | null> {
  const { data, error } = await (supabase.from("page_versions") as any)
    .select("id, page_id, locale, environment, version_number, data, created_at, created_by, label, action")
    .eq("id", versionId)
    .maybeSingle();
  if (error) throw new Error(error.message ?? "getPageVersionById failed");
  return data ?? null;
}

export async function applyPageVersionDataToDb(
  supabase: SupabaseLike,
  params: { pageId: string; locale: string; environment: string; data: PageVersionDataV1; nowIso: string }
): Promise<void> {
  const { pageId, locale, environment, data, nowIso } = params;
  if (data.page.id !== pageId) {
    throw new Error("applyPageVersionDataToDb: page id mismatch");
  }

  const { error: pageErr } = await (supabase.from("content_pages") as any)
    .update({
      title: data.page.title,
      slug: data.page.slug,
      status: data.page.status,
      published_at: data.page.published_at,
      updated_at: nowIso,
    })
    .eq("id", pageId);
  if (pageErr) {
    if (pageErr.code === "23505") {
      const e = new Error("slug_conflict") as Error & { code: string };
      e.code = "23505";
      throw e;
    }
    throw new Error(pageErr.message ?? "update content_pages failed");
  }

  const { data: existingVariant } = await (supabase.from("content_page_variants") as any)
    .select("id")
    .eq("page_id", pageId)
    .eq("locale", locale)
    .eq("environment", environment)
    .maybeSingle();

  if (existingVariant?.id) {
    const { error: vErr } = await (supabase.from("content_page_variants") as any)
      .update({ body: data.body, updated_at: nowIso })
      .eq("id", existingVariant.id);
    if (vErr) throw new Error(vErr.message ?? "update variant failed");
  } else {
    const { error: insErr } = await (supabase.from("content_page_variants") as any).insert({
      page_id: pageId,
      locale,
      environment,
      body: data.body,
      updated_at: nowIso,
    });
    if (insErr) throw new Error(insErr.message ?? "insert variant failed");
  }
}
