/* Clube de Jazz do Café com Letras — interações do site (JavaScript puro, sem dependências).
   1. Slideshow da abertura da Home
   2. Filtro por estilo na Agenda
   3. Abas Cozinha / Bar no Cardápio
   4. Envio dos formulários para /api/forms (Cloudflare Pages Function)
   5. Botão "Compartilhar" das páginas de show */
(function () {
  'use strict';

  /* 1. Slideshow ------------------------------------------------------- */
  function initHero() {
    var slides = Array.prototype.slice.call(document.querySelectorAll('[data-hero-slide]'));
    if (slides.length < 2) return;
    var dots = Array.prototype.slice.call(document.querySelectorAll('[data-hero-dot]'));
    var caption = document.querySelector('[data-hero-caption]');
    var current = 0;
    var timer = null;
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(n) {
      current = (n + slides.length) % slides.length;
      slides.forEach(function (img, i) {
        img.style.opacity = i === current ? '1' : '0';
        img.style.transform = 'scale(' + (i === current ? 1.06 : 1) + ')';
      });
      dots.forEach(function (btn, i) {
        var bar = btn.querySelector('span');
        btn.setAttribute('aria-pressed', i === current ? 'true' : 'false');
        if (bar) {
          bar.style.width = (i === current ? 36 : 12) + 'px';
          bar.style.background = i === current ? '#DEAC00' : 'rgba(242,236,225,0.45)';
        }
      });
      if (caption) caption.textContent = slides[current].getAttribute('data-caption') || '';
    }
    function start() { if (!reduce) { stop(); timer = setInterval(function () { show(current + 1); }, 6000); } }
    function stop() { if (timer) clearInterval(timer); timer = null; }

    dots.forEach(function (btn, i) {
      btn.addEventListener('click', function () { show(i); start(); });
    });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    show(0);
    start();
  }

  /* 2. Filtro da agenda ------------------------------------------------- */
  function initAgendaFilter() {
    var group = document.querySelector('[data-filter-group]');
    if (!group) return;
    var on = group.getAttribute('data-style-on');
    var off = group.getAttribute('data-style-off');
    var buttons = Array.prototype.slice.call(group.querySelectorAll('[data-filter]'));
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-cats]'));
    var count = document.querySelector('[data-count]');
    function apply(key) {
      var visible = 0;
      items.forEach(function (it) {
        var cats = (it.getAttribute('data-cats') || '').split(' ');
        var show = key === 'todos' || cats.indexOf(key) >= 0;
        it.hidden = !show;
        if (show) visible++;
      });
      buttons.forEach(function (b) {
        var active = b.getAttribute('data-filter') === key;
        b.setAttribute('aria-pressed', active ? 'true' : 'false');
        b.setAttribute('style', active ? on : off);
      });
      if (count) count.textContent = visible + (visible === 1 ? ' show' : ' shows');
    }
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-filter')); });
    });
  }

  /* 3. Abas do cardápio ------------------------------------------------- */
  function initTabs() {
    var list = document.querySelector('[role="tablist"]');
    if (!list) return;
    var on = list.getAttribute('data-style-on');
    var off = list.getAttribute('data-style-off');
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[data-tab]'));
    function select(key, focus) {
      tabs.forEach(function (t) {
        var active = t.getAttribute('data-tab') === key;
        t.setAttribute('aria-selected', active ? 'true' : 'false');
        t.setAttribute('tabindex', active ? '0' : '-1');
        t.setAttribute('style', active ? on : off);
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
        if (active && focus) t.focus();
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t.getAttribute('data-tab')); });
      t.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          var n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
          select(tabs[n].getAttribute('data-tab'), true);
          e.preventDefault();
        }
      });
    });
    var hash = (location.hash || '').replace('#', '');
    select(hash === 'bar' ? 'bar' : 'cozinha');
  }

  /* 4. Formulários ------------------------------------------------------ */
  function initForms() {
    var forms = Array.prototype.slice.call(document.querySelectorAll('form[data-form]'));
    forms.forEach(function (form) {
      var status = form.querySelector('[data-form-status]') ||
        (form.nextElementSibling && form.nextElementSibling.hasAttribute('data-form-status') ? form.nextElementSibling : null);
      function say(msg, state) {
        if (!status) return;
        status.textContent = msg;
        status.setAttribute('data-state', state);
      }
      form.addEventListener('submit', function (e) {
        e.preventDefault();
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
        if (btn) btn.disabled = true;
        say('Enviando…', 'enviando');
        fetch('/api/forms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (body) { return { ok: r.ok, status: r.status, body: body }; });
        }).then(function (res) {
          if (res.ok) {
            say('Recebemos sua mensagem. Obrigado!', 'ok');
            form.reset();
          } else if (res.status === 503 || res.status === 404 || res.status === 405) {
            say('O envio pelo site ainda não está ativo. Escreva para contato@clubedejazzdocafe.com.', 'erro');
          } else {
            say((res.body && res.body.message) || 'Não foi possível enviar agora. Tente novamente.', 'erro');
          }
        }).catch(function () {
          say('Sem conexão com o servidor. Tente novamente.', 'erro');
        }).then(function () { if (btn) btn.disabled = false; });
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

  function init() { initHero(); initAgendaFilter(); initTabs(); initForms(); initShare(); initPending(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
