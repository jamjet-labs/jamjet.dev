import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rss({
    title: 'JamJet Field Notes',
    description: 'War stories and measurements from running AI agents against real systems.',
    site: context.site!,
    items: posts.map((p) => ({
      title: p.data.title,
      pubDate: p.data.date,
      description: p.data.description,
      link: `/blog/${p.slug}/`,
      author: p.data.author ?? 'JamJet',
      categories: p.data.category ? [p.data.category] : [],
    })),
    customData: `<language>en-us</language>`,
  });
}
