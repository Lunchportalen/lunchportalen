export default {
  name: "mealIdea",
  title: "Rett-bank (Meal)",
  type: "document",
  fields: [
    {
      name: "title",
      title: "Navn",
      type: "string",
      validation: (Rule: any) =>
        Rule.required()
          .min(6)
          .error("Navn må fylles ut (minst 6 tegn)"),
    },

    {
      name: "tags",
      title: "Tags",
      type: "array",
      of: [{ type: "string" }],
      options: {
        layout: "grid",
        list: [
          { title: "Fisk", value: "fish" },
          { title: "Suppe", value: "soup" },
          { title: "Vegetar", value: "veg" },
          { title: "Kylling", value: "chicken" },
          { title: "Storfe", value: "beef" },
          { title: "Svin", value: "pork" },
          { title: "Annet", value: "other" },
        ],
      },
      validation: (Rule: any) =>
        Rule.required().min(1).error("Velg minst 1 tag"),
    },

    {
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
      validation: (Rule: any) => Rule.required(),
    },

    {
      name: "nutritionScore",
      title: "Næringsscore (1–10)",
      type: "number",
      initialValue: 7,
      validation: (Rule: any) =>
        Rule.required()
          .min(1)
          .max(10)
          .error("Næringsscore må være mellom 1 og 10"),
    },

    {
      name: "season",
      title: "Sesong (valgfritt)",
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
      description:
        "Hvis tomt: retten kan brukes hele året. Hvis fylt: generatoren prioriterer riktig sesong.",
    },

    {
      name: "allergens",
      title: "Allergener",
      type: "array",
      of: [{ type: "string" }],
      options: { layout: "tags" },
    },

    {
      name: "isActive",
      title: "Aktiv",
      type: "boolean",
      initialValue: true,
    },
  ],

  // ✅ Hindrer duplikater i banken (title bør være unik)
  validation: (Rule: any) =>
    Rule.custom(async (doc: any, ctx: any) => {
      const title = (doc?.title ?? "").trim();
      if (!title) return true;

      const { getClient } = ctx;
      const client = getClient({ apiVersion: "2024-01-01" });

      const q = `count(*[_type=="mealIdea" && title == $title && _id != $id])`;
      const count = await client.fetch(q, { title, id: doc._id });

      return count > 0 ? "En rett med samme navn finnes allerede (Navn må være unik)." : true;
    }),

  preview: {
    select: {
      title: "title",
      tags: "tags",
      costTier: "costTier",
      nutritionScore: "nutritionScore",
      isActive: "isActive",
    },
    prepare({ title, tags, costTier, nutritionScore, isActive }: any) {
      const t = Array.isArray(tags) ? tags.join(", ") : "";
      const status = isActive ? "✅" : "⛔";
      return {
        title: `${status} ${title ?? "Uten navn"}`,
        subtitle: `${costTier ?? ""} • score ${nutritionScore ?? "-"} • ${t}`,
      };
    },
  },
};
