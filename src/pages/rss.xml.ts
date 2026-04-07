import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
    const posts = await getCollection('blog', ({ data }) => !data.draft);

    const sorted = posts.sort(
        (a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
    );

    return rss({
        title: 'JamJet Blog',
        description:
            'Performance-first, agent-native runtime for AI agents. Engineering deep dives, architecture posts, and release notes.',
        site: context.site!,
        items: sorted.map((post) => ({
            title: post.data.title,
            description: post.data.description,
            pubDate: new Date(post.data.date),
            link: `/blog/${post.slug}/`,
            author: post.data.author ?? 'JamJet',
            categories: post.data.category ? [post.data.category] : [],
        })),
        customData: `<language>en-us</language>`,
        stylesheet: false,
    });
}
