import assert from 'node:assert/strict';
import { test } from 'node:test';
import { onRequestGet } from '../functions/api/youtube.js';

test('YouTube usa os uploads públicos, cache de seis horas e último resultado válido', async (t) => {
  const now = Date.parse('2026-11-27T12:00:00Z');
  const clock = t.mock.method(Date, 'now', () => now);
  const store = new Map();
  const env = { YOUTUBE_API_KEY: 'fixture-key', YOUTUBE_CACHE: {
    get: async (key, type) => type === 'json' ? JSON.parse(store.get(key) ?? 'null') : store.get(key),
    put: async (key, value) => { store.set(key, value); },
  } };
  const row = (id, privacyStatus, date) => ({
    status: { privacyStatus }, contentDetails: { videoId: id, videoPublishedAt: date },
    snippet: { title: id, thumbnails: { high: { url: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' } } },
  });
  const upstream = t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url.pathname, '/youtube/v3/playlistItems');
    assert.equal(url.searchParams.get('playlistId'), 'UUuiCi2BOYnrZ3ITCsRHIjtg');
    assert.equal(options.headers['x-goog-api-key'], 'fixture-key');
    return Response.json({ items: [
      row('abcdefghijk', 'public', '2026-11-25T00:00:00Z'),
      row('lmnopqrstuv', 'public', '2026-11-26T00:00:00Z'),
      row('12345678901', 'unlisted', '2026-11-27T00:00:00Z'),
    ] });
  });
  const request = () => onRequestGet({ env });
  const fresh = await request();
  assert.equal(fresh.headers.get('x-youtube-cache'), 'refresh');
  assert.equal(fresh.headers.get('cache-control'), 'public, max-age=21600');
  assert.deepEqual((await fresh.json()).videos.map(({ id }) => id), ['lmnopqrstuv', 'abcdefghijk']);
  assert.equal((await request()).headers.get('x-youtube-cache'), 'hit');
  assert.equal(upstream.mock.callCount(), 1);

  clock.mock.mockImplementation(() => now + 21600000);
  upstream.mock.mockImplementation(async () => new Response(null, { status: 403 }));
  const stale = await request();
  assert.equal(stale.headers.get('x-youtube-cache'), 'stale');
  assert.equal((await stale.json()).videos.length, 2);
  assert.equal((await request()).headers.get('x-youtube-cache'), 'stale');
  assert.equal(upstream.mock.callCount(), 2);

  store.clear();
  assert.equal((await request()).status, 503);
});

test('acervo usa páginas antigas, mantém quatro vídeos por ciclo e recupera após falha', async (t) => {
  const cycle = 48 * 60 * 60 * 1000;
  const clock = t.mock.method(Date, 'now', () => 20 * cycle);
  const store = new Map();
  const env = { YOUTUBE_API_KEY: 'fixture-key', YOUTUBE_CACHE: {
    get: async (key, type) => type === 'json' ? JSON.parse(store.get(key) ?? 'null') : store.get(key),
    put: async (key, value) => { store.set(key, value); },
  } };
  const row = (id) => ({ status: { privacyStatus: 'public' }, contentDetails: { videoId: id } });
  const ids = Array.from({ length: 10 }, (_, i) => String(i).padStart(11, '0'));
  const upstream = t.mock.method(globalThis, 'fetch', async (url) => {
    if (url.pathname.endsWith('/playlistItems')) {
      return Response.json(url.searchParams.has('pageToken')
        ? { items: ids.slice(2).concat(ids[0]).map(row) }
        : { items: ids.slice(0, 2).map(row), nextPageToken: 'older' });
    }
    return Response.json({ items: ids.map((id, index) => ({
      id, status: { privacyStatus: 'public', uploadStatus: 'processed' },
      snippet: { title: id, thumbnails: { high: { url: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' } } },
      ...(index === 9 && { contentDetails: { regionRestriction: { blocked: ['BR'] } } }),
    })) });
  });
  const request = new Request('https://example.test/api/youtube?feed=archive');
  const get = () => onRequestGet({ env, request });
  const selection = async (response) => (await response.json()).videos.map(({ id }) => id);
  const first = await get();
  assert.equal(first.headers.get('x-youtube-cache'), 'refresh');
  assert.equal(first.headers.get('cache-control'), 'public, max-age=172800');
  const a = await selection(first);
  assert.equal(new Set(a).size, 4);
  assert.ok(a.some((id) => ids.indexOf(id) >= 2));
  assert.ok(!a.includes(ids[9]));
  clock.mock.mockImplementation(() => 21 * cycle - 1000);
  assert.deepEqual(await selection(await get()), a);
  assert.equal(upstream.mock.callCount(), 3);
  clock.mock.mockImplementation(() => 21 * cycle);
  const b = await selection(await get());
  assert.equal(new Set(b).size, 4);
  assert.ok(!b.some((id) => a.includes(id)));
  clock.mock.mockImplementation(() => 22 * cycle);
  upstream.mock.mockImplementation(async () => new Response(null, { status: 503 }));
  const stale = await get();
  assert.equal(stale.headers.get('x-youtube-cache'), 'stale');
  assert.deepEqual(await selection(stale), b);
  await get();
  assert.equal(upstream.mock.callCount(), 7);
});
