import { defineField, defineType } from "sanity";

const TARGET_PRICE_PER_PORTION = 90;

export default defineType({
  name: "mealIdea",
  title: "Varmmatbank",
  type: "document",

  fields: [
    defineField({
      name: "title",
      title: "Navn",
      type: "string",
      validation: (Rule) =>
        Rule.required().min(6).error("Navn må fylles ut (minst 6 tegn)"),
    }),

    defineField({
      name: "description",
      title: "Beskrivelse",
      type: "text",
      rows: 3,
    }),

    defineField({
      name: "tags",
      title: "Hovedråvare / type",
      type: "array",
      of: [{ type: "string" }],
      options: {
        layout: "grid",
        list: [
          { title: "Fisk", value: "fish" },
          { title: "Sjømat", value: "seafood" },
          { title: "Suppe", value: "soup" },
          { title: "Vegetar", value: "veg" },
          { title: "Vegan", value: "vegan" },
          { title: "Kylling", value: "chicken" },
          { title: "Storfe", value: "beef" },
          { title: "Svin", value: "pork" },
          { title: "Lam", value: "lamb" },
          { title: "Pasta", value: "pasta" },
          { title: "Gryte", value: "stew" },
          { title: "Annet", value: "other" },
        ],
      },
      validation: (Rule) => Rule.required().min(1).error("Velg minst 1 type"),
    }),

    defineField({
      name: "isFishDish",
      title: "Fiskerett",
      type: "boolean",
      initialValue: false,
      description: "Auto-generator: maks én fiskerett per uke.",
    }),

    defineField({
      name: "isSoup",
      title: "Suppe",
      type: "boolean",
      initialValue: false,
      description: "Auto-generator: maks én suppe per uke.",
    }),

    defineField({
      name: "isVegetarian",
      title: "Vegetar",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "kitchenStyle",
      title: "Kjøkkenstil",
      type: "string",
      options: {
        list: [
          { title: "Norsk / skandinavisk", value: "norwegian" },
          { title: "Italiensk / middelhav", value: "italian" },
          { title: "Asiatisk", value: "asian" },
          { title: "Indisk / Midtøsten", value: "indian" },
          { title: "Meksikansk", value: "mexican" },
          { title: "Middelhav", value: "mediterranean" },
          { title: "Internasjonal", value: "international" },
          { title: "Annet", value: "other" },
        ],
        layout: "dropdown",
      },
      initialValue: "international",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "method",
      title: "Tilberedning / konsept",
      type: "string",
      description: "Eksempel: ovnsbakt, wok, gryte, bowl, pasta, curry, taco.",
    }),

    defineField({
      name: "estimatedCostPerPortion",
      title: "Estimert råvarekost per porsjon",
      type: "number",
      description: "Brukes mot fast Lunchportalen-pris: 90 kr per person.",
      validation: (Rule) =>
        Rule.required()
          .min(0)
          .max(TARGET_PRICE_PER_PORTION)
          .error("Råvarekost må være mellom 0 og 90 kr."),
    }),

    defineField({
      name: "targetPricePerPortion",
      title: "Salgspris per porsjon",
      type: "number",
      initialValue: TARGET_PRICE_PER_PORTION,
      readOnly: true,
      description: "Fast kalkylepris for Lunchportalen varmmat.",
    }),

    defineField({
      name: "costTier",
      title: "Kostnadsnivå",
      type: "string",
      options: {
        list: [
          { title: "Budsjett", value: "BUDGET" },
          { title: "Standard", value: "STANDARD" },
          { title: "Premium", value: "PREMIUM" },
        ],
        layout: "radio",
      },
      initialValue: "STANDARD",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "productionComplexity",
      title: "Produksjonsnivå",
      type: "string",
      options: {
        list: [
          { title: "Enkel", value: "LOW" },
          { title: "Normal", value: "MEDIUM" },
          { title: "Krevende", value: "HIGH" },
        ],
        layout: "radio",
      },
      initialValue: "MEDIUM",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "nutritionScore",
      title: "Næringsscore (1–10)",
      type: "number",
      initialValue: 7,
      validation: (Rule) =>
        Rule.required().min(1).max(10).error("Næringsscore må være mellom 1 og 10"),
    }),

    defineField({
      name: "season",
      title: "Sesong",
      type: "array",
      of: [{ type: "string" }],
      options: {
        layout: "grid",
        list: [
          { title: "Vinter", value: "winter" },
          { title: "Vår", value: "spring" },
          { title: "Sommer", value: "summer" },
          { title: "Høst", value: "autumn" },
        ],
      },
      description: "Hvis tomt, kan retten brukes hele året.",
    }),

    defineField({
      name: "allergens",
      title: "Allergener",
      type: "array",
      of: [{ type: "string" }],
      options: {
        layout: "grid",
        list: [
          { title: "Gluten", value: "gluten" },
          { title: "Melk", value: "melk" },
          { title: "Egg", value: "egg" },
          { title: "Fisk", value: "fisk" },
          { title: "Skalldyr", value: "skalldyr" },
          { title: "Bløtdyr", value: "bløtdyr" },
          { title: "Soya", value: "soya" },
          { title: "Selleri", value: "selleri" },
          { title: "Sennep", value: "sennep" },
          { title: "Sesam", value: "sesam" },
          { title: "Peanøtter", value: "peanøtter" },
          { title: "Nøtter", value: "nøtter" },
          { title: "Sulfitt", value: "sulfitt" },
          { title: "Lupin", value: "lupin" },
        ],
      },
    }),

    defineField({
      name: "mayContain",
      title: "Kan inneholde spor av",
      type: "array",
      of: [{ type: "string" }],
      options: {
        layout: "grid",
        list: [
          { title: "Spor av gluten", value: "spor av gluten" },
          { title: "Spor av melk", value: "spor av melk" },
          { title: "Spor av egg", value: "spor av egg" },
          { title: "Spor av fisk", value: "spor av fisk" },
          { title: "Spor av skalldyr", value: "spor av skalldyr" },
          { title: "Spor av soya", value: "spor av soya" },
          { title: "Spor av selleri", value: "spor av selleri" },
          { title: "Spor av sennep", value: "spor av sennep" },
          { title: "Spor av sesam", value: "spor av sesam" },
          { title: "Spor av peanøtter", value: "spor av peanøtter" },
          { title: "Spor av nøtter", value: "spor av nøtter" },
        ],
      },
    }),

    defineField({
      name: "nutritionPer100g",
      title: "Næringsinnhold per 100 g",
      type: "object",
      fields: [
        defineField({
          name: "per",
          title: "Per",
          type: "string",
          initialValue: "100g",
          readOnly: true,
        }),
        defineField({
          name: "energyKcal",
          title: "Energi kcal",
          type: "number",
          validation: (Rule) => Rule.min(0),
        }),
        defineField({
          name: "proteinG",
          title: "Protein g",
          type: "number",
          validation: (Rule) => Rule.min(0),
        }),
        defineField({
          name: "carbohydratesG",
          title: "Karbohydrater g",
          type: "number",
          validation: (Rule) => Rule.min(0),
        }),
        defineField({
          name: "sugarsG",
          title: "Sukkerarter g",
          type: "number",
          validation: (Rule) => Rule.min(0),
        }),
        defineField({
          name: "fatG",
          title: "Fett g",
          type: "number",
          validation: (Rule) => Rule.min(0),
        }),
        defineField({
          name: "saturatedFatG",
          title: "Mettet fett g",
          type: "number",
          validation: (Rule) => Rule.min(0),
        }),
        defineField({
          name: "fiberG",
          title: "Fiber g",
          type: "number",
          validation: (Rule) => Rule.min(0),
        }),
        defineField({
          name: "saltG",
          title: "Salt g",
          type: "number",
          validation: (Rule) => Rule.min(0),
        }),
      ],
    }),

    defineField({
      name: "nutritionNote",
      title: "Merknad næringsinnhold",
      type: "text",
      rows: 2,
      description:
        "Brukes internt. Estimert næringsinnhold må kvalitetssikres mot faktisk oppskrift før kundevisning.",
    }),

    defineField({
      name: "aiMenuLearning",
      title: "AI menyoptimalisering",
      type: "object",
      description:
        "Interne styringsverdier for AI/generator basert på ordredata, svinn og tilbakemeldinger.",
      fields: [
        defineField({
          name: "popularityScore",
          title: "Popularitetsscore (1–100)",
          type: "number",
          initialValue: 50,
          validation: (Rule) => Rule.min(1).max(100),
        }),
        defineField({
          name: "wasteScore",
          title: "Svinnscore (1–100)",
          type: "number",
          initialValue: 50,
          description: "Lav score er bra. Høy score betyr at retten ofte gir svinn.",
          validation: (Rule) => Rule.min(1).max(100),
        }),
        defineField({
          name: "repeatRiskScore",
          title: "Repetisjonsrisiko (1–100)",
          type: "number",
          initialValue: 50,
          description: "Høy score betyr at retten bør brukes sjeldnere.",
          validation: (Rule) => Rule.min(1).max(100),
        }),
        defineField({
          name: "customerFitScore",
          title: "Kundefit-score (1–100)",
          type: "number",
          initialValue: 50,
          description: "Generell egnethet på tvers av kontorkunder.",
          validation: (Rule) => Rule.min(1).max(100),
        }),
        defineField({
          name: "lastFeedbackSummary",
          title: "Siste AI-oppsummering",
          type: "text",
          rows: 3,
          readOnly: true,
        }),
        defineField({
          name: "lastCalculatedAt",
          title: "Sist beregnet",
          type: "datetime",
          readOnly: true,
        }),
      ],
    }),

    defineField({
      name: "isActive",
      title: "Aktiv",
      type: "boolean",
      initialValue: true,
      description: "Kun aktive retter skal brukes av auto-generatoren.",
    }),

    defineField({
      name: "lastUsedDate",
      title: "Sist brukt",
      type: "date",
      readOnly: true,
    }),

    defineField({
      name: "usageCount",
      title: "Antall ganger brukt",
      type: "number",
      initialValue: 0,
      readOnly: true,
    }),
  ],

  validation: (Rule) =>
    Rule.custom(async (doc: any, ctx: any) => {
      const title = (doc?.title ?? "").trim();
      if (!title) return true;

      const { getClient } = ctx;
      const client = getClient({ apiVersion: "2024-01-01" });

      const query = `count(*[_type == "mealIdea" && title == $title && _id != $id])`;
      const count = await client.fetch(query, {
        title,
        id: doc._id,
      });

      return count > 0
        ? "En varmrett med samme navn finnes allerede. Navn må være unikt."
        : true;
    }),

  preview: {
    select: {
      title: "title",
      tags: "tags",
      kitchenStyle: "kitchenStyle",
      costTier: "costTier",
      nutritionScore: "nutritionScore",
      estimatedCostPerPortion: "estimatedCostPerPortion",
      isFishDish: "isFishDish",
      isSoup: "isSoup",
      isActive: "isActive",
      allergens: "allergens",
      nutritionPer100g: "nutritionPer100g",
      aiMenuLearning: "aiMenuLearning",
    },

    prepare(selection) {
      const {
        title,
        tags,
        kitchenStyle,
        costTier,
        nutritionScore,
        estimatedCostPerPortion,
        isFishDish,
        isSoup,
        isActive,
        allergens,
        nutritionPer100g,
        aiMenuLearning,
      } = selection as {
        title?: string;
        tags?: string[];
        kitchenStyle?: string;
        costTier?: string;
        nutritionScore?: number;
        estimatedCostPerPortion?: number;
        isFishDish?: boolean;
        isSoup?: boolean;
        isActive?: boolean;
        allergens?: string[];
        nutritionPer100g?: { energyKcal?: number };
        aiMenuLearning?: {
          popularityScore?: number;
          wasteScore?: number;
          customerFitScore?: number;
        };
      };

      const tagText = Array.isArray(tags) && tags.length ? tags.join(", ") : "";
      const allergenText =
        Array.isArray(allergens) && allergens.length
          ? ` • allergener: ${allergens.join(", ")}`
          : "";

      const status = isActive ? "✅" : "⛔";
      const margin =
        typeof estimatedCostPerPortion === "number"
          ? `${TARGET_PRICE_PER_PORTION - estimatedCostPerPortion} kr margin`
          : "margin ukjent";

      const kcal =
        typeof nutritionPer100g?.energyKcal === "number"
          ? ` • ${nutritionPer100g.energyKcal} kcal/100g`
          : "";

      const aiText = aiMenuLearning
        ? ` • AI P:${aiMenuLearning.popularityScore ?? "-"} S:${
            aiMenuLearning.wasteScore ?? "-"
          } F:${aiMenuLearning.customerFitScore ?? "-"}`
        : "";

      const rules = [isFishDish ? "fisk" : null, isSoup ? "suppe" : null]
        .filter(Boolean)
        .join(" / ");

      return {
        title: `${status} ${title ?? "Uten navn"}`,
        subtitle: `${kitchenStyle ?? "uten stil"} • ${
          costTier ?? "uten nivå"
        } • ${margin} • score ${nutritionScore ?? "-"}${kcal}${aiText}${
          rules ? ` • ${rules}` : ""
        }${tagText ? ` • ${tagText}` : ""}${allergenText}`,
      };
    },
  },
});