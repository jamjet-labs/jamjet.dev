export const onRequestGet: PagesFunction = async () =>
  new Response(JSON.stringify({ ok: true, service: 'gate' }), {
    headers: { 'content-type': 'application/json' },
  });
