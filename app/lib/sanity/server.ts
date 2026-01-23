import { createClient } from "@sanity/client";

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!;
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET!;
const apiVersion = process.env.NEXT_PUBLIC_SANITY_API_VERSION || "2024-01-01";

const token = process.env.SANITY_WRITE_TOKEN;

export const sanityServer = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false,
  token,
});
