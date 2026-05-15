import { createClient } from "@sanity/client";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const API_VERSION = "2024-01-01";

type Slug = { _type: "slug"; current: string };

type CategoryItem = {
  _key: string;
  slug: Slug;
  title: string;
  description?: string;
  allergens?: string[];
  isVegetarian?: boolean;
};

type LunchCategoryDoc = {
  _id: string;
  _type: "lunchCategory";
  key: Slug;
  title: string;
  displayOrder: number;
  allowedPlanTiers: Array<"BASIS" | "LUXUS" | "ENTERPRISE">;
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
    allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
    items: [
      {
        _key: "ost-skinke",
        slug: slug("ost-skinke"),
        title: "Ost & Skinke",
        allergens: ["hvete", "melk"],
      },
      {
        _key: "laks-eggerore",
        slug: slug("laks-eggerore"),
        title: "Laks & Eggerøre",
        allergens: ["hvete", "egg", "fisk"],
      },
      {
        _key: "kyllingkarri",
        slug: slug("kyllingkarri"),
        title: "Kyllingkarri",
        allergens: ["hvete", "melk", "sennep"],
      },
      {
        _key: "vegetar",
        slug: slug("vegetar"),
        title: "Vegetar",
        allergens: ["hvete", "melk", "egg", "sennep"],
        isVegetarian: true,
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
    allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
    items: [
      {
        _key: "skinke",
        slug: slug("skinke"),
        title: "Skinke",
        allergens: ["melk", "egg", "sennep"],
      },
      {
        _key: "kylling",
        slug: slug("kylling"),
        title: "Kylling",
        allergens: ["egg", "melk", "sennep"],
      },
      {
        _key: "vegetar",
        slug: slug("vegetar"),
        title: "Vegetar",
        allergens: ["melk", "egg"],
        isVegetarian: true,
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
    allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
    items: [
      {
        _key: "sushi-standardpakke",
        slug: slug("sushi-standardpakke"),
        title: "6 maki, 2 nigiri, 1 tempura",
        description: "Kombinert sushi-meny: 6 maki, 2 nigiri og 1 tempura.",
        allergens: ["fisk", "soya", "hvete", "sesam", "krepsdyr"],
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
    allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
    items: [
      {
        _key: "laks",
        slug: slug("laks"),
        title: "Laks",
        allergens: ["fisk", "soya", "sesam"],
      },
      {
        _key: "kylling",
        slug: slug("kylling"),
        title: "Kylling",
        allergens: ["soya", "sesam"],
      },
      {
        _key: "vegetar",
        slug: slug("vegetar"),
        title: "Vegetar",
        isVegetarian: true,
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
    allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
    items: [
      {
        _key: "pad-thai-nudler",
        slug: slug("pad-thai-nudler"),
        title: "Pad Thai nudler",
        allergens: ["peanotter", "soya", "egg", "fisk"],
      },
      {
        _key: "biff-peppersaus-wok",
        slug: slug("biff-peppersaus-wok"),
        title: "Biff peppersaus wok",
        allergens: ["soya", "sesam", "hvete"],
      },
      {
        _key: "pad-med-mamuang-wok",
        slug: slug("pad-med-mamuang-wok"),
        title: "Pad med mamuang wok",
        allergens: ["kasjunott", "soya", "sesam"],
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
    allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
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
    console.error('$env:SANITY_WRITE_TOKEN="<token>"; npm run sanity:seed-lunch-categories');
    process.exit(1);
  }

  const token = tokenRaw.trim();

  const projectId = safeEnv("NEXT_PUBLIC_SANITY_PROJECT_ID") || safeEnv("SANITY_PROJECT_ID") || "4udoq5d8";
  const dataset = safeEnv("NEXT_PUBLIC_SANITY_DATASET") || safeEnv("SANITY_DATASET") || "production";

  const client = createClient({
    projectId,
    dataset,
    apiVersion: API_VERSION,
    token,
    useCdn: false,
  });

  console.log(`Sanity: ${projectId}/${dataset}`);
  console.log(`lunchCategory-dokumenter (createOrReplace): ${DOCS.length}`);

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
