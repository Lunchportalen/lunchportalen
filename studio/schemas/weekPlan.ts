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

    // Systemfelter (cron setter disse)
    defineField({
      name: "visibleFrom",
      title: "Synlig fra (ansatte)",
      type: "datetime",
      readOnly: true,
    }),
    defineField({
      name: "becomesCurrentAt",
      title: "Blir aktiv uke (fredag 14:00)",
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
              name: "dishes",
              title: "Retter",
              type: "array",
              of: [{ type: "reference", to: [{ type: "dish" }] }],
              validation: (Rule) => Rule.required().min(1).max(6),
            }),
            defineField({
              name: "kitchenNote",
              title: "Notat til kjøkken",
              type: "string",
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
    },
    prepare(sel) {
      const flags = [
        sel.status || "unknown",
        sel.approved ? "Godkjent" : "Ikke godkjent",
        sel.visible ? "Synlig" : "Skjult",
        sel.locked ? "Låst" : "Åpen",
      ].join(" • ");

      return {
        title: sel.weekKey ? `Ukeplan: ${sel.weekKey}` : sel.weekStart ? `Ukeplan: ${sel.weekStart}` : "Ukeplan",
        subtitle: flags,
      };
    },
  },
});
