import type { APIRoute } from 'astro';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const FONT_REGULAR_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.ttf';
const FONT_SEMIBOLD_URL =
  'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-600-normal.ttf';

let fontRegular: ArrayBuffer | null = null;
let fontSemiBold: ArrayBuffer | null = null;

async function fetchFont(url: string): Promise<ArrayBuffer> {
  // Runs at build time (static output); a failed fetch should fail the build
  // with a clear message rather than an opaque satori error.
  const r = await fetch(url);
  if (!r.ok) throw new Error(`og/gate.png: font fetch failed ${r.status} for ${url}`);
  return r.arrayBuffer();
}

async function loadFonts(): Promise<{ fontRegular: ArrayBuffer; fontSemiBold: ArrayBuffer }> {
  if (!fontRegular) {
    fontRegular = await fetchFont(FONT_REGULAR_URL);
  }
  if (!fontSemiBold) {
    fontSemiBold = await fetchFont(FONT_SEMIBOLD_URL);
  }
  return { fontRegular: fontRegular!, fontSemiBold: fontSemiBold! };
}

export const GET: APIRoute = async () => {
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
                fontSize: '48px',
                fontWeight: 600,
                color: '#ffffff',
                lineHeight: 1.25,
                fontFamily: 'Inter',
                display: 'flex',
                marginBottom: '20px',
              },
              children: 'Every action passes the gate.',
            },
          },
          {
            type: 'div',
            props: {
              style: {
                fontSize: '22px',
                fontWeight: 400,
                color: '#b8b2a8',
                fontFamily: 'Inter',
                lineHeight: 1.5,
                display: 'flex',
                maxWidth: '900px',
              },
              children: 'Block, hold, approve, and keep the receipt.',
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
              children: 'jamjet.dev/gate',
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

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
