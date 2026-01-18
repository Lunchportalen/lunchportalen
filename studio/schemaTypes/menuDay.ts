import { defineType, defineField } from "sanity";

export default defineType({
  name: "menuDay",
  title: "Meny – Dag",
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
    }),
    defineField({
      name: "allergens",
      title: "Allergener",
      type: "array",
      of: [{ type: "string" }],
    }),

    // ✅ MANUELL kontroll
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

    // ✅ AUTOMATIKK (settes av cron)
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
      approved: "approvedForPublish",
      visible: "customerVisible",
    },
    prepare({ date, approved, visible }) {
      const a = approved ? "✅ Godkjent" : "⛔ Ikke godkjent";
      const v = visible ? "👁️ Synlig" : "🙈 Skjult";
      return { title: date || "Uten dato", subtitle: `${a} • ${v}` };
    },
  },
});
