// Serveur local : sert l'interface (public/) et relaie /graphql vers l'API Peppy.
// Aucune dépendance : `node server.mjs` puis http://localhost:5173
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 5173;
const API = 'https://api.peppy.cool/graphql';
const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(HERE, 'public');
const IMG_CACHE = join(HERE, '.cache', 'img');
const IMG_HOST = /^https:\/\/peppy-prod-cdn\.s3(\.[a-z0-9-]+)?\.amazonaws\.com\//;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

async function proxy(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = { 'content-type': 'application/json' };
  if (req.headers.authorization) headers.authorization = req.headers.authorization;
  // Le cookie `peppyrefreshtoken` (HttpOnly) sert à renouveler le jeton d'accès.
  if (req.headers.cookie) headers.cookie = req.headers.cookie;
  try {
    const r = await fetch(API, { method: 'POST', headers, body: Buffer.concat(chunks) });
    // On rapatrie les cookies Peppy sur localhost (http) : sans Domain ni Secure.
    const cookies = r.headers.getSetCookie().map((c) =>
      c.replace(/;\s*Domain=[^;]*/gi, '').replace(/;\s*Secure/gi, '').replace(/;\s*SameSite=None/gi, '; SameSite=Lax'));
    res.writeHead(r.status, { 'content-type': 'application/json', ...(cookies.length && { 'set-cookie': cookies }) });
    res.end(Buffer.from(await r.arrayBuffer()));
  } catch (e) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ errors: [{ message: `API injoignable : ${e.message}` }] }));
  }
}

// Le CDN renvoie du application/octet-stream : on reconnaît le format aux premiers octets.
const sniff = (b) =>
  b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg'
  : b[0] === 0x89 && b[1] === 0x50 ? 'image/png'
  : b.subarray(8, 12).toString() === 'WEBP' ? 'image/webp'
  : b.subarray(0, 3).toString() === 'GIF' ? 'image/gif'
  : /<svg/i.test(b.subarray(0, 300).toString()) ? 'image/svg+xml'
  : 'application/octet-stream';

// Photos et logos Peppy : chaque URL est unique et ne change jamais, mais le CDN n'envoie
// aucun Cache-Control. On les garde sur disque (.cache/img) et on les sert avec un cache d'un an.
async function image(url, res) {
  const src = url.searchParams.get('u') || '';
  if (!IMG_HOST.test(src)) return res.writeHead(400).end();
  const file = join(IMG_CACHE, createHash('sha1').update(src).digest('hex'));
  let body = await readFile(file).catch(() => null);
  if (!body) {
    const r = await fetch(src).catch(() => null);
    if (!r?.ok) return res.writeHead(502).end();
    body = Buffer.from(await r.arrayBuffer());
    await mkdir(IMG_CACHE, { recursive: true });
    await writeFile(file, body).catch(() => {});
  }
  res.writeHead(200, { 'content-type': sniff(body), 'cache-control': 'public, max-age=31536000, immutable' });
  res.end(body);
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/graphql' && req.method === 'POST') return proxy(req, res);
  if (url.pathname === '/img') return image(url, res);
  const path = normalize(join(ROOT, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!path.startsWith(ROOT)) return res.writeHead(403).end();
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(PORT, () => console.log(`Peppy+ → http://localhost:${PORT}`));
