/**
 * Read-only: rapport for lunchCategory (STEG 1 / verifisering).
 * npm exec tsx scripts/sanity/report-lunch-categories.ts
 */
import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const projectId =
  String(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? process.env.SANITY_PROJECT_ID ?? "").trim() ||
  "f3vuhd2f";
const dataset =
  String(process.env.NEXT_PUBLIC_SANITY_DATASET ?? process.env.SANITY_DATASET ?? "").trim() ||
  "production";

const client = createClient({
  projectId,
  dataset,
  apiVersion: "2024-01-01",
  useCdn: true,
});

const q = `*[_type == "lunchCategory" && isActive == true] | order(displayOrder asc) {
  "key": key.current,
  title,
  allowedPlanTiers,
  items[] {
    "key": slug.current,
    title,
    description,
    allowedPlanTiers
  }
}`;

const rows = await client.fetch(q);
console.log(JSON.stringify(rows, null, 2));
