import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

test('o mesmo deploy atualiza a programação no horário de Belo Horizonte', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'clube-programacao-'));
  t.after(() => rmSync(dir, { force: true, recursive: true }));
  for (const name of ['src', 'scripts', 'functions', 'public', 'package.json']) {
    cpSync(join(root, name), join(dir, name), { recursive: true });
  }
  const source = join(dir, 'src', 'data', 'shows.json');
  const [sample] = JSON.parse(readFileSync(source, 'utf8')).shows;
  const show = (id, slug, date, weekday, times) => ({
    ...sample, id, slug, date, weekday, title: slug, times, availability: '',
  });
  const at = (value) => [{ label: 'Primeiro set', value }];
  writeFileSync(source, JSON.stringify({ shows: [
    show(1, 'quinta-noite', '2026-11-26', 'Quinta', at('20:00')),
    show(2, 'sexta-noite', '2026-11-27', 'Sexta', at('20:00')),
    show(3, 'sabado-noite', '2026-11-28', 'Sábado', at('20:00')),
    show(4, 'sabado-tarde', '2026-11-28', 'Sábado', [...at('16:00'), { label: 'Encerramento', value: '18:00' }]),
    show(5, 'terca-noite', '2026-12-01', 'Terça', at('20:00')),
    ...Array.from({ length: 10 }, (_, i) => {
      const date = new Date(Date.UTC(2026, 11, 15 + i * 7)).toISOString().slice(0, 10);
      return show(6 + i, 'futuro-' + i, date, 'Terça', at('20:00'));
    }),
  ] }));
  execFileSync(process.execPath, ['scripts/build.mjs'], {
    cwd: dir, env: { ...process.env, BUILD_DATE: '2026-11-26' },
  });
  const { serveSchedule } = await import(pathToFileURL(join(dir, 'functions', '_middleware.js')));
  const seen = [];
  async function get(path, time, method = 'GET') {
    const request = new Request('https://clubedejazzdocafe.com' + path, { method });
    return serveSchedule({
      request,
      next: () => new Response('static'),
      env: { ASSETS: { fetch(asset) {
        const { pathname } = new URL(asset.url);
        seen.push(pathname);
        const body = readFileSync(join(dir, 'dist', pathname, 'index.html'), 'utf8');
        return new Response(asset.method === 'HEAD' ? null : body, { headers: { 'Content-Security-Policy': "default-src 'self'" } });
      } } },
    }, Date.parse(time));
  }
  const home = async (time) => (await get('/', time)).text();
  function assertHighlight(html, slug, today) {
    assert.ok(html.match(/<p class="abertura__hoje">[^\n]+/)[0].includes('/shows/' + slug + '/'));
    assert.ok(html.match(/<article class="destaque">[\s\S]+?<\/article>/)[0].includes('/shows/' + slug + '/'));
    assert.equal((html.match(/>Hoje no Clube</g) ?? []).length, today ? 2 : 0);
  }
  function nextShows(html) {
    return html.split('Próximos shows do Clube')[1].split('O palco também é sala de aula')[0];
  }

  assertHighlight(await home('2026-11-27T02:59:59Z'), 'quinta-noite', true);
  const friday = await home('2026-11-27T03:00:00Z');
  assertHighlight(friday, 'sexta-noite', true);
  assert.doesNotMatch(friday, /quinta-noite/);
  assert.equal((nextShows(friday).match(/class="gig__nome"/g) ?? []).length, 13);
  assert.match(nextShows(friday), /futuro-8/);
  assert.doesNotMatch(nextShows(friday), /futuro-9/);
  assertHighlight(await home('2026-11-28T02:59:59Z'), 'sexta-noite', true);
  const saturday = await home('2026-11-28T03:00:00Z');
  assertHighlight(saturday, 'sabado-tarde', true);
  assert.match(nextShows(saturday), /sabado-tarde[\s\S]+sabado-noite/);
  assert.match(nextShows(saturday), /terca-noite[\s\S]+futuro-9/);
  assertHighlight(await home('2026-11-28T21:00:00Z'), 'sabado-noite', true);

  const sunday = await home('2026-11-29T03:00:00Z');
  assertHighlight(sunday, 'terca-noite', false);
  assert.match(sunday, /Próximo show · Terça, 01\/12/);
  assert.equal((nextShows(sunday).match(/class="gig__nome"/g) ?? []).length, 11);
  assert.match(nextShows(await home('2026-11-30T03:00:00Z')), /terca-noite/);
  assert.match(await home('2027-02-17T03:00:00Z'), /Em breve, novas datas na agenda/);

  const agenda = await get('/agenda/', '2026-11-27T03:00:00Z');
  assert.equal(agenda.headers.get('cache-control'), 'no-store');
  assert.equal(agenda.headers.get('content-security-policy'), "default-src 'self'");
  const [upcoming, archive] = (await agenda.text()).split('id="agenda-passados"');
  assert.doesNotMatch(upcoming, /quinta-noite/);
  assert.equal((upcoming.match(/class="gig__nome"/g) ?? []).length, 14);
  assert.match(upcoming, /futuro-9/);
  assert.match(archive, /quinta-noite[\s\S]+Encerrado/);
  const past = await get('/shows/quinta-noite/', '2026-11-27T03:00:00Z');
  assert.match(await past.text(), /Show encerrado/);
  const head = await get('/', '2026-11-28T03:00:00Z', 'HEAD');
  assert.equal(await head.text(), '');
  assert.equal(head.headers.get('cache-control'), 'no-store');
  const internal = seen.find((path) => path.startsWith('/_programacao/'));
  assert.ok(internal);
  assert.equal((await get(internal, '2026-11-28T03:00:00Z')).status, 404);
  assert.equal(await (await get('/shows/quinta-noite/evento.ics', '2026-11-28T03:00:00Z')).text(), 'static');
});
