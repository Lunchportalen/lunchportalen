/**
 * Write-capable Sanity clients — delegate to lib/sanity (no logic changes).
 */
import "server-only";

export { requireSanityWrite, sanityWrite } from "@/lib/sanity/client";
export { sanityServer } from "@/lib/sanity/server";
