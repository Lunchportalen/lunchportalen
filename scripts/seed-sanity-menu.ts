/**
 * Seed Sanity menu catalog and product plans.
 *
 * Run: npm run seed:sanity-menu
 * Requires: SANITY_PROJECT_ID, SANITY_DATASET, SANITY_AUTH_TOKEN
 */

import { createClient } from "@sanity/client";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

type MenuVariant = {
  title: string;
  description: string;
  mealType?: string;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isLactoseFree?: boolean;
  isHalal?: boolean;
  allergens: string[];
};

type MenuDocument = {
  _id: string;
  _type: "menu";
  mealType: "paasmurt" | "salat" | "sushi" | "pokebowl" | "thai";
  title: string;
  description: string;
  allergens: string[];
  variants: MenuVariant[];
};

const projectId = process.env.SANITY_PROJECT_ID;
const dataset = process.env.SANITY_DATASET;
const token = process.env.SANITY_AUTH_TOKEN;

if (!projectId) {
  console.error("Missing SANITY_PROJECT_ID. Set it before running seed:sanity-menu.");
  process.exit(1);
}

if (!dataset) {
  console.error("Missing SANITY_DATASET. Set it before running seed:sanity-menu.");
  process.exit(1);
}

if (!token) {
  console.error("Missing SANITY_AUTH_TOKEN. Create a Sanity token with write access and set it before running seed:sanity-menu.");
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  token,
  apiVersion: "2024-01-01",
  useCdn: false,
});

const productPlans = [
  {
    _id: "productPlan-basis",
    _type: "productPlan",
    name: "basis",
    price: 79,
    includesWarm: true,
    tagline: "Varmmat hver dag, pluss påsmurt og salat fra fast utvalg.",
    allowedMeals: ["paasmurt", "salat"],
    rules: {
      allowDailyVariation: false,
    },
  },
  {
    _id: "productPlan-luxus",
    _type: "productPlan",
    name: "luxus",
    price: 119,
    includesWarm: true,
    tagline: "Full meny: varmmat, påsmurt, salat, sushi, pokebowl og thai.",
    allowedMeals: ["paasmurt", "salat", "sushi", "pokebowl", "thai"],
    rules: {
      allowDailyVariation: true,
    },
  },
];

const menuDocuments: MenuDocument[] = [
  {
    _id: "menu-paasmurt",
    _type: "menu",
    mealType: "paasmurt",
    title: "Påsmurt",
    description: "Fast utvalg av brød med pålegg. Du kan alltid velge fra denne listen.",
    allergens: ["gluten", "melk", "egg"],
    variants: [
      {
        title: "Kylling-pesto baguette",
        description: "Baguette med kylling, grønn pesto, salat og tomat.",
        isHalal: true,
        allergens: ["gluten", "melk", "nøtter"],
      },
      {
        title: "Egg og avokado rundstykke",
        description: "Grovt rundstykke med egg, avokado, spinat og mild urtedressing.",
        isVegetarian: true,
        allergens: ["gluten", "egg"],
      },
      {
        title: "Røkelaks med kremost",
        description: "Surdeigsbrød med røkelaks, kremost, agurk og dill.",
        allergens: ["gluten", "melk", "fisk"],
      },
      {
        title: "Hummus og grillede grønnsaker",
        description: "Focaccia med hummus, grillede grønnsaker og ruccola.",
        isVegetarian: true,
        isVegan: true,
        isLactoseFree: true,
        allergens: ["gluten", "sesam"],
      },
    ],
  },
  {
    _id: "menu-salat",
    _type: "menu",
    mealType: "salat",
    title: "Salat",
    description: "Fast salatutvalg med varierte protein- og grønnsakskombinasjoner.",
    allergens: ["melk", "egg", "nøtter"],
    variants: [
      {
        title: "Cæsarsalat med kylling",
        description: "Romanosalat med kylling, parmesan, krutonger og cæsardressing.",
        isHalal: true,
        allergens: ["gluten", "melk", "egg"],
      },
      {
        title: "Middelhavssalat med feta",
        description: "Salat med fetaost, oliven, tomat, agurk, quinoa og urtevinaigrette.",
        isVegetarian: true,
        isGlutenFree: true,
        allergens: ["melk"],
      },
      {
        title: "Linsesalat med ovnsbakte rotgrønnsaker",
        description: "Lun linsesalat med rotgrønnsaker, spinat og sitrondressing.",
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["selleri"],
      },
      {
        title: "Rekesalat med egg",
        description: "Frisk salat med reker, egg, avokado, agurk og mild dressing.",
        isGlutenFree: true,
        allergens: ["skalldyr", "egg"],
      },
    ],
  },
  {
    _id: "menu-sushi",
    _type: "menu",
    mealType: "sushi",
    title: "Sushi",
    description: "Sushi-utvalg laget samme dag.",
    allergens: ["fisk", "skalldyr", "soya"],
    variants: [
      {
        title: "Laks maki",
        description: "Maki med laks, avokado, agurk og sesam.",
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["fisk", "sesam"],
      },
      {
        title: "Tempura scampi maki",
        description: "Maki med tempura scampi, avokado og chilimajones.",
        isLactoseFree: true,
        allergens: ["gluten", "skalldyr", "egg"],
      },
      {
        title: "Vegetar maki",
        description: "Maki med avokado, agurk, gulrot og syltet reddik.",
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["sesam"],
      },
    ],
  },
  {
    _id: "menu-pokebowl",
    _type: "menu",
    mealType: "pokebowl",
    title: "Pokebowl",
    description: "Hawaii-inspirerte boller med ris, protein og friske toppinger.",
    allergens: ["fisk", "soya", "sesam"],
    variants: [
      {
        title: "Pokebowl med laks",
        description: "Risbolle med laks, edamame, mango, avokado og ponzu.",
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["fisk", "soya", "sesam"],
      },
      {
        title: "Pokebowl med kylling teriyaki",
        description: "Risbolle med kylling, agurk, gulrot, vårløk og teriyakisaus.",
        isHalal: true,
        isLactoseFree: true,
        allergens: ["soya", "sesam"],
      },
      {
        title: "Pokebowl med marinert tofu",
        description: "Risbolle med tofu, avokado, syltet rødkål, mango og lime.",
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["soya", "sesam"],
      },
      {
        title: "Pokebowl med reker",
        description: "Risbolle med reker, avokado, edamame, agurk og chilidressing.",
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["skalldyr", "soya", "sesam"],
      },
    ],
  },
  {
    _id: "menu-thai",
    _type: "menu",
    mealType: "thai",
    title: "Thaimat",
    description: "Thai-retter med autentiske smaker, tilpasset lunsj.",
    allergens: ["fisk", "soya", "peanøtter"],
    variants: [
      {
        title: "Rød curry med kylling",
        description: "Kylling i rød curry med kokosmelk, grønnsaker og jasminris.",
        isGlutenFree: true,
        isLactoseFree: true,
        isHalal: true,
        allergens: ["fisk"],
      },
      {
        title: "Pad thai med reker",
        description: "Risnudler med reker, egg, bønnespirer, lime og peanøtter.",
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["skalldyr", "egg", "peanøtter"],
      },
      {
        title: "Grønn curry med tofu",
        description: "Tofu i grønn curry med kokosmelk, bambusskudd og jasminris.",
        isVegetarian: true,
        isVegan: true,
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["soya"],
      },
      {
        title: "Thai biffsalat",
        description: "Frisk salat med biff, urter, lime, chili og risnudler.",
        isGlutenFree: true,
        isLactoseFree: true,
        allergens: ["fisk", "soya"],
      },
    ],
  },
];

async function main() {
  const transaction = client.transaction();

  for (const plan of productPlans) {
    transaction.createOrReplace(plan);
  }

  for (const menuDocument of menuDocuments) {
    transaction.createOrReplace(menuDocument);
  }

  const result = await transaction.commit();

  console.log("Seeded Sanity product plans and menu catalog.");
  console.log(`Product plans: ${productPlans.map((plan) => plan._id).join(", ")}`);
  console.log(`Menu documents: ${menuDocuments.map((menuDocument) => menuDocument._id).join(", ")}`);
  console.log(`Transaction ID: ${result.transactionId}`);
}

main().catch((error) => {
  console.error("Failed to seed Sanity menu data.", error instanceof Error ? error.message : error);
  process.exit(1);
});
