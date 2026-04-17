import { defineField, defineType } from "sanity";

/**
 * Optional preset: mealType per weekday (keys mon–fre, same as DB delivery_days / meal_contract).
 */
export default defineType({
  name: "weekTemplate",
  title: "Uke-mal",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Navn",
      type: "string",
      validation: (Rule) => Rule.required().min(2).max(120),
    }),
    defineField({
      name: "days",
      title: "mealType per ukedag",
      type: "object",
      fields: [
        defineField({ name: "mon", title: "Mandag", type: "string" }),
        defineField({ name: "tue", title: "Tirsdag", type: "string" }),
        defineField({ name: "wed", title: "Onsdag", type: "string" }),
        defineField({ name: "thu", title: "Torsdag", type: "string" }),
        defineField({ name: "fri", title: "Fredag", type: "string" }),
      ],
    }),
  ],
  preview: {
    select: { title: "name" },
    prepare({ title }) {
      return { title: title ?? "Uke-mal" };
    },
  },
});
