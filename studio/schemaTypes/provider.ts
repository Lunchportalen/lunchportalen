import { defineField, defineType } from "sanity";

/**
 * Read-only mirror of Supabase provider (menu filtering only).
 * Authoritative business data stays in Supabase; sync via migrate/sync helpers.
 */
export default defineType({
  name: "provider",
  title: "Leverandør",
  type: "document",
  fields: [
    defineField({
      name: "name",
      title: "Navn",
      type: "string",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "logoUrl",
      title: "Logo-URL",
      type: "url",
      description: "Cachet fra Supabase ved sync.",
    }),
    defineField({
      name: "primaryColor",
      title: "Primærfarge",
      type: "string",
      description: "Hex eller CSS-farge for leverandør-tema.",
    }),
    defineField({
      name: "status",
      title: "Status",
      type: "string",
      options: {
        list: [
          { title: "Aktiv", value: "ACTIVE" },
          { title: "Pauset", value: "PAUSED" },
          { title: "Suspendert", value: "SUSPENDED" },
          { title: "Stengt", value: "CLOSED" },
        ],
        layout: "radio",
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "lastSyncedAt",
      title: "Sist synket fra Supabase",
      type: "datetime",
      readOnly: true,
    }),
  ],
  preview: {
    select: { title: "name", status: "status", slug: "slug.current" },
    prepare({ title, status, slug }) {
      return {
        title: title || "Leverandør",
        subtitle: [status, slug].filter(Boolean).join(" · "),
      };
    },
  },
});
