const uploads = 'UUuiCi2BOYnrZ3ITCsRHIjtg';
const freshSeconds = 6 * 60 * 60;
const cycleSeconds = 48 * 60 * 60;
const retentionSeconds = 30 * 24 * 60 * 60;

async function youtube(resource, params, key, signal = AbortSignal.timeout(5000)) {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + resource);
  url.search = new URLSearchParams(params);
  const response = await fetch(url, {
    headers: { 'x-goog-api-key': key },
    signal,
  });
  if (!response.ok) throw new Error(String(response.status));
  const data = await response.json();
  if (!Array.isArray(data.items)) throw new Error('invalid_response');
  return data;
}

export async function latestVideos(key) {
  const { items } = await youtube('playlistItems', {
    part: 'snippet,contentDetails,status',
    playlistId: uploads,
    maxResults: '50',
    fields: 'items(status/privacyStatus,contentDetails(videoId,videoPublishedAt),snippet(title,thumbnails))',
  }, key);
  const videos = new Map();
  for (const { status, contentDetails, snippet } of items) {
    const { videoId: id, videoPublishedAt: date } = contentDetails ?? {};
    if (status?.privacyStatus !== 'public' || !/^[\w-]{11}$/.test(id ?? '') ||
        !Number.isFinite(Date.parse(date)) || !snippet?.title?.trim()) continue;
    const video = card(id, snippet);
    if (video) videos.set(id, { ...video, date });
  }
  return { scanned: items.length, publicVideos: videos.size, videos: [...videos.values()]
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 4) };
}

function card(id, snippet) {
  const thumbnails = snippet?.thumbnails;
  const thumbnail = [thumbnails?.high?.url, thumbnails?.medium?.url, thumbnails?.default?.url]
    .find((value) => /^https:\/\/i\.ytimg\.com\//.test(value ?? ''));
  if (thumbnail && snippet.title?.trim()) {
    return { id, thumbnail, title: snippet.title, url: 'https://www.youtube.com/watch?v=' + id };
  }
}

function rank(id, cycle) {
  let hash = cycle;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193);
  return Math.imul(hash ^ (hash >>> 16), 0x85ebca6b) >>> 0;
}

export async function archiveVideos(key, cycle, previous = []) {
  const signal = AbortSignal.timeout(20000);
  const ids = new Set();
  let pageToken;
  // Mantém a consulta abaixo do limite de subrequests do Workers Free.
  for (let page = 0; page < 40; page++) {
    const data = await youtube('playlistItems', {
      part: 'contentDetails,status', playlistId: uploads, maxResults: '50',
      fields: 'nextPageToken,items(status/privacyStatus,contentDetails/videoId)',
      ...(pageToken && { pageToken }),
    }, key, signal);
    for (const item of data.items) {
      const id = item.contentDetails?.videoId;
      if (item.status?.privacyStatus === 'public' && /^[\w-]{11}$/.test(id ?? '')) ids.add(id);
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  const excluded = new Set(previous.map(({ id }) => id));
  const candidates = [...ids].sort((a, b) =>
    Number(excluded.has(a)) - Number(excluded.has(b)) || rank(a, cycle) - rank(b, cycle) || a.localeCompare(b));
  const videos = [];
  for (let offset = 0; offset < Math.min(candidates.length, 150) && videos.length < 4; offset += 50) {
    const batch = candidates.slice(offset, offset + 50);
    const { items } = await youtube('videos', {
      part: 'snippet,status,contentDetails', id: batch.join(','),
      fields: 'items(id,snippet(title,thumbnails,liveBroadcastContent),status(privacyStatus,uploadStatus),contentDetails/regionRestriction)',
    }, key, signal);
    const byId = new Map(items.map((video) => [video.id, video]));
    for (const id of batch) {
      const video = byId.get(id);
      const region = video?.contentDetails?.regionRestriction;
      if (video?.status?.privacyStatus !== 'public' || video.status.uploadStatus !== 'processed' ||
          video.snippet?.liveBroadcastContent === 'upcoming' || region?.blocked?.includes('BR') ||
          (region?.allowed && !region.allowed.includes('BR'))) continue;
      const result = card(id, video.snippet);
      if (result) videos.push(result);
      if (videos.length === 4) break;
    }
  }
  if (videos.length < 4) throw new Error('insufficient_videos');
  return { videos };
}

function reply(snapshot, state, maxAge = 0) {
  return Response.json(snapshot ? { videos: snapshot.videos } : { error: 'youtube_unavailable' }, {
    status: snapshot ? 200 : 503,
    headers: {
      'Cache-Control': maxAge > 0 ? `public, max-age=${maxAge}` : 'no-store',
      'X-YouTube-Cache': state,
    },
  });
}

function log(event, status) {
  console.warn(JSON.stringify({ event, ...(status && { status }) }));
}

export async function onRequestGet({ env, request }) {
  const kv = env.YOUTUBE_CACHE;
  const archive = request && new URL(request.url).searchParams.get('feed') === 'archive';
  const cacheKey = `youtube:${archive ? 'archive' : 'uploads'}:v1:${uploads}`;
  if (!kv) {
    log('youtube_cache_unconfigured');
    return reply(null, 'unavailable');
  }
  const now = Date.now();
  const cycle = Math.floor(now / (cycleSeconds * 1000));
  const cycleRemaining = () => Math.max(0, Math.floor(((cycle + 1) * cycleSeconds * 1000 - Date.now()) / 1000));
  let saved;
  try {
    saved = await kv.get(cacheKey, 'json');
    if (saved && now - saved.fetchedAt >= retentionSeconds * 1000) saved = null;
    const remaining = saved && freshSeconds - Math.ceil((now - saved.fetchedAt) / 1000);
    if (archive ? saved?.cycle === cycle : remaining > 0) {
      return reply(saved, 'hit', archive ? cycleRemaining() : remaining);
    }
    if (!env.YOUTUBE_API_KEY || await kv.get(cacheKey + ':retry')) {
      return reply(saved, saved ? 'stale' : 'unavailable');
    }
  } catch {
    log('youtube_cache_read_failed');
    return reply(saved, saved ? 'stale' : 'unavailable');
  }

  let snapshot;
  try {
    const { videos } = archive
      ? await archiveVideos(env.YOUTUBE_API_KEY, cycle, saved?.videos)
      : await latestVideos(env.YOUTUBE_API_KEY);
    snapshot = { videos, fetchedAt: Date.now(), ...(archive && { cycle }) };
  } catch (error) {
    const status = /^\d{3}$/.test(error?.message ?? '') ? Number(error.message) : undefined;
    log('youtube_refresh_failed', status);
    try {
      await kv.put(cacheKey + ':retry', '1', { expirationTtl: status === 403 || status === 429 ? 3600 : 300 });
    } catch {
      log('youtube_cache_write_failed');
    }
    return reply(saved, saved ? 'stale' : 'unavailable');
  }
  try {
    await kv.put(cacheKey, JSON.stringify(snapshot), { expirationTtl: retentionSeconds });
  } catch {
    log('youtube_cache_write_failed');
  }
  return reply(snapshot, 'refresh', archive ? cycleRemaining() : freshSeconds);
}
