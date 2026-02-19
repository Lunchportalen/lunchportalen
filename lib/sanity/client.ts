// lib/sanity/client.ts
import "server-only";

import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01";
const writeToken = process.env.SANITY_WRITE_TOKEN;

if (!projectId) {
  throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID");
}

if (!dataset) {
  throw new Error("Missing NEXT_PUBLIC_SANITY_DATASET");
}

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});

export const sanityWrite = (() => {
  if (!writeToken) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[sanityWrite] SANITY_WRITE_TOKEN missing. Write operations will fail.");
    }
    return null;
  }

  return createClient({
    projectId,
    dataset,
    apiVersion,
    token: writeToken,
    useCdn: false,
  });
})();

export function requireSanityWrite() {
  if (!sanityWrite) {
    throw new Error("SANITY_WRITE_TOKEN missing - write operation blocked");
  }
  return sanityWrite;
}
