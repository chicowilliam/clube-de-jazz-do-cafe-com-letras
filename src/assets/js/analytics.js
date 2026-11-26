/* Telemetria opcional. Somente categorias fixas atravessam a camada de eventos. */
(function () {
  'use strict';

  const config = document.currentScript.dataset;
  const direct = config.provider === 'ga4';
  const tagId = config.tagId;
  const optOutKey = 'ga-disable-' + tagId;
  const tagOrigin = 'https://www.googletagmanager.com';
  const forms = new Set(['newsletter', 'festival', 'eventos', 'escola']);
  const socials = new Map([
    ['instagram.com', 'instagram'], ['facebook.com', 'facebook'],
    ['youtube.com', 'youtube'], ['youtu.be', 'youtube'],
  ]);
  const page = {
    page_location: location.origin + config.page,
    page_referrer: location.origin + '/',
    page_title: 'Clube de Jazz do Café com Letras',
  };
  const denied = { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' };
  const granted = { ...denied, analytics_storage: 'granted' };
  let consent = false;
  let initialized = false;
  let layer;

  function gtag() {
    layer.push(arguments);
  }

  function emit(name, parameters = {}) {
    if (!consent) return;
    if (direct) gtag('event', name, parameters);
    else layer.push({ event: 'clube_' + name, ...parameters });
  }

  function setConsent(value) {
    if (typeof value !== 'boolean') return;
    const allowed = value && navigator.globalPrivacyControl !== true;
    if (allowed === consent) return;
    consent = allowed;
    if (direct) window[optOutKey] = !allowed;
    if (!allowed) {
      gtag('consent', 'update', denied);
      return;
    }
    if (initialized) {
      gtag('consent', 'update', granted);
      return;
    }

    initialized = true;
    layer = window.dataLayer = window.dataLayer || [];
    gtag('consent', 'default', denied);
    gtag('consent', 'update', granted);
    const options = { ...page, send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false };
    if (direct) {
      gtag('js', new Date());
      gtag('config', tagId, options);
    } else {
      layer.push(page);
      layer.push({ event: 'gtm.js', 'gtm.start': Date.now() });
    }
    if (config.pageviews === 'true') emit('page_view', page);

    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = tagOrigin + (direct ? '/gtag/js?id=' : '/gtm.js?id=') + encodeURIComponent(tagId);
    document.head.appendChild(script);
  }

  function trackClick(event) {
    if (!consent || (event.type === 'auxclick' && event.button !== 1)) return;
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    if (link.dataset.analytics === 'ticket') {
      emit('ticket_click');
      return;
    }
    const url = new URL(link.href, location.origin);
    const host = url.hostname.replace(/^www\./, '');
    if (url.protocol === 'https:' && (host === 'wa.me' || host === 'api.whatsapp.com' || host === 'web.whatsapp.com')) {
      emit('whatsapp_click');
    } else if (url.protocol === 'https:' && socials.has(host)) {
      emit('social_click', { network: socials.get(host) });
    } else if (url.origin === location.origin && /^\/shows\/[^/]+\/evento\.ics$/.test(url.pathname)) {
      emit('calendar_click');
    }
  }

  document.addEventListener('click', trackClick);
  document.addEventListener('auxclick', trackClick);
  window.clubeAnalytics = Object.freeze({
    setConsent,
    recordForm(type) {
      if (forms.has(type)) emit('form_success', { form_type: type });
    },
  });
})();
