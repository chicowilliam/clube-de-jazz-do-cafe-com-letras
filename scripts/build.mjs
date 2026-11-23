#!/usr/bin/env node
/**
 * Build do site do Clube de Jazz do Café com Letras.
 * Sem dependências: usa apenas Node.js (>= 18).
 *
 *  - Monta as páginas de src/pages com os partials (header/footer) e o <head> com SEO.
 *  - Gera a agenda, a Home e as páginas de show a partir de src/data/shows.json.
 *  - Gera sitemap.xml, robots.txt e um arquivo .ics por show.
 *  - Copia src/assets e public/ para dist/.
 *
 * Variáveis de ambiente (opcionais, ver .env.example):
 *  SITE_URL                    URL pública do site (padrão: src/data/site.json)
 *  CF_WEB_ANALYTICS_TOKEN      token do Cloudflare Web Analytics (insere o beacon)
 *  BUILD_DATE                  AAAA-MM-DD para simular "hoje" (padrão: data atual em America/Sao_Paulo)
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

const read = (p) => readFileSync(join(SRC, p), 'utf8');
const readJSON = (p) => JSON.parse(read(p));

const site = readJSON('data/site.json');
const { shows: ALL_SHOWS } = readJSON('data/shows.json');
const navStyles = readJSON('data/nav-styles.json');
const showParts = readJSON('templates/show-parts.json');

const SITE_URL = (process.env.SITE_URL || site.site_url_default).replace(/\/$/, '');
const CF_TOKEN = (process.env.CF_WEB_ANALYTICS_TOKEN || '').trim();
const TODAY = process.env.BUILD_DATE || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const partials = {
  header: read('partials/header.html'),
  headerHome: read('partials/header-home.html'),
  footer: read('partials/footer.html'),
  footerHome: read('partials/footer-home.html'),
};
const T = {
  homeNext: read('templates/home-next.html'),
  homeCard: read('templates/home-card.html'),
  homeEscola: read('templates/home-escola-row.html'),
  escolaRow: read('templates/escola-row.html'),
  agendaItem: read('templates/agenda-item.html'),
  show: read('templates/show.html'),
};

// ------------------------------------------------------------------ utilidades
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fill = (tpl, data) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in data ? data[k] : ''));
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MES3 = MESES.map((m) => m.slice(0, 3).replace('ç', 'c'));
const hora = (v) => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim()); return m ? `${Number(m[1])}h${m[2] === '00' ? '' : m[2]}` : v; };
const showUrl = (s) => `/shows/${s.slug}/`;
const parts = (s) => { const [y, m, d] = s.date.split('-'); return { y, m: Number(m), d }; };
const dayLabel = (s) => { const { m, d } = parts(s); return `${s.weekday}, ${d}/${String(m).padStart(2, '0')}`; };
const splitTitle = (t) => { const m = /^(.*?)(?::\s+|\s+-\s+)(.+)$/.exec(t); return m ? [m[1].trim(), m[2].trim()] : [t, '']; };
const isSympla = (s) => /sympla\.com\.br/.test(s.tickets_url);

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
function firstStart(s) {
  const set = s.times.find((t) => /primeiro|abertura/i.test(t.label) && !/abertura/i.test(t.label)) || s.times[0];
  return set ? set.value : '20:00';
}
function priceValue(v) {
  const m = /^R\$\s*(\d+)(?:,00)?$/.exec(String(v).trim());
  return m ? `R$ ${m[1]} por lugar` : v;
}
function subLine(s) {
  const [, rest] = splitTitle(s.title);
  return [rest, s.subtitle].filter(Boolean).join(' · ');
}

// ------------------------------------------------------------------ programação
const SHOWS = [...ALL_SHOWS].sort((a, b) => (a.date + firstStart(a)).localeCompare(b.date + firstStart(b)));
const UPCOMING = SHOWS.filter((s) => s.date >= TODAY);

// ------------------------------------------------------------------ <head>
function head({ title, description, path, image = '/assets/img/og-clube-de-jazz.jpg', jsonld = [], type = 'website' }) {
  const url = SITE_URL + path;
  const img = image.startsWith('http') ? image : SITE_URL + image;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n');
  const beacon = CF_TOKEN
    ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: CF_TOKEN })}'></script>`
    : '<!-- Cloudflare Web Analytics: defina CF_WEB_ANALYTICS_TOKEN no build para ativar -->';
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
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
<meta property="og:image" content="${img}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${img}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@1,400;1,500&display=swap">
<link rel="preload" href="/assets/fonts/SharpGrotesk-Black15.woff" as="font" type="font/woff" crossorigin>
<link rel="stylesheet" href="/assets/css/site.css">
<script defer src="/assets/js/site.js"></script>
${beacon}
${ld}`;
}

const VENUE = {
  '@type': 'MusicVenue',
  name: site.name,
  url: SITE_URL + '/',
  telephone: site.phone,
  email: site.email,
  image: SITE_URL + '/assets/img/fotos/hero-clube.jpg',
  address: {
    '@type': 'PostalAddress', streetAddress: site.address.street, addressLocality: site.address.city,
    addressRegion: site.address.region, postalCode: site.address.postal_code, addressCountry: site.address.country,
  },
  sameAs: Object.values(site.social),
};

function eventLD(s) {
  const [main] = splitTitle(s.title);
  const ev = {
    '@context': 'https://schema.org', '@type': 'MusicEvent', name: s.title,
    startDate: `${s.date}T${firstStart(s)}:00${site.timezone_offset}`,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'MusicVenue', name: site.name, address: VENUE.address },
    image: SITE_URL + s.image,
    description: (s.description.find((p) => p.length > 60) || s.description[0] || '').slice(0, 300),
    url: SITE_URL + showUrl(s),
    performer: { '@type': 'MusicGroup', name: main },
    organizer: { '@type': 'Organization', name: site.name, url: SITE_URL + '/' },
  };
  const p = s.prices.find((x) => /R\$/.test(x.value));
  if (p && isSympla(s)) {
    const n = /(\d+)/.exec(p.value);
    ev.offers = { '@type': 'Offer', price: n ? n[1] : undefined, priceCurrency: 'BRL', url: s.tickets_url };
  }
  return ev;
}

// ------------------------------------------------------------------ montagem
function layout({ body, headHtml, nav = null, home = false }) {
  let header = home ? partials.headerHome : partials.header;
  if (nav) {
    header = header.replace(`data-nav="${nav}" href`, `aria-current="page" data-nav="${nav}" href`)
      .replace(new RegExp(`(data-nav="${nav}" href="[^"]*" style=")[^"]*(")`), `$1${navStyles.on}$2`);
  }
  const footer = home ? partials.footerHome : partials.footer;
  const html = body.replace('<!--@header-->', header).replace('<!--@footer-->', footer);
  return `<!doctype html>\n<html lang="pt-BR">\n<head>\n${headHtml}\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
}

function out(path, html) {
  const file = path.endsWith('/') ? join(DIST, path, 'index.html') : join(DIST, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

function homeCard(s) {
  const [main] = splitTitle(s.title);
  return fill(T.homeCard, {
    title_attr: esc(s.title), image: s.image, day: esc(dayLabel(s)), title_main: esc(main), sub: esc(subLine(s)),
    times_short: esc(timesShort(s)), tickets_url: esc(s.tickets_url), tickets_label: esc(s.tickets_label), url: showUrl(s),
  });
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
  if (next) {
    const label = next.date === TODAY ? `Hoje no Clube · ${dayLabel(next)}` : `Próximo show · ${dayLabel(next)}`;
    const [main] = splitTitle(next.title);
    body = body.replace('<!--@home-next-->', fill(T.homeNext, {
      label: esc(label), title: esc(main), sub: esc(subLine(next)), times: esc(timesLong(next)),
      tickets_url: esc(next.tickets_url), tickets_label: esc(next.tickets_label), url: showUrl(next),
    }));
  } else body = body.replace('<!--@home-next-->', '');
  body = body.replace('<!--@home-week-->', UPCOMING.slice(0, 6).map(homeCard).join('\n'));
  const esc3 = UPCOMING.filter((s) => s.escola).slice(0, 3);
  body = body.replace('<!--@home-escola-->', esc3.map((s) => fill(T.homeEscola, { ddmm: ddmm(s), name: esc(escolaName(s)), when: esc(escolaWhen(s)) })).join('\n'));
  out('/', layout({
    body, home: true,
    headHtml: head({
      title: 'Clube de Jazz do Café com Letras · Jazz ao vivo na Savassi, BH',
      description: 'Clube de Jazz do Café com Letras: jazz e música instrumental ao vivo na Savassi, BH. Shows de terça a sábado, em dois sets, com ingressos online.',
      path: '/', jsonld: [{ '@context': 'https://schema.org', ...VENUE }],
    }),
  }));
}

// --- Agenda
function buildAgenda() {
  let body = read('pages/agenda.html');
  const items = UPCOMING.map((s) => {
    const { m, d } = parts(s);
    return fill(T.agendaItem, {
      cats: s.categories.join(' '), weekday: esc(s.weekday), dd: d, mon: MES3[m - 1], url: showUrl(s), title_attr: esc(s.title),
      image: s.image, title: esc(s.title), sub: esc(s.subtitle), times_long: esc(timesLong(s)), tags: esc(s.tags.join(' · ')),
      tickets_url: esc(s.tickets_url), tickets_label: esc(s.tickets_label),
    });
  });
  body = body.replace('{{count_label}}', `${UPCOMING.length} ${UPCOMING.length === 1 ? 'show' : 'shows'}`);
  body = body.replace('<!--@agenda-list-->', items.join('\n'));
  out('/agenda/', layout({
    body, nav: 'agenda',
    headHtml: head({
      title: 'Agenda de shows · Clube de Jazz do Café com Letras',
      description: 'Próximos shows de jazz e música instrumental no Clube de Jazz do Café com Letras, na Savassi, em Belo Horizonte.',
      path: '/agenda/', jsonld: [{ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement: UPCOMING.map((s, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE_URL + showUrl(s) })) }],
    }),
  }));
}

// --- Páginas de show
function buildShows() {
  for (const s of SHOWS) {
    const [main, sub] = splitTitle(s.title);
    const { m, d } = parts(s);
    let body = T.show;
    body = fill(body, {
      image: s.image, title_attr: esc(s.title), title_main: esc(main),
      eyebrow: esc(`${s.weekday}, ${Number(d)} de ${MESES[m - 1]}` + (s.subtitle && sub ? ` · ${s.subtitle}` : '')),
      aside_date: esc(`${Number(d)} ${MES3[m - 1]} · ${s.weekday.toLowerCase()}`),
      tickets_url: esc(s.tickets_url), tickets_label: esc(s.tickets_label),
      tickets_note: isSympla(s) ? 'Compra segura pelo Sympla' : 'Venda feita pelo parceiro do evento',
      ics_url: showUrl(s) + 'evento.ics', url: SITE_URL + showUrl(s),
    });
    const subText = sub || s.subtitle;
    body = body.replace('<!--@title-sub-->', subText ? fill(showParts['sub-p'], { text: esc(subText) }) : '');
    body = body.replace('<!--@description-->', s.description.map((p, i) => fill(i === 0 ? showParts['lead-p'] : showParts['desc-p'], { text: esc(p) })).join('\n'));
    if (s.formation.length) {
      const items = s.formation.map((f) => (f.role
        ? fill(showParts['formation-item'], { name: esc(f.name), role: esc(f.role) })
        : `<p style="grid-column: 1 / -1; margin: 24px 0 4px; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #DEAC00; font-weight: 600">${esc(f.name.charAt(0) + f.name.slice(1).toLowerCase())}</p>`)).join('\n');
      body = body.replace('<!--@formation-->', `${showParts['formation-h2']}\n${showParts['formation-grid-open']}\n${items}\n</div>`);
    } else body = body.replace('<!--@formation-->', '');
    body = body.replace('<!--@video-->', s.youtube ? fill(showParts['video-block'], { youtube: esc(s.youtube), title_attr: esc(s.title) }) : '');
    body = body.replace('<!--@bomsaber-->', isSympla(s) ? showParts['bomsaber-block'] : '');
    const rows = [
      ...timeRows(s),
      ...s.prices.map((p) => ({ label: p.value ? p.label.replace(/^Área (\w)/, (_, c) => 'Área ' + c.toLowerCase()) : p.label.charAt(0) + p.label.slice(1).toLowerCase(), value: p.value ? priceValue(p.value) : '' })),
    ];
    body = body.replace('<!--@aside-rows-->', rows.map((r, i) => fill(i === rows.length - 1 ? showParts['aside-row-last'] : showParts['aside-row'], { label: esc(r.label), value: esc(r.value) })).join('\n'));
    const more = UPCOMING.filter((x) => x.slug !== s.slug && x.date >= s.date).slice(0, 3);
    if (more.length) {
      body = body.replace('<!--@more-->', more.map((x) => fill(showParts['more-card'], { url: showUrl(x), day: esc(dayLabel(x)), title: esc(splitTitle(x.title)[0]) })).join('\n'))
        .replace('<!--@more-start-->', '').replace('<!--@more-end-->', '');
    } else {
      body = body.replace(/<!--@more-start-->[\s\S]*<!--@more-end-->/, '');
    }
    const desc = (s.description.find((p) => p.length > 60) || s.description[0] || s.title).replace(/\s+/g, ' ');
    out(showUrl(s), layout({
      body, nav: 'agenda',
      headHtml: head({
        title: `${s.title} · ${dayLabel(s)} · Clube de Jazz`,
        description: desc.length > 155 ? desc.slice(0, 152).replace(/\s+\S*$/, '') + '…' : desc,
        path: showUrl(s), image: s.image, type: 'article', jsonld: [eventLD(s)],
      }),
    }));
    out(showUrl(s) + 'evento.ics', ics(s));
  }
}

function ics(s) {
  const [y, m, d] = s.date.split('-');
  const [hh, mm] = firstStart(s).split(':');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const icsEsc = (t) => String(t).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Clube de Jazz do Cafe com Letras//Site//PT', 'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT', `UID:${s.slug}@clubedejazzdocafe.com`, `DTSTAMP:${stamp}`,
    `DTSTART;TZID=America/Sao_Paulo:${y}${m}${d}T${hh}${mm}00`,
    `SUMMARY:${icsEsc(s.title)}`,
    `LOCATION:${icsEsc(`${site.name}, ${site.address.street}, ${site.address.district}, ${site.address.city} - ${site.address.region}`)}`,
    `URL:${SITE_URL}${showUrl(s)}`,
    `DESCRIPTION:${icsEsc(`Ingressos: ${s.tickets_url}`)}`,
    'END:VEVENT', 'END:VCALENDAR', '',
  ].join('\r\n');
}

// --- Páginas estáticas
const STATIC = [
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
  const urls = ['/', '/agenda/', ...STATIC.map((p) => p.path), ...UPCOMING.map(showUrl)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${SITE_URL}${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  out('sitemap.xml', xml);
  out('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);
}

// ------------------------------------------------------------------ execução
rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
cpSync(join(ROOT, 'public'), DIST, { recursive: true });
cpSync(join(SRC, 'assets'), join(DIST, 'assets'), { recursive: true });
buildHome();
buildAgenda();
buildShows();
buildStatic();
buildSeoFiles();

const count = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(join(dir, e.name)) : 1), 0);
console.log(`Build concluído em dist/ — ${count(DIST)} arquivos · ${UPCOMING.length} shows na agenda (hoje = ${TODAY}) · SITE_URL = ${SITE_URL}${CF_TOKEN ? ' · analytics ativo' : ''}`);
