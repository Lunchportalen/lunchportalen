// /studio/sanity.config.ts
import { defineConfig } from "sanity";
import { deskTool } from "sanity/desk";
import { structure } from "./deskStructure";
import { schemaTypes } from "./schemaTypes";

const projectId =
  process.env.SANITY_STUDIO_PROJECT_ID ||
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID;

const dataset =
  process.env.SANITY_STUDIO_DATASET ||
  process.env.NEXT_PUBLIC_SANITY_DATASET ||
  "production";

if (!projectId) {
  throw new Error(
    "Missing Sanity projectId. Set SANITY_STUDIO_PROJECT_ID (recommended) or NEXT_PUBLIC_SANITY_PROJECT_ID."
  );
}

export default defineConfig({
  name: "default",
  title: "Lunchportalen",

  projectId,
  dataset,

  plugins: [deskTool({ structure })],

  schema: {
    types: schemaTypes,
  },
});
