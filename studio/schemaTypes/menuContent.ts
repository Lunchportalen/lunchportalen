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
      validation: (Rule) => Rule.required(),
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
    }),

    // ✅ FASIT-FELTET SOM AKTIVERER BESTILLING
    defineField({
      name: "isPublished",
      title: "Publisert (aktiver bestilling)",
      type: "boolean",
      initialValue: false,
    }),
  ],
});
