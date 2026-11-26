// Componentes públicos do V2, alimentados pela agenda oficial.
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const formatMonth = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const month = (m) => formatMonth.format(new Date(m.data + 'T00:00:00Z'));
const dataLonga = (m) => `${Number(m.dia)} de ${month(m)}`;

export const statusTag = (m) => ({
  hoje: '<span class="status status--hoje">Hoje</span>',
  encerrado: '<span class="status status--encerrado">Encerrado</span>',
  esgotado: '<span class="status status--esgotado">Esgotado</span>',
  ultimos: '<span class="status status--ultimos">Últimos lugares</span>',
}[m.status] || '');

export function botaoIngressos(m, { classe = '', bloco = false } = {}) {
  const cls = `btn${bloco ? ' btn--bloco' : ''}${classe ? ' ' + classe : ''}`;
  if (m.passado) return `<span class="${cls}" aria-disabled="true">Show encerrado</span>`;
  if (m.status === 'esgotado') return `<span class="${cls}" aria-disabled="true">Esgotado</span>`;
  return `<a class="${cls}" data-analytics="ticket" href="${esc(m.ingressos.url)}" target="_blank" rel="noopener">${esc(m.ingressos.rotulo)}<span class="sr-only"> para ${esc(m.nome)} (abre em nova aba)</span></a>`;
}

/* ------------------------------------------------------------ linha da programação */
export function gig(m, { foto = true, cabecalho = 'h3' } = {}) {
  const h = cabecalho;
  const info = [
    `<dl><div><dt>Horário</dt><dd class="gig__hora">${esc(m.horario)}</dd></div>`,
    m.precoPrincipal ? `<div><dt>Ingresso</dt><dd>${esc(m.precoPrincipal)}</dd></div>` : '',
    '</dl>',
  ].join('');
  return `<li class="gig${m.passado ? ' gig--passado' : ''}" data-cats="${esc(m.categorias.join(' '))}">
  <article class="gig__in">
    <time class="gig__data" datetime="${m.data}"><span class="sr-only">${esc(m.semana)}, ${dataLonga(m)}</span><span class="gig__dia" aria-hidden="true">${m.dia}</span><span class="gig__semana" aria-hidden="true">${esc(m.semanaCurta)}</span><span class="gig__mes" aria-hidden="true">${month(m).slice(0, 3)}</span></time>
    ${foto ? `<div class="gig__foto"><img src="${esc(m.imagem)}" alt="" width="600" height="510" loading="lazy" decoding="async"></div>` : ''}
    <div class="gig__corpo">
      <${h} class="gig__nome"><a href="${m.url}" aria-label="${esc(m.titulo)}">${esc(m.nome)}</a> ${statusTag(m)}</${h}>
      ${m.sub.length ? `<p class="gig__sub">${m.sub.map((part) => esc(part)).join(' · ')}</p>` : ''}
      ${m.tags ? `<p class="meta gig__tags">${esc(m.tags)}</p>` : ''}
    </div>
    <div class="gig__info">${info}<span class="gig__cta">${botaoIngressos(m, { classe: 'btn--pequeno' + (m.passado ? '' : ' btn--linha') })}</span></div>
  </article>
</li>`;
}

export const setlist = (lista, opts = {}) => `<ol class="setlist${opts.compacta ? ' setlist--compacta' : ''}" role="list">\n${lista.map((m) => gig(m, opts)).join('\n')}\n</ol>`;

/* ------------------------------------------------------------ destaque (próximo show) */
export function destaque(m) {
  const rotulo = m.status === 'hoje' ? 'Hoje no Clube' : 'Próximo show';
  return `<article class="destaque">
  <a class="destaque__foto" href="${m.url}" tabindex="-1" aria-hidden="true"><img src="${esc(m.imagem)}" alt="" width="600" height="510" loading="lazy" decoding="async"></a>
  <div>
    <p class="label">${rotulo}</p>
    <p class="destaque__data"><span class="num">${m.dia}/${String(m.mes).padStart(2, '0')}</span><span>${esc(m.semana.toLowerCase())}, ${esc(m.inicio)}</span></p>
    <h2 class="t-2"><a href="${m.url}" aria-label="${esc(m.titulo)}">${esc(m.nome)}</a></h2>
    ${m.sub.length ? `<p class="destaque__sub">${m.sub.map((part) => esc(part)).join(' · ')}</p>` : ''}
    <p class="meta destaque__horarios">${esc(m.horario)}</p>
    <div class="destaque__acoes">
      ${botaoIngressos(m)}
      ${m.precoPrincipal ? `<span class="meta">${esc(m.precoPrincipal)}</span>` : ''}
    </div>
    <p style="margin-top: var(--s5)"><a class="link-forte" href="${m.url}">Sobre o show</a></p>
  </div>
</article>`;
}

/* ------------------------------------------------------------ artistas */
export const artista = (m) => `<li class="artista"><a href="${m.url}">
  <div class="artista__foto"><img src="${esc(m.imagem)}" alt="" width="600" height="510" loading="lazy" decoding="async"></div>
  <h2 class="artista__nome">${esc(m.nomeCurto)}</h2>
  <p class="artista__quando">${esc(m.semana)}, ${dataLonga(m)}</p>
</a></li>`;

/* ------------------------------------------------------------ navegação */
export const NAV = [
  { key: 'agenda', href: '/agenda/', label: 'Agenda', desc: 'shows e ingressos' },
  { key: 'artistas', href: '/artistas/', label: 'Artistas', desc: 'quem toca' },
  { key: 'aovivo', href: '/ao-vivo/', label: 'Ao vivo', desc: 'no YouTube' },
  { key: 'escola', href: '/escola-do-jazz/', label: 'Escola do Jazz', desc: 'formação' },
  { key: 'festivais', href: '/festivais/', label: 'Festivais', desc: '2027' },
  { key: 'clube', href: '/o-clube/', label: 'O Clube', desc: 'história e apoio' },
  { key: 'visite', href: '/visite/', label: 'Visite', desc: 'endereço, horários, cardápio' },
];
const NAV_EXTRA = [
  { key: 'cardapio', href: '/cardapio/', label: 'Cardápio e bar' },
  { key: 'eventos', href: '/eventos/', label: 'Eventos e empresas' },
  { key: 'amigos', href: '/o-clube/#amigos', label: 'Amigos do Clube' },
];

const LOGO = '<img src="/assets/img/marca/logo-clube-de-jazz-branco.png" alt="Clube de Jazz do Café com Letras" width="720" height="363">';
export const chancela = () => `<div class="chancela"><span class="chancela__rotulo">Patrocínio</span>
  <a href="https://captamed.com.br" target="_blank" rel="noopener"><img src="/assets/img/patrocinio/captamed-branco.png" alt="CaptaMed" width="900" height="246"></a>
  <a href="https://mipengenharia.com.br" target="_blank" rel="noopener"><img class="mip" src="/assets/img/patrocinio/grupo-mip-branco.png" alt="Grupo MIP" width="504" height="231"></a>
</div>`;

export function topo(ativo, { home = false } = {}) {
  const itens = NAV.map((n) => `<li><a href="${n.href}"${n.key === ativo ? ' aria-current="page"' : ''}>${n.label}</a></li>`).join('');
  return `<a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
<header class="topo${home ? ' topo--sobre' : ''}">
  <div class="wrap topo__in">
    <a class="topo__logo" href="/">${LOGO}</a>
    <nav class="nav" aria-label="Principal"><ul>${itens}</ul></nav>
    ${home ? `<div class="topo__acoes topo__chancela">${chancela()}</div>` : ''}
  </div>
</header>`;
}

/* Barra inferior do celular: a ação principal muda conforme a página */
export function dock(primaria) {
  if (primaria === false) return '<div class="dock dock--so-menu"><button class="btn btn--linha dock__menu" type="button" aria-expanded="false" aria-controls="menu" data-menu-abrir>Menu</button></div>';
  const p = primaria || { href: '/agenda/', label: 'Ver a agenda' };
  const acao = p.html || `<a class="btn" href="${esc(p.href)}"${p.externo ? ' target="_blank" rel="noopener"' : ''}>${esc(p.label)}</a>`;
  return `<div class="dock">${acao}<button class="btn btn--linha dock__menu" type="button" aria-expanded="false" aria-controls="menu" data-menu-abrir>Menu</button></div>`;
}

export function folha(ativo, site) {
  const itens = [...NAV, ...NAV_EXTRA.map((n) => ({ ...n, desc: '', sec: true }))]
    .map((n) => `<li${n.sec ? ' class="folha__sec"' : ''}><a href="${n.href}"${n.key === ativo ? ' aria-current="page"' : ''}>${n.label}${n.desc ? `<small>${n.desc}</small>` : ''}</a></li>`).join('');
  return `<div class="folha" id="menu" role="dialog" aria-modal="true" aria-label="Menu" hidden>
  <div class="folha__topo"><a href="/">${LOGO}</a></div>
  <nav aria-label="Menu do celular"><ul>${itens}</ul></nav>
  <div class="folha__info">
    <p>${esc(site.address.street)}, ${esc(site.address.district)}</p>
    <p>Terça a sábado, a partir das 19h</p>
  </div>
  <button class="btn btn--bloco folha__fechar" type="button" data-menu-fechar>Fechar menu</button>
</div>`;
}

export const whatsapp = (site) => {
  const num = site.phone.replace(/\D/g, '');
  return `<a class="wa" href="https://wa.me/${num}" target="_blank" rel="noopener" aria-label="Falar com o Clube pelo WhatsApp (abre em nova aba)">
  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>
</a>`;
};

export function rodape(site) {
  const fone = site.phone.replace('+55 ', '').replace(/^(\d{2}) /, '($1) ');
  const mapa = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.name}, ${site.address.street}, ${site.address.city}`)}`;
  return `<footer class="rodape">
  <div class="wrap">
    <div class="rodape__grade">
      <section class="rodape__nl" id="newsletter" aria-labelledby="nl-titulo">
        <h2 id="nl-titulo">A programação da semana, toda segunda, no seu e-mail</h2>
        <form data-form="newsletter" novalidate>
          <label class="sr-only" for="nl-email">Seu e-mail</label>
          <div class="linha">
            <input id="nl-email" name="email" type="email" autocomplete="email" placeholder="Seu e-mail" required>
            <button class="btn" type="submit">Assinar a newsletter</button>
          </div>
          <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
          <p class="form-status" data-form-status="" role="status" aria-live="polite"></p>
        </form>
      </section>
      <section class="rodape__col" aria-labelledby="r-visite">
        <h2 id="r-visite">Visite</h2>
        <address>${esc(site.address.street)}<br>${esc(site.address.district)} · ${esc(site.address.city)} · ${esc(site.address.region)}<br>CEP ${esc(site.address.postal_code)}</address>
        <p style="margin-top: var(--s3)">Terça a sábado, a partir das 19h</p>
        <p><a class="link" href="${mapa}" target="_blank" rel="noopener">Abrir no mapa</a></p>
      </section>
      <nav class="rodape__col" aria-labelledby="r-clube">
        <h2 id="r-clube">O Clube</h2>
        <ul>
          ${NAV.map(({ href, label }) => `<li><a class="link" href="${href}">${label}</a></li>`).join('')}
          <li><a class="link" href="/cardapio/">Cardápio e bar</a></li>
          <li><a class="link" href="/eventos/">Eventos e empresas</a></li>
          <li><a class="link" href="/o-clube/#amigos">Amigos do Clube</a></li>
          <li><a class="link" href="/visite/#perguntas">Perguntas frequentes</a></li>
        </ul>
      </nav>
      <section class="rodape__col" aria-labelledby="r-contato">
        <h2 id="r-contato">Fale com o Clube</h2>
        <ul>
          <li><a class="link" href="tel:${esc(site.phone.replace(/\s/g, ''))}">${esc(fone)}</a></li>
          <li><a class="link" href="mailto:${esc(site.email)}">${esc(site.email)}</a></li>
          <li><a class="link" href="mailto:curadoria@clubedejazzdocafe.com">Curadoria: curadoria@clubedejazzdocafe.com</a></li>
        </ul>
        <h2 class="rodape__social">Acompanhe</h2>
        <ul>
          <li><a class="link" href="${site.social.youtube}" target="_blank" rel="noopener">YouTube · ao vivo</a></li>
          <li><a class="link" href="${site.social.instagram}" target="_blank" rel="noopener">Instagram</a></li>
          <li><a class="link" href="${site.social.facebook}" target="_blank" rel="noopener">Facebook</a></li>
        </ul>
      </section>
    </div>
    <div class="rodape__base">
      <div style="display: grid; gap: var(--s3)">
        <a href="/">${LOGO.replace('<img ', '<img class="logo" loading="lazy" ')}</a>
        <p>Realização: Instituto Cidades Criativas</p>
        <p>Clube de Jazz do Café com Letras · Belo Horizonte</p>
      </div>
      ${chancela().replace(/<img /g, '<img loading="lazy" ')}
    </div>
  </div>
</footer>`;
}
