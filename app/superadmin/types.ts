export type SuperadminStats = {
  companiesTotal: number | null;
  companiesPending: number | null;
  companiesActive: number | null;
  companiesPaused: number | null;
  companiesClosed: number | null;
  updatedAt: string | null;
};

export function nullSuperadminStats(): SuperadminStats {
  return {
    companiesTotal: null,
    companiesPending: null,
    companiesActive: null,
    companiesPaused: null,
    companiesClosed: null,
    updatedAt: null,
  };
}

export function normalizeSuperadminStats(input: Partial<SuperadminStats> | null | undefined): SuperadminStats {
  const stats = input ?? {};
  const toNum = (v: any) => {
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  return {
    companiesTotal: toNum(stats.companiesTotal),
    companiesPending: toNum(stats.companiesPending),
    companiesActive: toNum(stats.companiesActive),
    companiesPaused: toNum(stats.companiesPaused),
    companiesClosed: toNum(stats.companiesClosed),
    updatedAt: typeof stats.updatedAt === "string" && stats.updatedAt.trim().length ? stats.updatedAt : null,
  };
}
