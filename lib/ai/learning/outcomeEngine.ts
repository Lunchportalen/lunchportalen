export function extractOutcome(data: Record<string, unknown> | undefined | null) {
  const d = data ?? {};
  return {
    conversion: Number(d.conversion ?? 0),
    revenue: Number(d.revenue ?? 0),
    success: Boolean(d.success ?? false),
  };
}
