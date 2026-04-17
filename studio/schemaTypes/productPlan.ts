import { defineField, defineType } from "sanity";

/**
 * Canonical commercial plan: pricing + allowed meal keys + variation rule.
 * `allowedMeals` must match `menu.mealType` and DB `choice_key` (ASCII: paasmurt).
 */
export default defineType({
  name: "productPlan",
  title: "Produktplan",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Plan",
      type: "string",
      options: {
        list: [
          { title: "Basis", value: "basis" },
          { title: "Luxus", value: "luxus" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "price",
      title: "Pris per kuvert (NOK eks. mva)",
      type: "number",
      validation: (Rule) => Rule.required().positive(),
    }),
    defineField({
      name: "allowedMeals",
      title: "Tillatte mealType-nøkler",
      description: "Må matche `menu.mealType` og bestillingsnøkler (f.eks. salatbar, paasmurt, varmmat).",
      type: "array",
      of: [{ type: "string" }],
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const doc = context.document as Record<string, unknown> | undefined;
          const legacy = doc?.allowedMealTypes;
          const hasNew = Array.isArray(value) && value.length > 0;
          const hasLegacy = Array.isArray(legacy) && legacy.length > 0;
          if (!hasNew && !hasLegacy) return "Minst én mealType er påkrevd (allowedMeals eller legacy allowedMealTypes).";
          return true;
        }),
    }),
    defineField({
      name: "rules",
      title: "Regler",
      type: "object",
      fields: [
        defineField({
          name: "allowDailyVariation",
          title: "Tillat ulike måltider per dag (Luxus)",
          type: "boolean",
          initialValue: false,
        }),
      ],
    }),
    defineField({
      name: "allowedMealTypes",
      title: "Tillatte mealType-nøkler (legacy)",
      type: "array",
      of: [{ type: "string" }],
      hidden: ({ document }) => Array.isArray(document?.allowedMeals) && document!.allowedMeals!.length > 0,
    }),
    defineField({
      name: "allowDailyVariation",
      title: "Tillat ulike måltider per dag — legacy",
      type: "boolean",
      hidden: ({ document }) => document?.rules != null,
    }),
  ],
  preview: {
    select: { title: "name", price: "price" },
    prepare({ title, price }) {
      return { title: title ? String(title).toUpperCase() : "Plan", subtitle: price != null ? `${price} NOK` : "" };
    },
  },
});
