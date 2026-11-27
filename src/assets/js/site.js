/* Clube de Jazz do Café com Letras — interações do site (JavaScript puro, sem dependências).
   1. Slideshow da abertura da Home
   2. Filtro por estilo na Agenda
   3. Abas Cozinha / Bar no Cardápio
   4. Envio dos formulários para /api/forms (Cloudflare Pages Function)
   5. Botão "Compartilhar" das páginas de show
   6. Menu em tela cheia no celular */
(function () {
  'use strict';

  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var reduzir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. Menu do celular ------------------------------------------------- */
  function menu() {
    var folha = document.querySelector('#menu');
    var page = document.querySelector('#site-page');
    if (!folha) return;
    var abrir = $$('[data-menu-abrir]');
    var ultimoFoco = null;
    function focaveis() { return $$('a[href], button:not([disabled])', folha); }
    function fechar() {
      folha.hidden = true;
      if (page) page.inert = false;
      document.documentElement.style.overflow = '';
      abrir.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); });
      if (ultimoFoco) ultimoFoco.focus();
    }
    function abre(e) {
      ultimoFoco = e.currentTarget;
      folha.hidden = false;
      if (page) page.inert = true;
      document.documentElement.style.overflow = 'hidden';
      abrir.forEach(function (b) { b.setAttribute('aria-expanded', 'true'); });
      var atual = folha.querySelector('[aria-current="page"]') || focaveis()[0];
      if (atual) atual.focus();
    }
    abrir.forEach(function (b) { b.addEventListener('click', abre); });
    $$('[data-menu-fechar]', folha).forEach(function (b) { b.addEventListener('click', fechar); });
    folha.addEventListener('click', function (e) { if (e.target.closest('a')) fechar(); });
    document.addEventListener('keydown', function (e) {
      if (folha.hidden) return;
      if (e.key === 'Escape') { fechar(); return; }
      if (e.key === 'Tab') { // mantém o foco dentro do menu
        var f = focaveis(); var primeiro = f[0]; var ultimo = f[f.length - 1];
        if (e.shiftKey && document.activeElement === primeiro) { ultimo.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === ultimo) { primeiro.focus(); e.preventDefault(); }
      }
    });
    window.matchMedia('(min-width: 900px)').addEventListener('change', function (mq) { if (mq.matches && !folha.hidden) fechar(); });
  }

  /* 2. Abertura (troca de fotos) -------------------------------------- */
  function abertura() {
    var fotos = $$('.abertura__fotos [data-foto]');
    if (fotos.length < 2) return;
    var whatsapp = document.querySelector('.wa');
    if (whatsapp && 'IntersectionObserver' in window) {
      var hero = fotos[0].closest('.abertura');
      new IntersectionObserver(function (entries) {
        var entry = entries[entries.length - 1];
        whatsapp.classList.toggle('wa--visivel', !entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
      }).observe(hero);
    }
    var pontos = $$('[data-ponto]');
    var credito = document.querySelector('[data-credito]');
    var atual = 0, timer = null;
    function mostra(n) {
      atual = (n + fotos.length) % fotos.length;
      fotos.forEach(function (img, i) {
        if (i === atual && img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); }
        img.classList.toggle('ativa', i === atual);
        img.setAttribute('aria-hidden', String(i !== atual));
      });
      pontos.forEach(function (b, i) { b.setAttribute('aria-pressed', i === atual ? 'true' : 'false'); });
      if (credito) credito.textContent = fotos[atual].getAttribute('data-credito-texto') || '';
    }
    function inicia() { if (reduzir || document.hidden) return; para(); timer = setInterval(function () { mostra(atual + 1); }, 7000); }
    function para() { if (timer) clearInterval(timer); timer = null; }
    pontos.forEach(function (b, i) { b.addEventListener('click', function () { mostra(i); inicia(); }); });
    document.addEventListener('visibilitychange', function () { document.hidden ? para() : inicia(); });
    mostra(0); inicia();
  }

  /* 3. Filtro da agenda ------------------------------------------------ */
  function filtro() {
    var chips = $$('[data-filtro]');
    if (!chips.length) return;
    var itens = $$('.gig[data-cats]', document.querySelector('[data-agenda]'));
    var meses = $$('[data-mes]');
    var contador = document.querySelector('[data-contagem]');
    var vazio = document.querySelector('[data-filtro-vazio]');
    function aplica(k) {
      var n = 0;
      itens.forEach(function (it) {
        var ok = k === 'todos' || (' ' + it.getAttribute('data-cats') + ' ').indexOf(' ' + k + ' ') >= 0;
        it.hidden = !ok; if (ok) n++;
      });
      meses.forEach(function (m) { m.hidden = !m.querySelector('.gig:not([hidden])'); });
      chips.forEach(function (c) { c.setAttribute('aria-pressed', c.getAttribute('data-filtro') === k ? 'true' : 'false'); });
      if (contador) contador.textContent = n + (n === 1 ? ' show' : ' shows');
      if (vazio) vazio.hidden = n > 0;
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        aplica(c.dataset.filtro);
        if (c.closest('[data-filtro-vazio]') && vazio.hidden) chips[0].focus();
      });
    });
    aplica('todos');
  }

  /* 4. Abas do cardápio ------------------------------------------------ */
  function initTabs() {
    var list = document.querySelector('[role="tablist"]');
    if (!list) return;
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[data-tab]'));
    function select(key, focus) {
      tabs.forEach(function (t) {
        var active = t.getAttribute('data-tab') === key;
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.setAttribute('tabindex', active ? '0' : '-1');
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
        if (active && focus) t.focus();
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () {
        select(t.dataset.tab);
        history.replaceState(null, '', '#' + t.dataset.tab);
      });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          select(tabs[n].dataset.tab, true);
          history.replaceState(null, '', '#' + tabs[n].dataset.tab);
          e.preventDefault();
        }
      });
    });
    function selectFromHash() {
      var target = document.getElementById(location.hash.slice(1));
      select(target && target.closest('[data-panel=bar]') ? 'bar' : 'cozinha');
    }
    list.hidden = false;
    selectFromHash();
    window.addEventListener('hashchange', selectFromHash);
  }

  /* 4. Formulários ------------------------------------------------------ */
  async function getTurnstileToken(form, sitekey, action) {
    var api = window.turnstile;
    if (!api) throw new Error();

    var container = document.createElement('div');
    container.style.position = 'absolute';
    form.appendChild(container);
    var widget;
    var timer;
    try {
      return await new Promise(function (resolve, reject) {
        var fail = function () { reject(new Error()); };
        timer = setTimeout(fail, 15000);
        widget = api.render(container, {
          sitekey: sitekey,
          action: action,
          retry: 'never',
          'response-field': false,
          callback: resolve,
          'error-callback': function () { fail(); return true; },
          'expired-callback': fail,
          'timeout-callback': fail
        });
      });
    } finally {
      clearTimeout(timer);
      try {
        if (widget != null) api.remove(widget);
      } finally {
        container.remove();
      }
    }
  }

  function initForms() {
    var turnstileScript = document.querySelector('script[data-turnstile-sitekey]');
    var sitekey = turnstileScript && turnstileScript.getAttribute('data-turnstile-sitekey');
    var forms = Array.prototype.slice.call(document.querySelectorAll('form[data-form]'));
    forms.forEach(function (form) {
      var status = form.querySelector('[data-form-status]') ||
        (form.nextElementSibling && form.nextElementSibling.hasAttribute('data-form-status') ? form.nextElementSibling : null);
      function say(msg, state) {
        if (!status) return;
        status.textContent = msg;
        status.setAttribute('data-state', state);
      }
      var sending = false;
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (sending) return;
        var email = form.querySelector('input[type="email"]');
        if (email && !email.checkValidity()) {
          say('Informe um e-mail válido.', 'erro');
          email.focus();
          return;
        }
        var data = { form: form.getAttribute('data-form'), page: location.pathname };
        Array.prototype.forEach.call(form.elements, function (el) {
          if (el.name) data[el.name] = el.value;
        });
        var btn = form.querySelector('[type="submit"]');
        sending = true;
        if (btn) btn.disabled = true;
        say('Enviando…', 'enviando');
        try {
          if (sitekey && !data.website) {
            try {
              data['cf-turnstile-response'] = await getTurnstileToken(form, sitekey, data.form);
            } catch {
              say('Não foi possível verificar o envio. Tente novamente.', 'erro');
              return;
            }
          }
          var res = await fetch('/api/forms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          if (res.ok) {
            say('Recebemos sua mensagem. Obrigado!', 'ok');
            form.reset();
            if (!data.website && window.clubeAnalytics) {
              var outcome = await res.json().catch(function () { return null; });
              if (outcome && outcome.ok === true) window.clubeAnalytics.recordForm(data.form);
            }
          } else if (res.status === 503 || res.status === 404 || res.status === 405) {
            say('O envio pelo site ainda não está ativo. Escreva para contato@clubedejazzdocafe.com.', 'erro');
          } else {
            var body = await res.json().catch(function () { return {}; });
            say((body && body.message) || 'Não foi possível enviar agora. Tente novamente.', 'erro');
          }
        } catch {
          say('Sem conexão com o servidor. Tente novamente.', 'erro');
        } finally {
          sending = false;
          if (btn) btn.disabled = false;
        }
      });
    });
  }

  /* 5. Compartilhar ----------------------------------------------------- */
  function initShare() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-share]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var url = a.href;
        var title = document.title;
        if (navigator.share) {
          navigator.share({ title: title, url: url }).catch(function () {});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(url).then(function () {
            var old = a.textContent;
            a.textContent = 'Link copiado';
            setTimeout(function () { a.textContent = old; }, 2000);
          });
        }
      });
    });
  }

  /* Links ainda sem destino definido: não fazem nada e avisam no console */
  function initPending() {
    Array.prototype.forEach.call(document.querySelectorAll('a[data-pendente]'), function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.console) console.info('Link pendente:', a.getAttribute('data-pendente'), '(ver PENDENCIAS.md)');
      });
    });
  }

  async function initArchiveVideos() {
    var list = document.querySelector('[data-youtube-archive]');
    if (!list) return;
    var cards = list.querySelectorAll('.videos__card');
    try {
      var response = await fetch('/api/youtube?feed=archive');
      if (!response.ok) return;
      var data = await response.json();
      var videos = list.dataset.youtubeArchive === 'live' ? data.liveVideos : data.videos;
      if (!Array.isArray(videos) || videos.length !== cards.length) return;
      var dateFormat = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' });
      var numberFormat = new Intl.NumberFormat('pt-BR');
      cards.forEach(function (card, index) {
        var video = videos[index];
        card.href = video.url;
        card.querySelector('img').src = video.thumbnail;
        card.querySelector('.videos__titulo').textContent = video.title;
        var metadata = card.querySelector('.meta');
        if (metadata) {
          var date = new Date(video.date);
          var views = Number(video.views);
          metadata.textContent = [
            Number.isFinite(date.getTime()) ? dateFormat.format(date) : '',
            Number.isSafeInteger(views) ? numberFormat.format(views) + (views === 1 ? ' visualização' : ' visualizações') : '',
          ].filter(Boolean).join(' · ');
          metadata.hidden = !metadata.textContent;
        }
      });
    } catch {
      // Mantém os cards editoriais já renderizados.
    }
  }

  function init() {
    menu();
    abertura();
    filtro();
    initTabs();
    initForms();
    initShare();
    initPending();
    initArchiveVideos();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
