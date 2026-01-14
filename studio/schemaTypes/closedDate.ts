import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'closedDate',
  title: 'Stengt dag',
  type: 'document',
  fields: [
    defineField({
      name: 'date',
      title: 'Dato',
      type: 'date',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'reason',
      title: 'Årsak',
      type: 'string',
    }),
  ],
})
