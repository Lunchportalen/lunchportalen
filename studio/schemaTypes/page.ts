import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'page',
  title: 'Side',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Tittel',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'URL',
      type: 'slug',
      options: { source: 'title' },
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'content',
      title: 'Innhold',
      type: 'array',
      of: [{ type: 'block' }],
    }),
  ],
})
