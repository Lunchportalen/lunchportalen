/**
 * FASE 13-IMPL-3R — Re-seed lunchCategory (idempotent createOrReplace).
 * Krever SANITY_WRITE_TOKEN (eller SANITY_TOKEN / SANITY_API_TOKEN).
 *
 * npm run sanity:seed-lunch-categories-v2
 * npm run sanity:seed-lunch-categories-v2 -- --dry-run
 */
import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

import { requireSanityProjectIdFromEnv } from "./sanityProjectEnv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";

type Slug = { _type: "slug"; current: string };

const T_ALL = ["BASIS", "LUXUS", "ENTERPRISE"] as const;
const T_LUX = ["LUXUS", "ENTERPRISE"] as const;

type PlanTierSlug = (typeof T_ALL)[number];

type CategoryItem = {
  _key: string;
  slug: Slug;
  title: string;
  description?: string;
  allergens?: string[];
  isVegetarian?: boolean;
  allowedPlanTiers: PlanTierSlug[];
};

type LunchCategoryDoc = {
  _id: string;
  _type: "lunchCategory";
  key: Slug;
  title: string;
  displayOrder: number;
  allowedPlanTiers: PlanTierSlug[];
  items: CategoryItem[];
  isActive: boolean;
};

function slug(current: string): Slug {
  return { _type: "slug", current };
}

const DOCS: LunchCategoryDoc[] = [
  {
    _id: "lunchCategory-paasmurt",
    _type: "lunchCategory",
    key: slug("paasmurt"),
    title: "Påsmurt",
    displayOrder: 1,
    allowedPlanTiers: [...T_ALL],
    items: [
      {
        _key: "ost-skinke",
        slug: slug("ost-skinke"),
        title: "Ost & Skinke",
        allergens: ["hvete", "melk"],
        allowedPlanTiers: [...T_ALL],
      },
      {
        _key: "laks-eggerore",
        slug: slug("laks-eggerore"),
        title: "Laks & Eggerøre",
        allergens: ["hvete", "egg", "fisk"],
        allowedPlanTiers: [...T_ALL],
      },
      {
        _key: "kylling-karri",
        slug: slug("kylling-karri"),
        title: "Kylling karri",
        allergens: ["hvete", "melk", "sennep"],
        allowedPlanTiers: [...T_ALL],
      },
      {
        _key: "vegetar",
        slug: slug("vegetar"),
        title: "Vegetar",
        allergens: ["hvete", "melk", "egg", "sennep"],
        isVegetarian: true,
        allowedPlanTiers: [...T_ALL],
      },
    ],
    isActive: true,
  },
  {
    _id: "lunchCategory-salatboks",
    _type: "lunchCategory",
    key: slug("salatboks"),
    title: "Salatboks",
    displayOrder: 2,
    allowedPlanTiers: [...T_ALL],
    items: [
      {
        _key: "skinke",
        slug: slug("skinke"),
        title: "Skinke",
        allergens: ["melk", "egg", "sennep"],
        allowedPlanTiers: [...T_ALL],
      },
      {
        _key: "kylling",
        slug: slug("kylling"),
        title: "Kylling",
        allergens: ["egg", "melk", "sennep"],
        allowedPlanTiers: [...T_ALL],
      },
      {
        _key: "vegetar",
        slug: slug("vegetar"),
        title: "Vegetar",
        allergens: ["melk", "egg"],
        isVegetarian: true,
        allowedPlanTiers: [...T_ALL],
      },
    ],
    isActive: true,
  },
  {
    _id: "lunchCategory-sushi",
    _type: "lunchCategory",
    key: slug("sushi"),
    title: "Sushi",
    displayOrder: 3,
    allowedPlanTiers: [...T_LUX],
    items: [
      {
        _key: "sushi-pakke",
        slug: slug("sushi-pakke"),
        title: "Sushi-pakke (6 biter MAKI, 2 biter NIGIRI, 1 Tempura)",
        allergens: ["fisk", "soya", "hvete", "sesam", "krepsdyr"],
        allowedPlanTiers: [...T_LUX],
      },
    ],
    isActive: true,
  },
  {
    _id: "lunchCategory-pokebowl",
    _type: "lunchCategory",
    key: slug("pokebowl"),
    title: "Pokebowl",
    displayOrder: 4,
    allowedPlanTiers: [...T_LUX],
    items: [
      {
        _key: "laks",
        slug: slug("laks"),
        title: "Laks",
        allergens: ["fisk", "soya", "sesam"],
        allowedPlanTiers: [...T_LUX],
      },
      {
        _key: "kylling",
        slug: slug("kylling"),
        title: "Kylling",
        allergens: ["soya", "sesam"],
        allowedPlanTiers: [...T_LUX],
      },
      {
        _key: "vegetar",
        slug: slug("vegetar"),
        title: "Vegetar",
        isVegetarian: true,
        allowedPlanTiers: [...T_LUX],
      },
    ],
    isActive: true,
  },
  {
    _id: "lunchCategory-thaimat",
    _type: "lunchCategory",
    key: slug("thaimat"),
    title: "Thaimat",
    displayOrder: 5,
    allowedPlanTiers: [...T_LUX],
    items: [
      {
        _key: "pad-thai-nudler",
        slug: slug("pad-thai-nudler"),
        title: "Pad Thai nudler",
        allergens: ["peanotter", "soya", "egg", "fisk"],
        allowedPlanTiers: [...T_LUX],
      },
      {
        _key: "biff-peppersaus",
        slug: slug("biff-peppersaus"),
        title: "Biff peppersaus",
        allergens: ["soya", "sesam", "hvete"],
        allowedPlanTiers: [...T_LUX],
      },
      {
        _key: "pad-med-mamuang",
        slug: slug("pad-med-mamuang"),
        title: "Pad med mamuang",
        allergens: ["kasjunott", "soya", "sesam"],
        allowedPlanTiers: [...T_LUX],
      },
    ],
    isActive: true,
  },
  {
    _id: "lunchCategory-varmrett",
    _type: "lunchCategory",
    key: slug("varmrett"),
    title: "Varmrett",
    displayOrder: 6,
    allowedPlanTiers: [...T_ALL],
    items: [],
    isActive: true,
  },
];

function safeEnv(name: string): string {
  return String(process.env[name] ?? "").trim();
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  const tokenRaw =
    process.env.SANITY_WRITE_TOKEN ??
    process.env.SANITY_TOKEN ??
    process.env.SANITY_API_TOKEN;

  if (!tokenRaw || !tokenRaw.trim()) {
    console.error("FAIL: Sanity write-token mangler i env.");
    console.error(
      "Set SANITY_WRITE_TOKEN, SANITY_TOKEN eller SANITY_API_TOKEN. Eksempel:",
    );
    console.error('$env:SANITY_WRITE_TOKEN="<token>"; npm run sanity:seed-lunch-categories-v2');
    process.exit(1);
  }

  const token = tokenRaw.trim();

  const projectId = requireSanityProjectIdFromEnv();
  const dataset = safeEnv("NEXT_PUBLIC_SANITY_DATASET") || safeEnv("SANITY_DATASET") || "production";

  const client = createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
  });

  console.log(`Sanity: ${projectId}/${dataset}`);
  console.log(`lunchCategory v2 (createOrReplace): ${DOCS.length} dokumenter`);

  if (isDryRun) {
    DOCS.forEach((d) => console.log(`  [dry-run] ${d._id}`));
    process.exit(0);
  }

  const tx = client.transaction();
  for (const doc of DOCS) {
    tx.createOrReplace(doc);
  }
  await tx.commit();

  const count = await client.fetch<number>('count(*[_type == "lunchCategory" && _id in $ids])', {
    ids: DOCS.map((d) => d._id),
  });
  console.log(`OK: transaksjon committet. Verifisert lunchCategory i dataset: ${count}/${DOCS.length}`);
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
