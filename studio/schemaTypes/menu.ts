import { defineField, defineType } from "sanity";

export default defineType({
  name: "menu",
  title: "Meny (mealType)",
  type: "document",
  fields: [
    defineField({
      name: "mealType",
      title: "mealType (nøkkel)",
      description: "Unik nøkkel som matcher productPlan.allowedMeals og DB choice_key.",
      type: "string",
      validation: (Rule) => Rule.required().min(2).max(64),
    }),
    defineField({
      name: "title",
      title: "Tittel",
      type: "string",
      validation: (Rule) => Rule.required().min(2).max(120),
    }),
    defineField({
      name: "description",
      title: "Beskrivelse",
      type: "text",
      rows: 4,
    }),
    defineField({
      name: "allergens",
      title: "Allergener",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
    }),
    defineField({
      name: "images",
      title: "Bilder",
      type: "array",
      of: [{ type: "image", options: { hotspot: true } }],
    }),
    defineField({
      name: "image",
      title: "Bilde (legacy, enkelt)",
      type: "image",
      options: { hotspot: true },
      hidden: ({ parent }) => Array.isArray(parent?.images) && parent!.images!.length > 0,
    }),
    defineField({
      name: "nutrition",
      title: "Næring (valgfritt)",
      type: "object",
      fields: [
        defineField({ name: "calories", title: "kcal", type: "number" }),
        defineField({ name: "protein_g", title: "Protein (g)", type: "number" }),
      ],
    }),
    defineField({
      name: "variants",
      title: "Varianter (valgfritt)",
      type: "array",
      of: [
        {
          type: "object",
          name: "menuVariant",
          title: "Variant",
          fields: [
            defineField({ name: "title", title: "Tittel", type: "string" }),
            defineField({ name: "description", title: "Beskrivelse", type: "text", rows: 2 }),
            defineField({ name: "mealType", title: "mealType (valgfritt)", type: "string" }),
          ],
        },
      ],
    }),
  ],
  preview: {
    select: { title: "title", mealType: "mealType" },
    prepare({ title, mealType }) {
      return { title: title ?? mealType, subtitle: mealType ? `mealType: ${mealType}` : "" };
    },
  },
});
