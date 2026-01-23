import { defineField, defineType } from "sanity";

const LEVELS = [
  { title: "Basis", value: "BASIS" },
  { title: "Luxus", value: "LUXUS" },
];

export default defineType({
  name: "weekPlan",
  title: "Ukeplan",
  type: "document",
  fields: [
    defineField({
      name: "weekStart",
      title: "Uke start (Mandag)",
      type: "date", // lagres som YYYY-MM-DD (ISO)
      validation: (Rule) => Rule.required(),
    }),

    // Publiserings-/synlighetskontroll
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
      name: "publishedAt",
      title: "Publisert tidspunkt",
      type: "datetime",
      readOnly: true,
    }),
    defineField({
      name: "lockedAt",
      title: "Låst etter 08:00",
      type: "datetime",
      readOnly: true,
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
              type: "date", // ISO lagring
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
              name: "dishes",
              title: "Retter",
              type: "array",
              of: [{ type: "reference", to: [{ type: "dish" }] }],
              validation: (Rule) => Rule.required().min(1).max(6),
            }),
          ],
          preview: {
            select: { date: "date", level: "level" },
            prepare(sel) {
              return {
                title: sel.date ? sel.date : "Ukjent dato",
                subtitle: sel.level === "LUXUS" ? "Luxus" : "Basis",
              };
            },
          },
        },
      ],
      validation: (Rule) =>
        Rule.custom((days) => {
          if (!days || !Array.isArray(days)) return "Du må legge inn 5 dager (Man–Fre).";
          if (days.length !== 5) return "Ukeplan må ha nøyaktig 5 dager (Man–Fre).";
          const dates = days.map((d: any) => String(d?.date ?? ""));
          const unique = new Set(dates.filter(Boolean));
          if (unique.size !== 5) return "Hver dag må ha unik dato (ingen duplikater).";
          return true;
        }),
    }),
  ],

  preview: {
    select: { weekStart: "weekStart", approved: "approvedForPublish", visible: "customerVisible", lockedAt: "lockedAt" },
    prepare(sel) {
      const flags = [
        sel.approved ? "Godkjent" : "Ikke godkjent",
        sel.visible ? "Synlig" : "Skjult",
        sel.lockedAt ? "Låst" : "Åpen",
      ].join(" • ");
      return {
        title: sel.weekStart ? `Ukeplan: ${sel.weekStart}` : "Ukeplan",
        subtitle: flags,
      };
    },
  },
});
