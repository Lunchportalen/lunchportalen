// studio/schemas/weekPlan.ts
import { defineField, defineType } from "sanity";

const LEVELS: { title: string; value: string }[] = [
  { title: "Basis", value: "BASIS" },
  { title: "Luxus", value: "LUXUS" },
];

const STATUSES: { title: string; value: string }[] = [
  { title: "Draft", value: "draft" },
  { title: "Open (neste uke – kan bestilles)", value: "open" },
  { title: "Current (denne uken)", value: "current" },
  { title: "Archived (historikk)", value: "archived" },
];

const ALLERGENS: { title: string; value: string }[] = [
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
];

const MAY_CONTAIN: { title: string; value: string }[] = [
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
];

const KITCHEN_STYLES: { title: string; value: string }[] = [
  { title: "Norsk / skandinavisk", value: "norwegian" },
  { title: "Italiensk / middelhav", value: "italian" },
  { title: "Asiatisk", value: "asian" },
  { title: "Indisk / Midtøsten", value: "indian" },
  { title: "Meksikansk", value: "mexican" },
  { title: "Middelhav", value: "mediterranean" },
  { title: "Internasjonal", value: "international" },
  { title: "Annet", value: "other" },
];

const COST_TIERS: { title: string; value: string }[] = [
  { title: "Budsjett", value: "BUDGET" },
  { title: "Standard", value: "STANDARD" },
  { title: "Premium", value: "PREMIUM" },
];

export default defineType({
  name: "weekPlan",
  title: "Ukeplan",
  type: "document",

  fields: [
    defineField({
      name: "weekKey",
      title: "Ukenøkkel (ISO, f.eks. 2026-W05)",
      type: "string",
      validation: (Rule) => Rule.required().regex(/^\d{4}-W\d{2}$/),
    }),

    defineField({
      name: "weekStart",
      title: "Uke start (Mandag)",
      type: "date",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: { list: STATUSES, layout: "radio" },
      initialValue: "draft",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "approvedForPublish",
      title: "Godkjent for publisering",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "customerVisible",
      title: "Synlig for kunder/ansatte",
      type: "boolean",
      initialValue: false,
    }),

    defineField({
      name: "visibleFrom",
      title: "Synlig fra (ansatte)",
      type: "datetime",
      readOnly: true,
    }),

    defineField({
      name: "becomesCurrentAt",
      title: "Blir aktiv uke (fredag 15:00)",
      type: "datetime",
      readOnly: true,
    }),

    defineField({
      name: "publishedAt",
      title: "Publisert tidspunkt",
      type: "datetime",
      readOnly: true,
    }),

    defineField({
      name: "lockedAt",
      title: "Låst tidspunkt",
      type: "datetime",
      readOnly: true,
    }),

    defineField({
      name: "locked",
      title: "Låst (ingen endringer)",
      type: "boolean",
      readOnly: true,
      initialValue: false,
    }),

    defineField({
      name: "days",
      title: "Dager (Man–Fre)",
      type: "array",
      of: [
        {
          type: "object",
          name: "weekDay",
          title: "Dag",

          fields: [
            defineField({
              name: "date",
              title: "Dato",
              type: "date",
              validation: (Rule) => Rule.required(),
            }),

            defineField({
              name: "level",
              title: "Nivå",
              type: "string",
              options: { list: LEVELS, layout: "radio" },
              validation: (Rule) => Rule.required(),
            }),

            defineField({
              name: "mealRef",
              title: "Varmrett fra basebank",
              type: "reference",
              to: [{ type: "mealIdea" }],
              description:
                "Referanse til original rett. Snapshot-feltene under beholdes for historikk.",
            }),

            defineField({
              name: "mealTitle",
              title: "Rettens navn",
              type: "string",
              validation: (Rule) => Rule.required().min(3),
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
              options: {
                layout: "grid",
                list: ALLERGENS,
              },
            }),

            defineField({
              name: "mayContain",
              title: "Kan inneholde spor av",
              type: "array",
              of: [{ type: "string" }],
              options: {
                layout: "grid",
                list: MAY_CONTAIN,
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
              name: "kitchenStyle",
              title: "Kjøkkenstil",
              type: "string",
              options: {
                list: KITCHEN_STYLES,
                layout: "dropdown",
              },
            }),

            defineField({
              name: "costTier",
              title: "Kostnadsnivå",
              type: "string",
              options: {
                list: COST_TIERS,
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
              name: "approved",
              title: "Godkjent",
              type: "boolean",
              initialValue: false,
            }),

            defineField({
              name: "hidden",
              title: "Skjult",
              type: "boolean",
              initialValue: false,
            }),

            defineField({
              name: "dishes",
              title: "Retter (legacy)",
              type: "array",
              of: [{ type: "reference", to: [{ type: "dish" }] }],
              hidden: true,
              description:
                "Legacy-felt. Ikke bruk til ny ukeplan. Beholdes for bakoverkompatibilitet.",
            }),

            defineField({
              name: "kitchenNote",
              title: "Notat til kjøkken",
              type: "string",
            }),
          ],

          preview: {
            select: {
              date: "date",
              level: "level",
              mealTitle: "mealTitle",
              allergens: "allergens",
              nutrition: "nutritionPer100g",
              approved: "approved",
              hidden: "hidden",
            },
            prepare(sel) {
              const flags = [
                sel.level === "LUXUS" ? "Luxus" : "Basis",
                sel.approved ? "Godkjent" : "Ikke godkjent",
                sel.hidden ? "Skjult" : "Synlig",
              ].join(" • ");

              const kcal =
                sel.nutrition && typeof sel.nutrition.energyKcal === "number"
                  ? ` • ${sel.nutrition.energyKcal} kcal/100g`
                  : "";

              const allergens =
                Array.isArray(sel.allergens) && sel.allergens.length
                  ? ` • allergener: ${sel.allergens.join(", ")}`
                  : "";

              return {
                title: `${sel.date || "Ukjent dato"} — ${sel.mealTitle || "Ingen rett"}`,
                subtitle: `${flags}${kcal}${allergens}`,
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.custom((days) => {
          if (!days || !Array.isArray(days)) {
            return "Du må legge inn 5 dager (Man–Fre).";
          }

          if (days.length !== 5) {
            return "Ukeplan må ha nøyaktig 5 dager (Man–Fre).";
          }

          const dates = days.map((d: any) => String(d?.date ?? ""));
          const uniqueDates = new Set(dates.filter(Boolean));

          if (uniqueDates.size !== 5) {
            return "Hver dag må ha unik dato (ingen duplikater).";
          }

          const mealTitles = days.map((d: any) =>
            String(d?.mealTitle ?? "").trim().toLowerCase()
          );
          const uniqueMealTitles = new Set(mealTitles.filter(Boolean));

          if (uniqueMealTitles.size !== 5) {
            return "Hver dag må ha unik varmrett.";
          }

          const fishCount = days.filter((d: any) => d?.isFishDish === true).length;
          if (fishCount > 1) {
            return "Ukeplan kan maks ha én fiskerett.";
          }

          const soupCount = days.filter((d: any) => d?.isSoup === true).length;
          if (soupCount > 1) {
            return "Ukeplan kan maks ha én suppe.";
          }

          return true;
        }),
    }),

    defineField({
      name: "noteForKitchen",
      title: "Overordnet notat til kjøkken",
      type: "text",
    }),
  ],

  preview: {
    select: {
      weekKey: "weekKey",
      weekStart: "weekStart",
      status: "status",
      approved: "approvedForPublish",
      visible: "customerVisible",
      locked: "locked",
      days: "days",
    },
    prepare(sel) {
      const flags = [
        sel.status || "unknown",
        sel.approved ? "Godkjent" : "Ikke godkjent",
        sel.visible ? "Synlig" : "Skjult",
        sel.locked ? "Låst" : "Åpen",
      ].join(" • ");

      const dayCount = Array.isArray(sel.days) ? sel.days.length : 0;

      return {
        title: sel.weekKey
          ? `Ukeplan: ${sel.weekKey}`
          : sel.weekStart
            ? `Ukeplan: ${sel.weekStart}`
            : "Ukeplan",
        subtitle: `${flags} • ${dayCount}/5 dager`,
      };
    },
  },
});