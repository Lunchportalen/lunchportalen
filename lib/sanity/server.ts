import "server-only";

import { createClient, type SanityClient } from "@sanity/client";
import { getSanityReadConfig, getSanityWriteToken } from "@/lib/config/env";

let serverClient: SanityClient | null = null;

function getSanityServerClient(): SanityClient {
  if (!serverClient) {
    const { projectId, dataset, apiVersion } = getSanityReadConfig();
    const token = getSanityWriteToken() ?? undefined;
    serverClient = createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: false,
      token,
    });
  }
  return serverClient;
}

/** Lazy server client — no top-level env read (build-safe). */
export const sanityServer: SanityClient = new Proxy({} as SanityClient, {
  get(_target, prop, receiver) {
    const client = getSanityServerClient();
    const value = Reflect.get(client as unknown as object, prop, receiver);
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
