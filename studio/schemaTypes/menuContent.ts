import { defineType, defineField } from "sanity";

export default defineType({
  name: "menuContent",
  title: "Menyinnhold",
  type: "document",

  fields: [
    defineField({
      name: "date",
      title: "Dato",
      type: "date",
      validation: (Rule) =>
        Rule.required().error("Dato er påkrevd"),
    }),

    defineField({
      name: "description",
      title: "Meny (varmmat)",
      type: "text",
      rows: 4,
      validation: (Rule) =>
        Rule.required()
          .min(8)
          .error("Menybeskrivelse må fylles ut (minst 8 tegn)"),
    }),

    defineField({
      name: "allergens",
      title: "Allergener",
      type: "array",
      of: [{ type: "string" }],
      options: {
        layout: "tags",
      },
    }),

    // ✅ FASIT-FELTET SOM AKTIVERER BESTILLING
    defineField({
      name: "isPublished",
      title: "Publisert (aktiver bestilling)",
      type: "boolean",
      initialValue: false,
      validation: (Rule) =>
        Rule.custom((value, context) => {
          if (value === true) {
            const desc = context.document?.description;
            if (!desc || !String(desc).trim()) {
              return "Kan ikke publisere uten menybeskrivelse";
            }
          }
          return true;
        }),
    }),
  ],

  preview: {
    select: {
      date: "date",
      description: "description",
      isPublished: "isPublished",
    },
    prepare({ date, description, isPublished }) {
      return {
        title: date,
        subtitle: description
          ? description.slice(0, 80)
          : "— Ingen meny",
        media: isPublished ? "✅" : "🕒",
      };
    },
  },
});
