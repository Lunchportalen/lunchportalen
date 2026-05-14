import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "menuDay",
  title: "Meny – Dag",
  type: "document",
  validation: (Rule) =>
    Rule.custom(async (doc, context) => {
      if (!doc?.date || !doc?.planTier || !doc?.category) return true;
      const client = context.getClient({ apiVersion: "2024-01-01" });
      const existing = await client.fetch<string | null>(
        `*[
          _type == "menuDay" &&
          date == $date &&
          planTier == $planTier &&
          category == $category &&
          _id != $id &&
          !(_id in path("drafts.**"))
        ][0]._id`,
        {
          date: doc.date,
          planTier: doc.planTier,
          category: doc.category,
          id: String(doc._id ?? "").replace(/^drafts\./, ""),
        },
      );

      return existing
        ? `Det finnes allerede en ${doc.category} for ${doc.planTier} på ${doc.date}`
        : true;
    }),

  fields: [
    defineField({
      name: "date",
      title: "Dato",
      type: "date",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "planTier",
      title: "Plan",
      type: "string",
      description: "Hvilken plan denne retten tilhører",
      options: {
        list: [
          { title: "Basis", value: "BASIS" },
          { title: "Luxus", value: "LUXUS" },
          { title: "Enterprise", value: "ENTERPRISE" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required().error("Plan er påkrevd"),
    }),

    defineField({
      name: "category",
      title: "Kategori",
      type: "string",
      description: "Hvilken kategori retten dekker i menyen",
      options: {
        list: [
          { title: "Påsmurt", value: "paasmurt" },
          { title: "Salatboks", value: "salat" },
          { title: "Sushi", value: "sushi" },
          { title: "Pokébowl", value: "pokebowl" },
          { title: "Thai", value: "thai" },
          { title: "Varmrett", value: "varmrett" },
        ],
        layout: "dropdown",
      },
      validation: (Rule) => Rule.required().error("Kategori er påkrevd"),
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
      name: "items",
      title: "Valgalternativer (valgfri)",
      description:
        "La stå TOM hvis kategorien har én rett som varierer (Varmmat) " +
        "eller én sammensatt rett (Sushi: '6 Maki, 2 Nigiri og 1 Tempura') " +
        "— bruk mealTitle/description for det.\n\n" +
        "FYLL UT med 2+ alternativer når brukeren skal velge mellom flere " +
        "varianter:\n" +
        "• Salatboks: Kylling, Skinke, Vegetar\n" +
        "• Påsmurt: Ost & skinke, Laks & Eggerøre, Kylling karri, Vegetar\n" +
        "• Pokébowl: Laks, Kylling, Vegetar\n" +
        "• Thaimat: Pad Thai, Biff peppersaus, Pad med mamuang\n\n" +
        "⚠️ KRITISK: hver item MÅ ha presise allergener (EU 1169/2011). " +
        "Spesifiser konkret kornslag (Hvete, Rug, Bygg, Havre, Spelt, Kamut) " +
        "og konkret nøttetype (Mandel, Hasselnøtt, Valnøtt, Kasjunøtt, " +
        "Pekan, Paranøtt, Pistasj, Makadamia).\n\n" +
        "FASE 10C.1.",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "menuItem",
          fields: [
            defineField({
              name: "key",
              title: "Nøkkel",
              description:
                "Unik innenfor denne menuDay. Genereres automatisk fra " +
                "tittelen (f.eks. ost-skinke, kylling-karri, pad-thai).",
              type: "slug",
              options: { source: "title", maxLength: 64 },
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "title",
              title: "Tittel",
              type: "string",
              validation: (Rule) => Rule.required().max(60),
            }),
            defineField({
              name: "description",
              title: "Beskrivelse",
              type: "text",
              rows: 2,
            }),
            defineField({
              name: "allergens",
              title: "Allergener",
              description:
                "EU 1169/2011 Vedlegg II: 14 hovedallergener. " +
                "Glutenholdige kornslag og nøtter MÅ spesifiseres til " +
                "konkret type. La stå tomt kun hvis retten er fri for " +
                "ALLE 26 listede allergener — bevisst valg er påkrevd.",
              type: "array",
              of: [{ type: "string" }],
              options: {
                list: [
                  // Glutenholdige kornslag (kilde må spesifiseres per EU 1169/2011)
                  { title: "Hvete (glutenholdig)", value: "hvete" },
                  { title: "Rug (glutenholdig)", value: "rug" },
                  { title: "Bygg (glutenholdig)", value: "bygg" },
                  { title: "Havre (glutenholdig)", value: "havre" },
                  { title: "Spelt (glutenholdig)", value: "spelt" },
                  { title: "Kamut (glutenholdig)", value: "kamut" },
                  // Krepsdyr og bløtdyr (to separate allergener i EU-listen)
                  {
                    title: "Krepsdyr (reker, krabbe, hummer)",
                    value: "krepsdyr",
                  },
                  {
                    title: "Bløtdyr (blåskjell, blekksprut)",
                    value: "blotdyr",
                  },
                  // Andre primære allergener
                  { title: "Egg", value: "egg" },
                  { title: "Fisk", value: "fisk" },
                  { title: "Peanøtter", value: "peanotter" },
                  { title: "Soya", value: "soya" },
                  { title: "Melk (inkl. laktose)", value: "melk" },
                  // Nøtter (type må spesifiseres per EU 1169/2011)
                  { title: "Mandel (nøtt)", value: "mandel" },
                  { title: "Hasselnøtt", value: "hasselnott" },
                  { title: "Valnøtt", value: "valnott" },
                  { title: "Kasjunøtt", value: "kasjunott" },
                  { title: "Pekan (nøtt)", value: "pekan" },
                  { title: "Paranøtt", value: "paranott" },
                  { title: "Pistasj", value: "pistasj" },
                  { title: "Makadamia", value: "makadamia" },
                  // Krydder/tilsetninger
                  { title: "Selleri", value: "selleri" },
                  { title: "Sennep", value: "sennep" },
                  { title: "Sesamfrø", value: "sesam" },
                  {
                    title: "Svoveldioksid og sulfitter",
                    value: "sulfitter",
                  },
                  { title: "Lupin", value: "lupin" },
                ],
              },
              validation: (Rule) =>
                Rule.required().error(
                  "Allergener må vurderes for hvert valg (EU 1169/2011). " +
                    "Velg de som forekommer, eller bekreft 'fri for alle 26' " +
                    "ved å legge til en tom liste.",
                ),
            }),
            defineField({
              name: "isVegetarian",
              title: "Vegetar",
              type: "boolean",
              initialValue: false,
            }),
            defineField({
              name: "available",
              title: "Tilgjengelig",
              description:
                "Sett til false for å skjule midlertidig uten å slette.",
              type: "boolean",
              initialValue: true,
            }),
          ],
          preview: {
            select: {
              title: "title",
              subtitle: "description",
              allergens: "allergens",
            },
            prepare({ title, subtitle, allergens }) {
              const allergenText =
                Array.isArray(allergens) && allergens.length > 0
                  ? `⚠ ${allergens.join(", ")}`
                  : "✓ Ingen allergener";
              return {
                title: title || "Uten tittel",
                subtitle: subtitle
                  ? `${subtitle} · ${allergenText}`
                  : allergenText,
              };
            },
          },
        }),
      ],
      validation: (Rule) =>
        Rule.custom(
          (
            items?: Array<{
              key?: { current?: string };
            }>,
          ) => {
            if (!items || items.length === 0) return true;
            if (items.length === 1) {
              return (
                "Hvis items brukes, må det være minst 2 alternativer. " +
                "La feltet stå tomt hvis kategorien har én rett."
              );
            }
            const keys = items
              .map((it) => it?.key?.current)
              .filter((k): k is string => typeof k === "string" && k.length > 0);
            const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
            if (duplicates.length > 0) {
              return (
                `Duplikate nøkler: ${[...new Set(duplicates)].join(", ")}. ` +
                "Hver item må ha unik key."
              );
            }
            return true;
          },
        ),
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
      planTier: "planTier",
      category: "category",
      mealTitle: "mealTitle",
      description: "description",
      approved: "approvedForPublish",
      visible: "customerVisible",
      allergens: "allergens",
      nutrition: "nutritionPer100g",
    },
    prepare({ date, planTier, category, mealTitle, description, approved, visible, allergens, nutrition }) {
      const a = approved ? "✅ Godkjent" : "⛔ Ikke godkjent";
      const v = visible ? "👁️ Synlig" : "🙈 Skjult";
      const scope = [planTier, category].filter(Boolean).join(" / ");
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
        subtitle: `${scope ? `${scope} • ` : ""}${a} • ${v}${kcal}${allergenText}`,
      };
    },
  },
});