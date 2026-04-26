// lib/sanity/client.ts
import "server-only";

import { createClient, type SanityClient } from "@sanity/client";
import { getSanityReadConfig, getSanityWriteToken } from "@/lib/config/env";

let readClient: SanityClient | null = null;

function getSanityReadClient(): SanityClient {
  if (!readClient) {
    const { projectId, dataset, apiVersion } = getSanityReadConfig();

    readClient = createClient({
      projectId,
      dataset,
      apiVersion,
      useCdn: true,
      perspective: "published",
    });
  }

  return readClient;
}

export const sanity: SanityClient = new Proxy({} as SanityClient, {
  get(_target, prop, receiver) {
    const client = getSanityReadClient();
    const value = Reflect.get(client as unknown as object, prop, receiver);

    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }

    return value;
  },
});

let writeClient: SanityClient | null | undefined = undefined;

function resolveSanityWrite(): SanityClient | null {
  if (writeClient !== undefined) return writeClient;

  const writeToken = getSanityWriteToken();

  if (!writeToken) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[sanityWrite] SANITY_WRITE_TOKEN missing. Write operations will fail.");
    }

    writeClient = null;
    return null;
  }

  const { projectId, dataset, apiVersion } = getSanityReadConfig();

  writeClient = createClient({
    projectId,
    dataset,
    apiVersion,
    token: writeToken,
    useCdn: false,
    perspective: "published",
  });

  return writeClient;
}

export function requireSanityWrite(): SanityClient {
  const client = resolveSanityWrite();

  if (!client) {
    throw new Error("SANITY_WRITE_TOKEN missing - write operation blocked");
  }

  return client;
}

export function getSanityWriteClient(): SanityClient | null {
  return resolveSanityWrite();
}