import { createClient } from "@sanity/client";
import { getSanityReadConfig, getSanityWriteToken } from "@/lib/config/env";

const { projectId, dataset, apiVersion } = getSanityReadConfig();
const token = getSanityWriteToken() ?? undefined;

export const sanityServer = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token,
});

