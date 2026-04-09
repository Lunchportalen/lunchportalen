import "server-only";

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

export function resolveCronBaseUrl(): string {
  const site = safeTrim(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/$/, "");
  const baseUrl = safeTrim(process.env.NEXT_PUBLIC_BASE_URL).replace(/\/$/, "");
  const vercel = safeTrim(process.env.VERCEL_URL).replace(/^https?:\/\//, "");
  if (site) return site;
  if (baseUrl) return baseUrl;
  if (vercel) return `https://${vercel}`;
  return "";
}
