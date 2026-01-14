import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'pricingInfo',
  title: 'Prisinfo',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Tittel',
      type: 'string',
    }),
    defineField({
      name: 'content',
      title: 'Innhold',
      type: 'array',
      of: [{ type: 'block' }],
    }),
  ],
})
