import { defineArrayMember, defineField, defineType } from "sanity";

const CATEGORY_KEYS = [
  "paasmurt",
  "salatboks",
  "sushi",
  "pokebowl",
  "thaimat",
  "vegetarian",
  "varmrett",
] as const;

const PLAN_TIER_OPTIONS = [
  { title: "Basis", value: "BASIS" },
  { title: "Luxus", value: "LUXUS" },
  { title: "Enterprise", value: "ENTERPRISE" },
] as const;

export default defineType({
  name: "lunchCategory",
  title: "Lunsjkategori",
  type: "document",

  fields: [
    defineField({
      name: "countryCode",
      title: "Country code",
      type: "string",
      description: "ISO market country for this category universe (Phase 17MENU).",
      options: {
        list: [
          "NO", "SE", "DK", "FI", "GB", "DE", "FR", "ES", "IT", "NL",
          "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR", "US", "CA",
        ].map((c) => ({ title: c, value: c })),
        layout: "dropdown",
      },
      initialValue: "NO",
    }),
    defineField({
      name: "menuProfileId",
      title: "Menu profile id",
      type: "string",
    }),
    defineField({
      name: "canonicalCategoryKey",
      title: "Canonical package category",
      type: "string",
      description: "Global package key: sandwich|salad_box|warm_meal|sushi|poke_bowl|thai",
      options: {
        list: [
          { title: "sandwich", value: "sandwich" },
          { title: "salad_box", value: "salad_box" },
          { title: "warm_meal", value: "warm_meal" },
          { title: "sushi", value: "sushi" },
          { title: "poke_bowl", value: "poke_bowl" },
          { title: "thai", value: "thai" },
        ],
      },
    }),
    defineField({
      name: "provider",
      title: "Leverandør",
      description: "Tom = global mal. Satt = leverandør-spesifikk kopi (copy-on-write).",
      type: "reference",
      to: [{ type: "provider" }],
    }),

    defineField({
      name: "key",
      title: "Nøkkel",
      description: "Stabil slug for kategori (ordering / API)",
      type: "slug",
      options: {
        maxLength: 32,
      },
      validation: (Rule) =>
        Rule.required().custom((slug) => {
          const v = (slug?.current ?? "").trim();
          if (!v) return "Nøkkel er påkrevd";
          if (!([...CATEGORY_KEYS] as string[]).includes(v)) {
            return `Tillatte nøkler: ${[...CATEGORY_KEYS].join(", ")}`;
          }
          return true;
        }),
    }),

    defineField({
      name: "title",
      title: "Tittel",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),

    defineField({
      name: "displayOrder",
      title: "Sortering (UI)",
      type: "number",
      validation: (Rule) => Rule.required().integer().min(1).max(99),
      initialValue: 1,
    }),

    defineField({
      name: "allowedPlanTiers",
      title: "Tilgjengelig for avtale-tiers",
      type: "array",
      of: [
        {
          type: "string",
          options: {
            list: [...PLAN_TIER_OPTIONS],
          },
        },
      ],
      options: { layout: "grid" },
      initialValue: ["BASIS", "LUXUS", "ENTERPRISE"],
      validation: (Rule) =>
        Rule.required().min(1).error("Minst ett avtale-tier må velges."),
    }),

    defineField({
      name: "items",
      title: "Statiske alternativer",
      description:
        "For varmrett: tom — dagens varmrett knyttes via mealIdea/menuDay senere i pipeline.",
      type: "array",
      of: [
        defineArrayMember({
          type: "object",
          name: "categoryItem",
          fields: [
            defineField({
              name: "slug",
              title: "Slug",
              type: "slug",
              options: { maxLength: 64 },
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "title",
              title: "Tittel",
              type: "string",
              validation: (Rule) => Rule.required(),
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
              type: "array",
              of: [{ type: "string" }],
              options: {
                layout: "tags",
                list: [
                  { title: "Hvete (glutenholdig)", value: "hvete" },
                  { title: "Melk", value: "melk" },
                  { title: "Egg", value: "egg" },
                  { title: "Fisk", value: "fisk" },
                  { title: "Peanøtter", value: "peanotter" },
                  { title: "Soya", value: "soya" },
                  { title: "Sesam", value: "sesam" },
                  { title: "Krepsdyr", value: "krepsdyr" },
                  { title: "Sennep", value: "sennep" },
                  { title: "Kasjunøtt", value: "kasjunott" },
                ],
              },
            }),
            defineField({
              name: "isVegetarian",
              title: "Vegetar",
              type: "boolean",
              initialValue: false,
            }),
            defineField({
              name: "allowedPlanTiers",
              title: "Tilgjengelig for avtale-tiers (valgfritt)",
              description:
                "Tom liste = gjelder hele kategorien. Med verdier: varianten vises kun for valgte tiers.",
              type: "array",
              of: [
                {
                  type: "string",
                  options: { list: [...PLAN_TIER_OPTIONS] },
                },
              ],
              options: { layout: "grid" },
            }),
          ],
        }),
      ],
    }),

    defineField({
      name: "isActive",
      title: "Aktiv",
      type: "boolean",
      initialValue: true,
    }),
  ],

  preview: {
    select: { title: "title", key: "key.current", ord: "displayOrder" },
    prepare({ title, key, ord }) {
      return { title: title ?? "(uten tittel)", subtitle: `${key ?? "?"} • rekkefølge ${ord ?? "?"}` };
    },
  },
});
