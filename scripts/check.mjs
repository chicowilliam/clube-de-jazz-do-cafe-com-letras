#!/usr/bin/env node
// Verificação do build (sem dependências): links internos, imagens, CSS/JS referenciados,
// títulos, descrições, canonical, h1 único, alt de imagens e placeholders não substituídos.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
if (!existsSync(DIST)) { console.error('Rode `npm run build` antes.'); process.exit(1); }
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
const files = walk(DIST);
const html = files.filter((f) => f.endsWith('.html'));
const errors = [], warns = [];
const exists = (p) => {
  const clean = p.split('#')[0].split('?')[0];
  if (!clean) return true;
  const f = join(DIST, clean);
  return existsSync(f) && (statSync(f).isFile() || existsSync(join(f, 'index.html')));
};
let links = 0;
for (const f of html) {
  const rel = '/' + relative(DIST, f);
  const s = readFileSync(f, 'utf8');
  if (/\{\{\w+\}\}/.test(s)) errors.push(`${rel}: placeholder {{…}} não substituído`);
  if (/<!--@[\w-]+-->/.test(s)) errors.push(`${rel}: marcador <!--@…--> não substituído`);
  if (!/<title>[^<]{10,}<\/title>/.test(s)) errors.push(`${rel}: <title> ausente/curto`);
  if (!/<meta name="description" content="[^"]{30,}"/.test(s) && !rel.endsWith('404.html')) errors.push(`${rel}: meta description ausente/curta`);
  if (!/<link rel="canonical"/.test(s)) errors.push(`${rel}: canonical ausente`);
  const h1 = (s.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) warns.push(`${rel}: ${h1} <h1>`);
  for (const m of s.matchAll(/<img\b[^>]*>/g)) if (!/\balt="/.test(m[0])) errors.push(`${rel}: <img> sem alt: ${m[0].slice(0, 80)}`);
  for (const m of s.matchAll(/\s(?:href|src)="(\/[^"]*)"/g)) {
    links++;
    if (m[1].startsWith('//')) continue;
    if (m[1].startsWith('/api/')) continue;
    if (!exists(m[1])) errors.push(`${rel}: link/arquivo inexistente ${m[1]}`);
  }
  for (const m of s.matchAll(/id="([^"]+)"/g)) {
    if ((s.match(new RegExp(`id="${m[1]}"`, 'g')) || []).length > 1) { warns.push(`${rel}: id duplicado "${m[1]}"`); break; }
  }
}
const pend = html.reduce((n, f) => n + (readFileSync(f, 'utf8').match(/data-pendente=/g) || []).length, 0);
console.log(`${html.length} páginas HTML, ${files.length} arquivos, ${links} referências internas verificadas, ${pend} links marcados como pendentes.`);
warns.forEach((w) => console.warn('AVISO  ' + w));
errors.forEach((e) => console.error('ERRO   ' + e));
if (errors.length) { console.error(`${errors.length} erro(s).`); process.exit(1); }
console.log('Nenhum erro encontrado.');
