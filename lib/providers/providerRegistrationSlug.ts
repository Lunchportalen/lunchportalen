// lib/providers/providerRegistrationSlug.ts
/** Deterministic provider slug from a company name (RPC re-checks uniqueness). */
export function providerSlugFromName(name: string): string {
  const base = String(name ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "o")
    .replace(/å/g, "a")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "provider";
}

/** Add a short deterministic suffix to avoid collisions on retry. */
export function providerSlugWithSuffix(name: string, suffix: string): string {
  const s = String(suffix ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 6);
  const base = providerSlugFromName(name);
  return s ? `${base}-${s}` : base;
}
