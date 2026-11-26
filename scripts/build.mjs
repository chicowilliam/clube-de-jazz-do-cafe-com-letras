#!/usr/bin/env node
/**
 * Build do site do Clube de Jazz do Café com Letras.
 * Sem dependências: usa apenas Node.js (>= 18).
 *
 *  - Monta as páginas de src/pages com os partials (header/footer) e o <head> com SEO.
 *  - Gera a agenda, a Home e as páginas de show a partir de src/data/shows.json.
 *  - Gera sitemap.xml, robots.txt e um arquivo .ics por show.
 *  - Publica assets referenciados com hash de conteúdo e copia public/ para dist/.
 *
 * Variáveis de ambiente (opcionais, ver .env.example):
 *  SITE_URL                    URL pública do site (padrão: src/data/site.json)
 *  CF_WEB_ANALYTICS_TOKEN      token do Cloudflare Web Analytics (insere o beacon)
 *  BUILD_DATE                  AAAA-MM-DD para simular "hoje" (padrão: data atual em America/Sao_Paulo)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { firstStart, prepareShows } from './shows.mjs';
import * as C from './components.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const read = (p) => readFileSync(join(SRC, p), 'utf8');
const readJSON = (p) => JSON.parse(read(p));

const site = readJSON('data/site.json');
const { today: TODAY, shows: SHOWS, upcoming: UPCOMING } = prepareShows(readJSON('data/shows.json'), {
  buildDate: process.env.BUILD_DATE || undefined,
  assetDir: new URL('../src/assets/', import.meta.url),
});
const showParts = readJSON('templates/show-parts.json');

const SITE_URL = (process.env.SITE_URL || site.site_url_default).replace(/\/$/, '');
const CF_TOKEN = (process.env.CF_WEB_ANALYTICS_TOKEN || '').trim();
const GA_ID = (process.env.GA4_MEASUREMENT_ID || '').trim();
const GTM_ID = (process.env.GTM_CONTAINER_ID || '').trim();
if (CF_TOKEN && !/^[\w-]+$/.test(CF_TOKEN)) throw new Error('CF_WEB_ANALYTICS_TOKEN inválido.');
if ((GA_ID && !/^G-[A-Z0-9]+$/.test(GA_ID)) || (GTM_ID && !/^GTM-[A-Z0-9]+$/.test(GTM_ID)) || (GA_ID && GTM_ID)) {
  throw new Error('Configure apenas GA4_MEASUREMENT_ID ou GTM_CONTAINER_ID com um ID válido.');
}
const GOOGLE_TAG_ORIGIN = 'https://www.googletagmanager.com';
const GOOGLE_ANALYTICS_ORIGIN = 'https://*.google-analytics.com';
const TURNSTILE_ENABLED = process.env.TURNSTILE_ENABLED === 'true';
const TURNSTILE_SITE_KEY = (process.env.TURNSTILE_SITE_KEY || '').trim();
if (TURNSTILE_ENABLED && !/^[A-Za-z0-9_-]+$/.test(TURNSTILE_SITE_KEY)) {
  throw new Error('Defina TURNSTILE_SITE_KEY para habilitar o Turnstile no build.');
}
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

const assetUrls = new Map();
function versionAsset(path) {
  if (assetUrls.has(path)) return assetUrls.get(path);

  const ext = extname(path);
  const source = readFileSync(join(SRC, path));
  // O hash do CSS inclui as URLs finais das fontes.
  const content = ext === '.css' || ext === '.js'
    ? rewriteAssets(source.toString('utf8'))
    : source;
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const url = `/static${path.slice('/assets'.length, -ext.length)}.${hash}${ext}`;
  const file = join(DIST, url);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  assetUrls.set(path, url);
  return url;
}

function rewriteAssets(text) {
  return text.replace(/(?<=[\s"'(=])((?:https?:\/\/[^/\s"'<>]+)?)(\/assets\/(?:[\w.-]+\/)*[\w.-]+\.\w+)/g,
    (url, origin, path) => !origin || origin === SITE_URL ? origin + versionAsset(path) : url);
}

const T = {
  homeEscola: read('templates/home-escola-row.html'),
  escolaRow: read('templates/escola-row.html'),
  show: read('templates/show.html'),
};

// ------------------------------------------------------------------ utilidades
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, data) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in data ? data[k] : ''));
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const hora = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim()); return m ? `${Number(m[1])}h${m[2] === '00' ? '' : m[2]}` : v; };
const showUrl = (s) => `/shows/${s.slug}/`;
const parts = (s) => { const [y, m, d] = s.date.split('-'); return { y, m: Number(m), d }; };
const dayLabel = (s) => { const { m, d } = parts(s); return `${s.weekday}, ${d}/${String(m).padStart(2, '0')}`; };
const splitTitle = (t) => { const m = /^(.*?)(?::\s+|\s+-\s+)(.+)$/.exec(t); return m ? [m[1].trim(), m[2].trim()] : [t, '']; };
const isSympla = (s) => {
  const host = new URL(s.tickets_url).hostname;
  return host === 'sympla.com.br' || host.endsWith('.sympla.com.br');
};

function timeRows(s) {
  return s.times.map((t) => {
    let label = t.label;
    if (/^abertura da casa$/i.test(label)) label = 'Casa abre';
    else if (/^primeiro set$/i.test(label)) label = '1º set';
    else if (/^segundo set$/i.test(label)) label = '2º set';
    else if (/^primeiro show/i.test(label)) label = '1º show' + label.replace(/^primeiro show\s*-?\s*/i, ' · ');
    else if (/^segundo show/i.test(label)) label = '2º show' + label.replace(/^segundo show\s*-?\s*/i, ' · ');
    return { label, value: hora(t.value) };
  });
}
function timesShort(s) {
  const end = s.times.find((t) => /encerramento/i.test(t.label));
  const open = s.times.find((t) => /abertura/i.test(t.label));
  if (end && open) return `${hora(open.value)} às ${hora(end.value)}`;
  return timeRows(s).filter((r) => r.label !== 'Casa abre').map((r) => `${r.label.split(' · ')[0]} ${r.value}`).join(' · ');
}
function timesLong(s) {
  const short = timesShort(s);
  if (s.times.some((t) => /encerramento/i.test(t.label))) return short;
  const open = s.times.find((t) => /abertura/i.test(t.label));
  return open ? `Casa abre ${hora(open.value)} · ${short}` : short;
}
function priceValue(v) {
  const m = /^R\$\s*(\d+)(?:,00)?$/.exec(String(v).trim());
  return m ? `R$ ${m[1]} por lugar` : v;
}

// ------------------------------------------------------------------ <head>
function head({ title, description, path, image, imageAlt = site.name, jsonld = [], type = 'website' }) {
  const url = SITE_URL + path;
  const img = SITE_URL + (image || '/assets/img/og-clube-de-jazz.jpg');
  const dimensions = image ? '' : '\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">';
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', ...o }).replace(/</g, '\\u003c')}</script>`).join('\n');
  const beacon = CF_TOKEN
    ? `<script defer referrerpolicy="no-referrer" src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: CF_TOKEN })}'></script>`
    : '<!-- Cloudflare Web Analytics: defina CF_WEB_ANALYTICS_TOKEN no build para ativar -->';
  const analyticsPage = path.startsWith('/shows/') ? '/shows/' : path;
  const google = GA_ID || GTM_ID
    ? `<script defer src="/assets/js/analytics.js" data-provider="${GA_ID ? 'ga4' : 'gtm'}" data-tag-id="${GA_ID || GTM_ID}" data-page="${analyticsPage}" data-pageviews="${!CF_TOKEN}"></script>`
    : '';
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0F0E0D">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="${site.locale}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">${dimensions}
<meta property="og:image:alt" content="${esc(imageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${img}">
<meta name="twitter:image:alt" content="${esc(imageAlt)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/Anton-Latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/Playfair-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
${google}
<script defer src="/assets/js/site.js"></script>
${beacon}
${ld}`;
}

const IDENTITY = {
  name: site.name,
  url: SITE_URL + '/',
  telephone: site.phone,
  email: site.email,
  address: {
    '@type': 'PostalAddress', streetAddress: site.address.street, addressLocality: site.address.city,
    addressRegion: site.address.region, postalCode: site.address.postal_code, addressCountry: site.address.country,
  },
  sameAs: Object.values(site.social),
};
const VENUE = {
  '@type': 'MusicVenue',
  '@id': `${SITE_URL}/#venue`,
  ...IDENTITY,
  image: SITE_URL + '/assets/img/fotos/hero-clube.jpg',
};
const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  ...IDENTITY,
  logo: SITE_URL + '/assets/img/marca/logo-clube-de-jazz-branco.png',
  location: { '@id': VENUE['@id'] },
};
const WEBSITE = {
  '@type': 'WebSite',
  '@id': `${SITE_URL}/#website`,
  name: site.name,
  url: SITE_URL + '/',
  inLanguage: site.locale.replace('_', '-'),
  publisher: { '@id': ORGANIZATION['@id'] },
};
const upcomingSlugs = new Set(UPCOMING.map((show) => show.slug));

function eventLD(s) {
  const url = SITE_URL + showUrl(s);
  const upcoming = upcomingSlugs.has(s.slug);
  const names = [...new Set(s.formation.filter(({ role }) => role.trim()).map(({ name }) => name))];
  const offers = upcoming && isSympla(s) ? s.prices.flatMap(({ label, value }) => {
    const match = /^R\$\s*(\d+(?:\.\d{3})*)(?:,(\d{2}))?$/.exec(value.trim());
    if (!match) return [];
    return [{
      '@type': 'Offer', name: label, url: s.tickets_url, priceCurrency: 'BRL',
      price: `${match[1].replaceAll('.', '')}.${match[2] ?? '00'}`,
    }];
  }) : [];
  return {
    '@type': 'MusicEvent', '@id': url + '#event', name: s.title,
    startDate: s.startsAt,
    ...(s.endsAt && { endDate: s.endsAt }),
    ...(upcoming && { eventStatus: 'https://schema.org/EventScheduled' }),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: VENUE,
    image: SITE_URL + s.image,
    description: s.description[0],
    url,
    ...(names.length && { performer: names.map((name) => ({ '@type': 'Person', name })) }),
    ...(offers.length && { offers }),
  };
}

function showBreadcrumb(show) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Agenda', item: SITE_URL + '/agenda/' },
      { '@type': 'ListItem', position: 2, name: show.title, item: SITE_URL + showUrl(show) },
    ],
  };
}

// ------------------------------------------------------------------ montagem
const DOCK = {
  agenda: false,
  aovivo: { href: site.social.youtube, label: 'Abrir o canal', externo: true },
  eventos: { href: '#orcamento', label: 'Pedir orçamento' },
  visite: { href: '#perguntas', label: 'Perguntas frequentes' },
};

function layout({ body, headHtml, nav = null, home = false, dock = DOCK[nav] }) {
  const html = `<div id="site-page">
${C.topo(nav, { home })}
<main id="conteudo" tabindex="-1">
${body}
</main>
${C.rodape(site)}
${C.dock(dock)}
${C.whatsapp(site)}
</div>
${C.folha(nav, site)}`;
  if (TURNSTILE_ENABLED && /<form\b[^>]*\bdata-form=/.test(html)) {
    headHtml = headHtml.replace('<script defer src="/assets/js/site.js">',
      `<script defer data-turnstile-sitekey="${TURNSTILE_SITE_KEY}" src="${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit"></script>\n<script defer src="/assets/js/site.js">`);
  }
  return rewriteAssets(`<!doctype html>\n<html lang="pt-BR">\n<head>\n${headHtml}\n</head>\n<body>\n${html}\n</body>\n</html>\n`);
}

function out(path, html) {
  const file = path.endsWith('/') ? join(DIST, path, 'index.html') : join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

function showView(s, { destaque = false } = {}) {
  const { m, d } = parts(s);
  const [nome, complemento] = splitTitle(s.title);
  const passado = !upcomingSlugs.has(s.slug);
  const availability = ['esgotado', 'ultimos'].includes(s.availability) ? s.availability : '';
  const primaryPrice = s.prices.find((p) => /área interna|salão/i.test(p.label) && p.value)
    || s.prices.find((p) => p.value);
  return {
    data: s.date, dia: d, mes: m, semana: s.weekday, semanaCurta: s.weekday.slice(0, 3).toLowerCase(),
    nome, titulo: s.title, nomeCurto: escolaName(s), sub: [complemento, s.subtitle].filter(Boolean),
    imagem: s.image, url: showUrl(s), categorias: s.categories,
    tags: s.tags.join(' · '), inicio: hora(firstStart(s)), horario: destaque ? timesLong(s) : timesShort(s),
    precoPrincipal: primaryPrice?.value || '',
    passado,
    status: passado ? 'encerrado' : availability || (s.date === TODAY ? 'hoje' : ''),
    ingressos: { url: s.tickets_url, rotulo: s.tickets_label },
  };
}
function escolaName(s) {
  if (/^Escola do Jazz$/i.test(s.title.trim())) return s.subtitle.replace(/^com a\s+/i, '').replace(/^./, (c) => c.toUpperCase());
  return splitTitle(s.title)[0];
}
function escolaWhen(s, long) {
  if (s.times.some((t) => /encerramento/i.test(t.label))) return `${s.weekday} · ${timesShort(s)}`;
  const set = s.times.find((t) => /primeiro set/i.test(t.label));
  const open = s.times.find((t) => /abertura/i.test(t.label));
  return long && open && set ? `${s.weekday} · casa abre ${hora(open.value)} · show às ${hora(set.value)}` : `${s.weekday} · ${hora(set ? set.value : firstStart(s))}`;
}
const ddmm = (s) => { const { m, d } = parts(s); return `${d}/${String(m).padStart(2, '0')}`; };

// --- Home
function buildHome() {
  let body = read('pages/index.html');
  const next = UPCOMING[0];
  const todayShow = next?.date === TODAY ? next : null;
  const openingLink = todayShow
    ? `<p class="abertura__hoje"><a href="${showUrl(todayShow)}"><span class="label">Hoje no Clube</span><strong>${esc(todayShow.title)}</strong></a></p>`
    : '';
  body = body.replace('<!--@chancela-->', C.chancela())
    .replace('<!--@home-hoje-->', openingLink)
    .replace('<!--@home-next-->', next ? C.destaque(showView(next, { destaque: true })) : '<p class="vazio">Em breve, novas datas na agenda.</p>')
    .replace('<!--@home-week-->', C.setlist(UPCOMING.slice(0, 6).map((s) => showView(s))));
  const esc3 = UPCOMING.filter((s) => s.escola).slice(0, 3);
  body = body.replace('<!--@home-escola-->', esc3.map((s) => fill(T.homeEscola, { ddmm: ddmm(s), name: esc(escolaName(s)), when: esc(escolaWhen(s)) })).join('\n'));
  out('/', layout({
    body, home: true,
    headHtml: head({
      title: 'Clube de Jazz do Café com Letras · Jazz ao vivo na Savassi, BH',
      description: 'Clube de Jazz do Café com Letras, na Savassi, em Belo Horizonte. Confira a agenda de jazz e música instrumental ao vivo e os ingressos de cada show.',
      path: '/', jsonld: [VENUE, ORGANIZATION, WEBSITE],
    }),
  }));
}

// --- Agenda
function buildAgenda() {
  let body = read('pages/agenda.html');
  const months = new Map();
  for (const show of UPCOMING) {
    const key = show.date.slice(0, 7);
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(showView(show));
  }
  const groups = [...months].map(([key, list]) => `<section class="agenda-mes" data-mes aria-labelledby="mes-${key}">
    <h2 class="mes" id="mes-${key}">${MESES[list[0].mes - 1]} ${key.slice(0, 4)}</h2>
    ${C.setlist(list)}
  </section>`).join('\n');
  const recent = SHOWS.filter((s) => !upcomingSlugs.has(s.slug)).slice(-6).reverse();
  body = body.replace('<!--@agenda-contagem-->', `${UPCOMING.length} ${UPCOMING.length === 1 ? 'show' : 'shows'}`)
    .replace('<!--@agenda-->', groups)
    .replace('<!--@agenda-passados-->', `<section class="secao secao--neutra" id="agenda-passados" aria-labelledby="agenda-passados-titulo"><div class="wrap">
      <div class="cabeca"><h2 class="t-2" id="agenda-passados-titulo">Arquivo de shows passados</h2></div>
      ${recent.length ? C.setlist(recent.map((s) => showView(s))) : '<p class="meta">Nenhum show anterior disponível.</p>'}
      <p class="secao-link"><a class="link-forte" href="/ao-vivo/">Perdeu algum? Assista no Ao vivo →</a></p>
    </div></section>`);
  out('/agenda/', layout({
    body, nav: 'agenda',
    headHtml: head({
      title: 'Agenda de shows · Clube de Jazz do Café com Letras',
      description: 'Próximos shows de jazz e música instrumental no Clube de Jazz do Café com Letras, na Savassi, em Belo Horizonte.',
      path: '/agenda/', jsonld: [{ '@type': 'ItemList', itemListElement: UPCOMING.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + showUrl(s) })) }],
    }),
  }));
}

// --- Páginas de show
function buildShows() {
  for (const s of SHOWS) {
    const [main] = splitTitle(s.title);
    const view = showView(s, { destaque: true });
    let body = T.show;
    body = fill(body, {
      image: s.image, title_attr: esc(s.title), title_main: esc(main),
      eyebrow: esc(s.weekday.toLowerCase() + ", " + (view.passado ? s.date.slice(0, 4) : view.inicio)),
      status: C.statusTag(view), ticket_button: C.botaoIngressos(view, { bloco: true }),
      ticket_note_hidden: view.passado ? ' hidden' : '',
      date_short: ddmm(s), full_date: esc(s.weekday + ', ' + Number(view.dia) + ' de ' + MESES[view.mes - 1] + ' de ' + s.date.slice(0, 4)),
      event_date: s.date,
      tickets_note: isSympla(s) ? 'Compra segura pelo Sympla' : 'Venda feita pelo parceiro do evento',
      ics_url: showUrl(s) + 'evento.ics', url: SITE_URL + showUrl(s),
    });
    const subText = view.sub.join(' · ');
    body = body.replace('<!--@title-sub-->', subText ? fill(showParts['sub-p'], { text: esc(subText) }) : '');
    body = body.replace('<!--@description-->', s.description.map((p, i) => fill(i === 0 ? showParts['lead-p'] : showParts['desc-p'], { text: esc(p) })).join('\n'));
    if (s.formation.length) {
      const items = s.formation.map((f) => (f.role
        ? fill(showParts['formation-item'], { name: esc(f.name), role: esc(f.role) })
        : `<li class="grupo">${esc(f.name)}</li>`)).join('\n');
      body = body.replace('<!--@formation-->', `${showParts['formation-h2']}\n${showParts['formation-grid-open']}\n${items}\n</ul></section>`);
    } else body = body.replace('<!--@formation-->', '');
    body = body.replace('<!--@video-->', s.youtube ? fill(showParts['video-block'], { youtube: esc(s.youtube), title_attr: esc(s.title) }) : '');
    body = body.replace('<!--@bomsaber-->', isSympla(s) ? showParts['bomsaber-block'] : '');
    const rows = [
      ...timeRows(s),
      ...s.prices.map((p) => ({ label: p.value ? p.label.replace(/^Área (\w)/, (_, c) => 'Área ' + c.toLowerCase()) : p.label.charAt(0) + p.label.slice(1).toLowerCase(), value: p.value ? priceValue(p.value) : '' })),
    ];
    body = body.replace('<!--@aside-rows-->', rows.map((r) => fill(r.value ? showParts['aside-row'] : showParts['aside-group'], { label: esc(r.label), value: esc(r.value) })).join('\n'));
    const more = UPCOMING.filter((x) => x.slug !== s.slug && x.startsAt >= s.startsAt).slice(0, 3);
    if (more.length) {
      body = body.replace('<!--@more-->', C.setlist(more.map((x) => showView(x))))
        .replace('<!--@more-start-->', '').replace('<!--@more-end-->', '');
    } else {
      body = body.replace(/<!--@more-start-->[\s\S]*<!--@more-end-->/, '');
    }
    const desc = (s.description.find((p) => p.length > 60) || s.description[0] || s.title).replace(/\s+/g, ' ');
    out(showUrl(s), layout({
      body, nav: 'agenda',
      dock: view.passado ? { href: '/agenda/', label: 'Ver a agenda' } : { html: C.botaoIngressos(view, { comPreco: true }) },
      headHtml: head({
        title: `${s.title} · ${dayLabel(s)}/${s.date.slice(0, 4)} · Clube de Jazz`,
        description: desc.length > 155 ? desc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : desc,
        path: showUrl(s), image: s.image, imageAlt: s.title, type: 'article', jsonld: [eventLD(s), showBreadcrumb(s)],
      }),
    }));
    out(showUrl(s) + 'evento.ics', ics(s));
  }
}

function foldCalendarLine(line) {
  let result = '';
  let bytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (bytes + size > 75) {
      result += '\r\n ';
      bytes = 1;
    }
    result += char;
    bytes += size;
  }
  return result;
}

function ics(s) {
  const utc = (value) => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const icsEsc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n?|\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clube de Jazz do Cafe com Letras//Site//PT', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${s.slug}@clubedejazzdocafe.com`, `DTSTAMP:${utc(new Date())}`,
    `DTSTART:${utc(s.startsAt)}`,
    ...(s.endsAt ? [`DTEND:${utc(s.endsAt)}`] : []),
    `SUMMARY:${icsEsc(s.title)}`,
    `LOCATION:${icsEsc(`${site.name}, ${site.address.street}, ${site.address.district}, ${site.address.city} - ${site.address.region}`)}`,
    `URL:${SITE_URL}${showUrl(s)}`,
    `DESCRIPTION:${icsEsc(`Ingressos: ${s.tickets_url}`)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(foldCalendarLine).join('\r\n');
}

// --- Páginas estáticas
const STATIC = [
  { src: 'artistas', path: '/artistas/', nav: 'artistas', title: 'Quem toca no Clube · Clube de Jazz do Café com Letras', description: 'Artistas e bandas da programação do Clube de Jazz do Café com Letras.' },
  { src: 'visite', path: '/visite/', nav: 'visite', title: 'Visite o Clube · Clube de Jazz do Café com Letras', description: 'Endereço, horários, cardápio e informações sobre ingressos no Clube de Jazz do Café com Letras.' },
  { src: 'ao-vivo', path: '/ao-vivo/', nav: 'aovivo', title: 'Ao vivo no Clube · Clube de Jazz do Café com Letras', description: 'Shows do Clube de Jazz transmitidos ao vivo no YouTube: discos na íntegra, música de Minas, Big Band do Clube e mais.' },
  { src: 'escola-do-jazz', path: '/escola-do-jazz/', nav: 'escola', title: 'A Escola do Jazz · Clube de Jazz do Café com Letras', description: 'Apresentações de escolas de música, masterclasses e ensaios abertos e gratuitos no Clube de Jazz do Café com Letras.' },
  { src: 'festivais', path: '/festivais/', nav: 'festivais', title: 'Festivais · Clube de Jazz do Café com Letras', description: 'Só Bigs, Festival de Big Bands (14 a 16/5/2027), e Piano Duo, Festival de Duos de Pianos (13 a 17/7/2027), no Clube de Jazz.' },
  { src: 'eventos', path: '/eventos/', nav: 'eventos', title: 'Eventos e empresas · Clube de Jazz do Café com Letras', description: 'Eventos corporativos com música ao vivo para até 97 pessoas no Clube de Jazz do Café com Letras, na Savassi.' },
  { src: 'cardapio', path: '/cardapio/', nav: 'cardapio', title: 'Cardápio e bar · Clube de Jazz do Café com Letras', description: 'Tira-gostos e porções, pratos, sobremesas, coquetéis autorais, vinhos e cervejas do Clube de Jazz do Café com Letras.' },
  { src: 'o-clube', path: '/o-clube/', nav: 'clube', title: 'O Clube e Amigos do Clube · Clube de Jazz do Café com Letras', description: 'Jazz de perto, no coração da Savassi. O Clube de Jazz do Café com Letras, o palco, as bandas residentes e o programa Amigos do Clube.' },
];
function buildStatic() {
  for (const p of STATIC) {
    let body = read(`pages/${p.src}.html`);
    if (p.src === 'artistas') {
      body = body.replace('<!--@artistas-->', UPCOMING.length
        ? `<ul class="artistas" role="list">${UPCOMING.map((s) => C.artista(showView(s))).join('\n')}</ul>`
        : '<p class="vazio">Em breve, novas datas na agenda.</p>');
    }
    if (p.src === 'escola-do-jazz') {
      const rows = UPCOMING.filter((s) => s.escola).slice(0, 4);
      body = body.replace('<!--@escola-list-->', rows.map((s) => fill(T.escolaRow, { ddmm: ddmm(s), name: esc(escolaName(s)), when: esc(escolaWhen(s, true)) })).join('\n'));
    }
    out(p.path, layout({ body, nav: p.nav, headHtml: head({ title: p.title, description: p.description, path: p.path }) }));
  }
  const notFound = layout({
    body: read('pages/404.html'),
    headHtml: head({ title: 'Página não encontrada · Clube de Jazz do Café com Letras', description: 'Página não encontrada.', path: '/404' }).replace('<link rel="canonical"', '<meta name="robots" content="noindex">\n<link rel="canonical"'),
  });
  out('404.html', notFound);
}

// --- sitemap e robots
function buildSeoFiles() {
  const paths = ['/', '/agenda/', ...STATIC.map((p) => p.path), ...SHOWS.map(showUrl)];
  const urlNodes = paths.map((path) => `  <url><loc>${esc(SITE_URL + path)}</loc></url>`);

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes.join('\n')}\n</urlset>\n`;
  out('sitemap.xml', xml);
  out('robots.txt', `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /404.html\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

// ------------------------------------------------------------------ execução
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'public'), DIST, { recursive: true });
if (TURNSTILE_ENABLED || CF_TOKEN || GA_ID || GTM_ID) {
  const headers = readFileSync(join(ROOT, 'public', '_headers'), 'utf8');
  writeFileSync(join(DIST, '_headers'), headers.replace(/^(\s*Content-Security-Policy:.*)$/m, (line) => {
    const additions = { 'script-src': [], 'connect-src': [], 'img-src': [] };
    if (CF_TOKEN) {
      additions['script-src'].push('https://static.cloudflareinsights.com');
      additions['connect-src'].push('https://cloudflareinsights.com');
    }
    if (GA_ID || GTM_ID) {
      additions['script-src'].push(GOOGLE_TAG_ORIGIN);
      additions['connect-src'].push(GOOGLE_TAG_ORIGIN, GOOGLE_ANALYTICS_ORIGIN, 'https://*.google.com');
      additions['img-src'].push(GOOGLE_TAG_ORIGIN, GOOGLE_ANALYTICS_ORIGIN);
    }
    if (TURNSTILE_ENABLED) additions['script-src'].push(TURNSTILE_ORIGIN);
    const csp = line.replace(/\b(script-src|connect-src|img-src) [^;]+/g, (directive, key) =>
      [directive, ...additions[key]].join(' '));
    return TURNSTILE_ENABLED ? `${csp}; frame-src ${TURNSTILE_ORIGIN}` : csp;
  }));
}
buildHome();
buildAgenda();
buildShows();
buildStatic();
buildSeoFiles();

const count = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(join(dir, e.name)) : 1), 0);
console.log(`Build concluído em dist/ — ${count(DIST)} arquivos · ${UPCOMING.length} shows na agenda (hoje = ${TODAY}) · SITE_URL = ${SITE_URL}${CF_TOKEN ? ' · analytics ativo' : ''}`);
