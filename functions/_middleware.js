import { dateInSaoPaulo } from '../scripts/schedule-clock.mjs';
import variantsByPath from '../scripts/schedule-data.generated.mjs';

export async function serveSchedule({ request, env, next }, now = Date.now()) {
  const { pathname } = new URL(request.url);
  if (pathname.startsWith('/_programacao/')) return new Response(null, { status: 404 });

  const variants = variantsByPath[pathname];
  if (!variants || (request.method !== 'GET' && request.method !== 'HEAD')) return next();

  const today = dateInSaoPaulo(now);
  const chosen = variants.findLast(([date, end]) => date < today || (date === today && (end === null || end <= now)));
  const url = new URL((chosen ?? variants[0])[2], request.url);
  const asset = await env.ASSETS.fetch(new Request(url, { method: request.method, redirect: 'manual' }));
  const headers = new Headers(asset.headers);
  headers.set('Cache-Control', 'no-store');
  if (asset.status !== 200) {
    headers.delete('Content-Encoding');
    headers.delete('Content-Length');
    return new Response(null, { status: 503, headers });
  }
  return new Response(asset.body, { headers });
}

export function onRequest(context) {
  return serveSchedule(context);
}
