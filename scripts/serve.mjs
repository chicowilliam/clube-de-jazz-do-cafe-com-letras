#!/usr/bin/env node
// Servidor local simples para conferir dist/ (sem dependências). Uso: npm run preview
// Simula 404.html e as rotas /pasta/ -> /pasta/index.html. Não executa as Functions
// (para isso use `npx wrangler pages dev dist`).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const PORT = Number(process.env.PORT || 8788);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.otf': 'font/otf',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.ics': 'text/calendar; charset=utf-8', '.webmanifest': 'application/manifest+json' };

async function resolve(p) {
  let f = join(DIST, normalize(decodeURIComponent(p)).replace(/^(\.\.[/\\])+/, ''));
  try { if ((await stat(f)).isDirectory()) f = join(f, 'index.html'); await stat(f); return f; } catch { return null; }
}
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) { res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end('{"ok":false,"message":"Functions não rodam neste servidor local."}'); }
  if (!url.pathname.endsWith('/') && !extname(url.pathname) && await resolve(url.pathname + '/')) { res.writeHead(308, { Location: url.pathname + '/' }); return res.end(); }
  const f = await resolve(url.pathname);
  if (!f) { res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(await readFile(join(DIST, '404.html'))); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(await readFile(f));
}).listen(PORT, () => console.log(`Prévia em http://localhost:${PORT}`));
