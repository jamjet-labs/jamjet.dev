import type { APIRoute, GetStaticPaths } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const FONT_REGULAR_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf';
const FONT_SEMIBOLD_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf';

let fontRegular: ArrayBuffer | null = null;
let fontSemiBold: ArrayBuffer | null = null;

async function loadFonts(): Promise<{ fontRegular: ArrayBuffer; fontSemiBold: ArrayBuffer }> {
  if (!fontRegular) {
    fontRegular = await fetch(FONT_REGULAR_URL).then((r) => r.arrayBuffer());
  }
  if (!fontSemiBold) {
    fontSemiBold = await fetch(FONT_SEMIBOLD_URL).then((r) => r.arrayBuffer());
  }
  return { fontRegular: fontRegular!, fontSemiBold: fontSemiBold! };
}

const compares: Array<{ slug: string; competitor: string; tagline: string }> = [
  {
    slug: 'langsmith',
    competitor: 'LangSmith',
    tagline: 'Observation vs enforcement',
  },
  {
    slug: 'helicone',
    competitor: 'Helicone',
    tagline: 'LLM proxy vs agent safety layer',
  },
  {
    slug: 'temporal',
    competitor: 'Temporal',
    tagline: 'Generic durability vs agent-native runtime',
  },
  {
    slug: 'microsoft-agt',
    competitor: 'Microsoft AGT',
    tagline: 'Policy library vs safety runtime',
  },
];

export const getStaticPaths: GetStaticPaths = async () => {
  return compares.map((c) => ({
    params: { slug: c.slug },
    props: { competitor: c.competitor, tagline: c.tagline },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { competitor, tagline } = props as { competitor: string; tagline: string };
  const { fontRegular, fontSemiBold } = await loadFonts();

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
                fontSize: '14px',
                fontWeight: 600,
                color: '#8b7355',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontFamily: 'Inter',
                marginBottom: '24px',
                display: 'flex',
              },
              children: 'Comparison',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '78px',
                fontWeight: 600,
                color: '#ffffff',
                lineHeight: 1.05,
                fontFamily: 'Inter',
                letterSpacing: '-0.02em',
                display: 'flex',
              },
              children: `JamJet vs ${competitor}`,
            },
          },
          {
            type: 'div',
            props: {
              style: {
                width: '80px',
                height: '4px',
                backgroundColor: '#8b7355',
                marginTop: '36px',
                marginBottom: '24px',
                borderRadius: '2px',
              },
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '32px',
                fontWeight: 400,
                color: '#cdc6b6',
                lineHeight: 1.4,
                fontFamily: 'Inter',
                display: 'flex',
                maxWidth: '1000px',
              },
              children: tagline,
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
              children: 'jamjet.dev/compare',
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
        { name: 'Inter', data: fontSemiBold, weight: 600, style: 'normal' },
      ],
    }
  );

  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
  });
  const png = resvg.render().asPng();

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
