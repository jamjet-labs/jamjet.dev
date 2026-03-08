import { defineCollection, z } from 'astro:content';
import { docsSchema } from '@astrojs/starlight/schema';

const docs = defineCollection({
  type: 'content',
  schema: docsSchema(),
});

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    author: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

export const collections = {
  docs,
  blog,
};
