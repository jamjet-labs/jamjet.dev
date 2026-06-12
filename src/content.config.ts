import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    author: z.string().optional(),
    draft: z.boolean().optional(),
    category: z.enum(['Benchmark', 'Incident analysis', 'Build log', 'Landscape', 'Guide']).optional(),
  }),
});

const shiplog = defineCollection({
  type: 'content',
  schema: z.object({
    date: z.coerce.date(),
    area: z.enum(['runtime', 'sdk', 'cloud', 'research', 'site']),
    title: z.string().optional(),
    image: z.string().optional(),
  }),
});

export const collections = {
  blog,
  shiplog,
};
