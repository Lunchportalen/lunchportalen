// lib/sanity/client.ts
import { createClient } from "@sanity/client";

/* =========================================================
   ENV
========================================================= */
const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01";

// 🔒 Server-only write token (ALDRI eksponeres i client)
const writeToken = process.env.SANITY_WRITE_TOKEN;

if (!projectId) {
  throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID");
}

if (!dataset) {
  throw new Error("Missing NEXT_PUBLIC_SANITY_DATASET");
}

/* =========================================================
   READ CLIENT
   - Brukes i server components + client components
   - CDN = rask og stabil
   - Ingen token
========================================================= */
export const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});

/* =========================================================
   WRITE CLIENT (SERVER ONLY)
   - Brukes av cron, godkjenning, publisering, patch
   - IKKE importer i client components
   - IKKE CDN
========================================================= */
export const sanityWrite = (() => {
  if (!writeToken) {
    // ⚠️ Ikke krasj appen – men gjør feilen ekstremt tydelig
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[sanityWrite] SANITY_WRITE_TOKEN mangler. Skriveoperasjoner vil feile."
      );
    }
    return null;
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    token: writeToken,
    useCdn: false, // 🔴 ALDRI CDN ved write
  });
})();

/* =========================================================
   TYPE GUARD / ASSERT
   - Brukes der write er kritisk (cron, admin actions)
========================================================= */
export function requireSanityWrite() {
  if (!sanityWrite) {
    throw new Error(
      "SANITY_WRITE_TOKEN mangler – skriveoperasjon kan ikke utføres"
    );
  }
  return sanityWrite;
}
