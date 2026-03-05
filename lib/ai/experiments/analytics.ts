/**
 * Experiment analytics: record views/clicks/conversions and get stats.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function recordView(supabase: any, experimentId: string, variant: string): Promise<void> {
  const table = supabase.from("experiment_results");
  const { data: row } = await table.select("views").eq("experiment_id", experimentId).eq("variant", variant).maybeSingle();
  if (row && typeof row.views === "number") {
    await table.update({ views: row.views + 1 }).eq("experiment_id", experimentId).eq("variant", variant);
  } else {
    await table.upsert(
      { experiment_id: experimentId, variant, views: 1, clicks: 0, conversions: 0 },
      { onConflict: "experiment_id,variant" }
    );
  }
}

export async function recordClick(supabase: any, experimentId: string, variant: string): Promise<void> {
  const table = supabase.from("experiment_results");
  const { data: row } = await table.select("clicks").eq("experiment_id", experimentId).eq("variant", variant).maybeSingle();
  if (row && typeof row.clicks === "number") {
    await table.update({ clicks: row.clicks + 1 }).eq("experiment_id", experimentId).eq("variant", variant);
  } else {
    await table.upsert(
      { experiment_id: experimentId, variant, views: 0, clicks: 1, conversions: 0 },
      { onConflict: "experiment_id,variant" }
    );
  }
}

export async function recordConversion(supabase: any, experimentId: string, variant: string): Promise<void> {
  const table = supabase.from("experiment_results");
  const { data: row } = await table.select("conversions").eq("experiment_id", experimentId).eq("variant", variant).maybeSingle();
  if (row && typeof row.conversions === "number") {
    await table.update({ conversions: row.conversions + 1 }).eq("experiment_id", experimentId).eq("variant", variant);
  } else {
    await table.upsert(
      { experiment_id: experimentId, variant, views: 0, clicks: 0, conversions: 1 },
      { onConflict: "experiment_id,variant" }
    );
  }
}

export type ExperimentVariantStats = {
  variant: string;
  views: number;
  clicks: number;
  conversions: number;
};

export async function getExperimentStats(supabase: any, experimentId: string): Promise<{
  views: number;
  clicks: number;
  conversions: number;
  variants: string[];
  byVariant: ExperimentVariantStats[];
}> {
  const { data: rows } = await supabase.from("experiment_results").select("variant, views, clicks, conversions").eq("experiment_id", experimentId);
  const list = Array.isArray(rows) ? rows : [];
  let views = 0, clicks = 0, conversions = 0;
  const variants: string[] = [];
  const byVariant: ExperimentVariantStats[] = [];
  for (const r of list) {
    if (typeof r.variant === "string") variants.push(r.variant);
    const v = typeof r.views === "number" ? r.views : 0;
    const c = typeof r.clicks === "number" ? r.clicks : 0;
    const conv = typeof r.conversions === "number" ? r.conversions : 0;
    views += v;
    clicks += c;
    conversions += conv;
    byVariant.push({ variant: String(r.variant ?? ""), views: v, clicks: c, conversions: conv });
  }
  return { views, clicks, conversions, variants, byVariant };
}
