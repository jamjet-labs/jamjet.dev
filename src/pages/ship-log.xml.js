import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const entries = (await getCollection('shiplog'))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
  return rss({
    title: 'JamJet Ship Log',
    description: 'What shipped across the JamJet runtime, SDKs, and Cloud. Every other Friday, no skips.',
    site: context.site,
    items: entries.map((e) => ({
      title: e.data.title ?? `${e.data.area}: ${e.data.date.toISOString().slice(0, 10)}`,
      pubDate: e.data.date,
      description: e.body.trim(),
      link: '/ship-log/',
    })),
  });
}
