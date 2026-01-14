import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01";

if (!projectId) throw new Error("Missing NEXT_PUBLIC_SANITY_PROJECT_ID");
if (!dataset) throw new Error("Missing NEXT_PUBLIC_SANITY_DATASET");

export const sanity = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
});
