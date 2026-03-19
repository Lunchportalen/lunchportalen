// lib/sanity/client.ts
import "server-only";

import { createClient } from "@sanity/client";
import { getSanityReadConfig, getSanityWriteToken } from "@/lib/config/env";

const { projectId, dataset, apiVersion } = getSanityReadConfig();

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});

export const sanityWrite = (() => {
  const writeToken = getSanityWriteToken();
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

