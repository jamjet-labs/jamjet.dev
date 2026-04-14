import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const FONT_REGULAR_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf';
const FONT_SEMIBOLD_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf';

let fontRegular: ArrayBuffer | null = null;
let fontSemiBold: ArrayBuffer | null = null;

async function loadFonts() {
  if (!fontRegular) {
    fontRegular = await fetch(FONT_REGULAR_URL).then((r) => r.arrayBuffer());
  }
  if (!fontSemiBold) {
    fontSemiBold = await fetch(FONT_SEMIBOLD_URL).then((r) => r.arrayBuffer());
  }
  return { fontRegular, fontSemiBold };
}

export const getStaticPaths: GetStaticPaths = async () => {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { title: post.data.title, category: post.data.category ?? '' },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { title, category } = props as { title: string; category: string };
  const { fontRegular, fontSemiBold } = await loadFonts();

  const bottomText = category
    ? `jamjet.dev/blog  \u00b7  ${category}`
    : 'jamjet.dev/blog';

  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px 80px',
          backgroundColor: '#141413',
        },
        children: [
          {
            type: 'div',
            props: {
              style: {
                width: '60px',
                height: '4px',
                backgroundColor: '#8b7355',
                marginBottom: '32px',
                borderRadius: '2px',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '42px',
                fontWeight: 600,
                color: '#ffffff',
                lineHeight: 1.3,
                fontFamily: 'Inter',
                display: 'flex',
                maxWidth: '1000px',
                overflow: 'hidden',
              },
              children: title,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '18px',
                fontWeight: 400,
                color: '#8b8578',
                fontFamily: 'Inter',
                marginTop: 'auto',
                display: 'flex',
              },
              children: bottomText,
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'Inter',
          data: fontRegular,
          weight: 400,
          style: 'normal',
        },
        {
          name: 'Inter',
          data: fontSemiBold,
          weight: 600,
          style: 'normal',
        },
      ],
    }
  );

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  const png = resvg.render().asPng();

  return new Response(png, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
