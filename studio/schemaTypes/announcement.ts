import { defineType, defineField } from 'sanity'

export default defineType({
  name: 'announcement',
  title: 'Driftsmelding',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Tittel',
      type: 'string',
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'message',
      title: 'Melding',
      type: 'text',
      rows: 3,
      validation: Rule => Rule.required(),
    }),
    defineField({
      name: 'active',
      title: 'Aktiv',
      type: 'boolean',
      initialValue: true,
    }),
    defineField({
      name: 'severity',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { title: 'Info', value: 'info' },
          { title: 'Advarsel', value: 'warning' },
          { title: 'Kritisk', value: 'critical' },
        ],
        layout: 'radio',
      },
      initialValue: 'info',
    }),
  ],
})
