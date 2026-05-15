import "dotenv/config";

import { createClient } from "@sanity/client";

const API_VERSION = "2024-01-01";

const MENU_DAY_ID = "menuDay-2026-05-18-BASIS-varmrett";

type MealPick = {
  _id: string;
  title?: string | null;
  allergens?: string[] | null;
  description?: string | null;
};

function safeEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

function arrayOrEmpty(value: unknown): string[] {
  return Array.isArray(value) ? value.map((x) => String(x)).filter(Boolean) : [];
}

async function main() {
  const tokenRaw =
    process.env.SANITY_WRITE_TOKEN ??
    process.env.SANITY_TOKEN ??
    process.env.SANITY_API_TOKEN;

  if (!tokenRaw || !tokenRaw.trim()) {
    console.error("FAIL: Sanity write-token mangler i env.");
    console.error("Set SANITY_WRITE_TOKEN, SANITY_TOKEN eller SANITY_API_TOKEN.");
    process.exit(1);
  }

  const token = tokenRaw.trim();

  const projectId =
    safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") || safeEnv("SANITY_PROJECT_ID") || "4udoq5d8";
  const dataset =
    safeEnv("NEXT_PUBLIC_SANITY_DATASET") || safeEnv("SANITY_DATASET") || "production";

  const client = createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
  });

  const meal = await client.fetch<MealPick | null>(
    `*[_type == "mealIdea" && costTier in ["BUDGET","STANDARD"] && isActive == true][0]{_id, title, allergens, description}`,
  );

  if (!meal?._id) {
    console.error("FAIL: Fant ingen aktiv mealIdea med costTier BUDGET eller STANDARD.");
    process.exit(1);
  }

  const nowISO = new Date().toISOString();

  const doc = {
    _id: MENU_DAY_ID,
    _type: "menuDay" as const,
    date: "2026-05-18",
    planTier: "BASIS" as const,
    category: "varmrett" as const,
    mealRef: { _type: "reference" as const, _ref: meal._id },
    mealTitle: String(meal.title ?? "").trim() || "Uten tittel",
    description: meal.description != null ? String(meal.description) : "",
    allergens: arrayOrEmpty(meal.allergens),
    customerVisible: true,
    approvedForPublish: true,
    customerVisibleSetAt: nowISO,
    approvedAt: nowISO,
  };

  await client.createOrReplace(doc);

  console.log(
    `OK: createOrReplace ${MENU_DAY_ID} (mealRef=${meal._id}, project=${projectId}/${dataset})`,
  );
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
