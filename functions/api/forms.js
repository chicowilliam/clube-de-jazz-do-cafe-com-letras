/**
 * Cloudflare Pages Function: recebe os formulários do site (newsletter, Amigos do Clube,
 * eventos corporativos, inscrição da Escola do Jazz) em POST /api/forms.
 *
 * NÃO guarda dados. Apenas valida e repassa o JSON para um webhook definido pelo Clube
 * (ex.: Make, Zapier, Google Apps Script, CRM, plataforma de e-mail).
 *
 * Variáveis (Cloudflare Pages > Settings > Environment variables — nunca no repositório):
 *   FORMS_WEBHOOK_URL     URL que recebe o POST (obrigatória para o envio funcionar)
 *   FORMS_WEBHOOK_SECRET  opcional; enviado no cabeçalho X-Clube-Secret
 *   ALLOWED_ORIGINS       opcional; lista separada por vírgula (ex.: https://clubedejazzdocafe.com)
 *
 * Sem FORMS_WEBHOOK_URL a função responde 503 e o site avisa o visitante que o envio
 * ainda não está ativo — nada é simulado como enviado.
 */
const FORMS = new Set(['newsletter', 'festival', 'eventos', 'escola']);
const MAX = 4000;

const json = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export async function onRequestPost({ request, env }) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (allowed.length && origin && !allowed.includes(origin)) return json(403, { ok: false, message: 'Origem não permitida.' });

  if (!env.FORMS_WEBHOOK_URL) return json(503, { ok: false, message: 'Envio ainda não configurado.' });

  let data;
  try {
    const text = await request.text();
    if (text.length > MAX) return json(413, { ok: false, message: 'Mensagem longa demais.' });
    data = JSON.parse(text);
  } catch {
    return json(400, { ok: false, message: 'Dados inválidos.' });
  }
  if (!data || typeof data !== 'object') return json(400, { ok: false, message: 'Dados inválidos.' });
  if (data.website) return json(200, { ok: true }); // campo-isca preenchido: robô; ignora em silêncio
  if (!FORMS.has(data.form)) return json(400, { ok: false, message: 'Formulário desconhecido.' });
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(data.email))) return json(400, { ok: false, message: 'Informe um e-mail válido.' });

  const clean = {};
  for (const [k, v] of Object.entries(data)) {
    if (k === 'website') continue;
    clean[k.slice(0, 40)] = String(v ?? '').slice(0, 1000);
  }
  clean.received_at = new Date().toISOString();

  const headers = { 'Content-Type': 'application/json' };
  if (env.FORMS_WEBHOOK_SECRET) headers['X-Clube-Secret'] = env.FORMS_WEBHOOK_SECRET;
  try {
    const r = await fetch(env.FORMS_WEBHOOK_URL, { method: 'POST', headers, body: JSON.stringify(clean) });
    if (!r.ok) return json(502, { ok: false, message: 'Não foi possível enviar agora. Tente novamente.' });
  } catch {
    return json(502, { ok: false, message: 'Não foi possível enviar agora. Tente novamente.' });
  }
  return json(200, { ok: true });
}

export function onRequest() {
  return json(405, { ok: false, message: 'Use POST.' });
}
