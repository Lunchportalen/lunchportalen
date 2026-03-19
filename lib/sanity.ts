import { createClient } from "@sanity/client";
import { getSanityReadConfig } from "@/lib/config/env";

const { projectId, dataset, apiVersion } = getSanityReadConfig();

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});

