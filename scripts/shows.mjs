import { statSync } from 'node:fs';

const zone = 'America/Sao_Paulo';
const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
});
const localOffset = new Intl.DateTimeFormat('en', { timeZone: zone, timeZoneName: 'longOffset' });
const weekday = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long' });
const categories = new Set(['jazz', 'instrumental', 'minas', 'vocal', 'bigband', 'escola']);
const clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const isEnd = (row) => /^encerramento$/i.test(row.label.trim());
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const validDate = (value) => typeof value === 'string' && /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

function isHttps(value) {
  if (typeof value !== 'string' || !/^https:\/\/[^/]/i.test(value) || /[\s\\<>"\u0000-\u001f\u007f]/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function firstStart(show) {
  return (show.times.find((row) => /^primeiro\b/i.test(row.label.trim())) || show.times[0]).value;
}

function dateInSaoPaulo(now) {
  const parts = Object.fromEntries(localDate.formatToParts(now).map(({ type, value }) => [type, value]));
  return [parts.year, parts.month, parts.day].join('-');
}

function inSaoPaulo(date, time) {
  const local = `${date}T${time}:00`;
  const offsetAt = (instant) => localOffset.formatToParts(instant).find(({ type }) => type === 'timeZoneName').value.slice(3);
  const tentative = offsetAt(new Date(local + 'Z'));
  const offset = offsetAt(new Date(local + tentative));
  const result = local + offset;
  if (offsetAt(new Date(result)) !== offset) return null; // Horário local inexistente na troca de fuso.
  return result;
}

export function prepareShows(data, { now = new Date(), buildDate, assetDir }) {
  if (buildDate !== undefined && !validDate(buildDate)) throw new Error('BUILD_DATE deve ser uma data válida (AAAA-MM-DD).');
  if (!Array.isArray(data?.shows)) throw new Error('shows.json: esperado um array em "shows".');

  const ids = new Set(), slugs = new Set();
  const shows = data.shows.map((show, index) => {
    const check = (condition, field) => {
      if (!condition) throw new Error(`shows.json: shows[${index}]${show?.slug ? ` (${show.slug})` : ''}: ${field}`);
    };
    check(show && typeof show === 'object' && !Array.isArray(show), 'evento inválido');
    check(Number.isSafeInteger(show.id) && show.id > 0 && !ids.has(show.id), 'id inválido ou duplicado');
    check(typeof show.slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(show.slug) && !slugs.has(show.slug), 'slug inválido ou duplicado');
    ids.add(show.id);
    slugs.add(show.slug);
    check(validDate(show.date), 'date inválida (AAAA-MM-DD)');
    const expectedDay = weekday.format(new Date(show.date));
    check(nonempty(show.weekday) && [expectedDay, expectedDay.split('-')[0]].includes(show.weekday.toLowerCase()),
      'weekday incompatível com date');
    for (const key of ['title', 'tickets_label']) check(nonempty(show[key]), `${key} obrigatório`);
    check(typeof show.subtitle === 'string', 'subtitle deve ser texto');
    check(typeof show.escola === 'boolean', 'escola deve ser booleano');
    for (const key of ['tickets_url', 'source_url']) check(isHttps(show[key]), `${key} deve ser uma URL HTTPS válida`);
    check(typeof show.youtube === 'string' && /^(?:[\w-]{11})?$/.test(show.youtube), 'youtube deve ser um ID válido ou vazio');
    check(typeof show.image === 'string' && /^\/assets\/img\/(?:[\w-]+\/)*[\w-]+\.(?:jpe?g|png|webp|avif|gif)$/i.test(show.image) &&
      statSync(new URL(show.image.slice('/assets/'.length), assetDir), { throwIfNoEntry: false })?.isFile(), 'image deve apontar para uma imagem local existente');
    for (const key of ['tags', 'description']) {
      check(Array.isArray(show[key]) && show[key].every(nonempty) && (key !== 'description' || show[key].length), `${key} inválido`);
    }
    check(Array.isArray(show.categories) && show.categories.length && show.categories.every((value) => categories.has(value)) &&
      new Set(show.categories).size === show.categories.length, 'categories inválido ou duplicado');
    check(Array.isArray(show.prices) && show.prices.every((row) => nonempty(row?.label) && typeof row.value === 'string'), 'prices inválido');
    check(Array.isArray(show.formation) && show.formation.every((row) => nonempty(row?.name) && typeof row.role === 'string'), 'formation inválido');
    check(Array.isArray(show.times) && show.times.length && show.times.every((row) => nonempty(row?.label) &&
      typeof row.value === 'string' && clock.test(row.value)), 'times deve conter horários HH:MM válidos');
    check(show.times.every((row, i) => (!i || row.value >= show.times[i - 1].value) &&
      (!isEnd(row) || i === show.times.length - 1)), 'times fora de ordem ou encerramento fora da última posição');

    const startsAt = inSaoPaulo(show.date, firstStart(show));
    const end = show.times.find(isEnd);
    const endsAt = end ? inSaoPaulo(show.date, end.value) : null;
    check(startsAt && (!end || (endsAt && Date.parse(endsAt) > Date.parse(startsAt))), 'início ou encerramento inválido');
    return { ...show, startsAt, endsAt };
  }).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.slug.localeCompare(b.slug));

  const today = buildDate ?? dateInSaoPaulo(now);
  const upcoming = shows.filter((show) => show.date >= today &&
    (buildDate || !show.endsAt || Date.parse(show.endsAt) > now.getTime()));
  return { today, shows, upcoming };
}
