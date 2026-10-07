// Cloudflare Worker : même rôle que server.mjs, pour héberger Peppy+ en ligne.
// Les fichiers de public/ sont servis par Static Assets (wrangler.jsonc) ; le Worker
// ne reçoit que les chemins qui n'y correspondent pas : /graphql et /img.
const API = 'https://api.peppy.cool/graphql';
const IMG_HOST = /^https:\/\/peppy-prod-cdn\.s3(\.[a-z0-9-]+)?\.amazonaws\.com\//;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function proxy(req) {
  const headers = { 'content-type': 'application/json' };
  const auth = req.headers.get('authorization');
  if (auth) headers.authorization = auth;
  // Le cookie `peppyrefreshtoken` (HttpOnly) sert à renouveler le jeton d'accès.
  // On ne transmet pas ceux de Cloudflare (CF_Authorization si l'app est derrière Access).
  const cookie = (req.headers.get('cookie') || '').split(/;\s*/).filter((c) => c && !c.startsWith('CF_')).join('; ');
  if (cookie) headers.cookie = cookie;
  try {
    const r = await fetch(API, { method: 'POST', headers, body: await req.arrayBuffer() });
    const out = new Headers({ 'content-type': 'application/json' });
    // En HTTPS sur notre domaine, il suffit de retirer le Domain des cookies Peppy.
    for (const c of r.headers.getSetCookie()) out.append('set-cookie', c.replace(/;\s*Domain=[^;]*/gi, ''));
    return new Response(r.body, { status: r.status, headers: out });
  } catch (e) {
    return json(502, { errors: [{ message: `API injoignable : ${e.message}` }] });
  }
}

// Le CDN renvoie du application/octet-stream : on reconnaît le format aux premiers octets.
function sniff(b) {
  const text = (from, to) => new TextDecoder().decode(b.subarray(from, to));
  return b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg'
    : b[0] === 0x89 && b[1] === 0x50 ? 'image/png'
    : text(8, 12) === 'WEBP' ? 'image/webp'
    : text(0, 3) === 'GIF' ? 'image/gif'
    : /<svg/i.test(text(0, 300)) ? 'image/svg+xml'
    : 'application/octet-stream';
}

// Photos et logos Peppy : chaque URL est unique et ne change jamais, mais le CDN n'envoie
// aucun Cache-Control. On les met en cache chez Cloudflare et dans le navigateur pour un an.
async function image(url) {
  const src = url.searchParams.get('u') || '';
  if (!IMG_HOST.test(src)) return new Response(null, { status: 400 });
  const r = await fetch(src, { cf: { cacheEverything: true, cacheTtl: 31536000 } }).catch(() => null);
  if (!r?.ok) return new Response(null, { status: 502 });
  const body = new Uint8Array(await r.arrayBuffer());
  return new Response(body, { headers: { 'content-type': sniff(body), 'cache-control': 'public, max-age=31536000, immutable' } });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/graphql' && req.method === 'POST') return proxy(req);
    if (url.pathname === '/img') return image(url);
    return env.ASSETS.fetch(req);
  },
};
