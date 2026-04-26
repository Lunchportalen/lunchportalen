import { defineField, defineType } from "sanity";

export default defineType({
  name: "menuDay",
  title: "Meny – Dag",
  type: "document",

  fields: [
    defineField({
      name: "date",
      title: "Dato",
      type: "date",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "mealRef",
      title: "Varmrett fra basebank",
      type: "reference",
      to: [{ type: "mealIdea" }],
    }),

    defineField({
      name: "mealTitle",
      title: "Rettens navn",
      type: "string",
    }),

    defineField({
      name: "description",
      title: "Beskrivelse",
      type: "text",
      rows: 3,
    }),

    defineField({
      name: "allergens",
      title: "Allergener",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
    }),

    defineField({
      name: "mayContain",
      title: "Kan inneholde spor av",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
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
    }),

    defineField({
      name: "estimatedCostPerPortion",
      title: "Estimert råvarekost per porsjon",
      type: "number",
      validation: (Rule) => Rule.min(0).max(90),
    }),

    defineField({
      name: "isFishDish",
      title: "Fiskerett",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "isSoup",
      title: "Suppe",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "isVegetarian",
      title: "Vegetar",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "approvedForPublish",
      title: "Godkjent for publisering",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "approvedAt",
      title: "Godkjent tidspunkt",
      type: "datetime",
      readOnly: true,
    }),

    defineField({
      name: "customerVisible",
      title: "Synlig i kundeportal (auto)",
      type: "boolean",
      initialValue: false,
      readOnly: true,
    }),

    defineField({
      name: "customerVisibleSetAt",
      title: "Synlighet satt tidspunkt",
      type: "datetime",
      readOnly: true,
    }),
  ],

  preview: {
    select: {
      date: "date",
      mealTitle: "mealTitle",
      description: "description",
      approved: "approvedForPublish",
      visible: "customerVisible",
      allergens: "allergens",
      nutrition: "nutritionPer100g",
    },
    prepare({ date, mealTitle, description, approved, visible, allergens, nutrition }) {
      const a = approved ? "✅ Godkjent" : "⛔ Ikke godkjent";
      const v = visible ? "👁️ Synlig" : "🙈 Skjult";
      const kcal =
        nutrition && typeof nutrition.energyKcal === "number"
          ? ` • ${nutrition.energyKcal} kcal/100g`
          : "";
      const allergenText =
        Array.isArray(allergens) && allergens.length
          ? ` • allergener: ${allergens.join(", ")}`
          : "";

      return {
        title: `${date || "Uten dato"} — ${mealTitle || description || "Ingen rett"}`,
        subtitle: `${a} • ${v}${kcal}${allergenText}`,
      };
    },
  },
});