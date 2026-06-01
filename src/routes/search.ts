import type { QTConfig } from '../index';
import { DEFAULT_HIFI_INSTANCES, DEEZER_API } from '../config';
import { httpGet, formatQuery, findBestMatch,
         mapQobuzTrack, mapHifiTrack, mapQobuzAlbum, tidalQualityLabel } from '../utils';
import { fetchHifi } from './shared';
import { qobuzProxyGet } from './qobuz';

// ─── ISRC helpers ─────────────────────────────────────────────────────────────
async function getIsrcFromTidal(query: string, instances: string[]): Promise<any> {
  try {
    const data  = await fetchHifi('/search/?s=' + encodeURIComponent(query) + '&limit=30', instances);
    const arr   = data?.data?.items || data?.data?.tracks?.items || data?.tracks?.items || data?.data || [];
    const items = Array.isArray(arr) ? arr : (Array.isArray(data) ? data : []);
    const match = findBestMatch(items, query);
    if (match.item && match.score >= 100) {
      let isrc = match.item.isrc;
      if (!isrc) {
        try {
          const info = await fetchHifi('/info/?id=' + encodeURIComponent(match.item.id), instances);
          isrc = (info?.data || info || {}).isrc;
        } catch {}
      }
      return { isrc, track: match.item, source: 'tidal', score: match.score };
    }
    return null;
  } catch { return null; }
}

async function getIsrcFromDeezer(query: string): Promise<any> {
  try {
    const data = await httpGet(DEEZER_API + '/search/track', { q: query, limit: 25 }, 10000);
    if (!data?.data?.length) return null;
    const match = findBestMatch(data.data, query);
    if (match.item && match.score >= 100) {
      let isrc = match.item.isrc;
      if (!isrc) {
        try { isrc = (await httpGet(DEEZER_API + '/track/' + match.item.id, null, 5000)).isrc; } catch {}
      }
      return { isrc, track: match.item, source: 'deezer', score: match.score };
    }
    return null;
  } catch { return null; }
}

// ─── SEARCH TRACKS ────────────────────────────────────────────────────────────
export async function handleSearchTracks(config: QTConfig, query: string): Promise<any[]> {
  const cleanedQuery = formatQuery(query);
  const userQuality  = config.quality      || 'HIRES';
  const tidalQuality = config.tidalQuality || 'HIGH';
  const maxResults   = 25;

  const [isrcResults, hifiSeedData] = await Promise.all([
    Promise.race([
      Promise.all([
        getIsrcFromTidal(cleanedQuery, DEFAULT_HIFI_INSTANCES).catch(() => null),
        getIsrcFromDeezer(cleanedQuery).catch(() => null),
      ]),
      new Promise<[null, null]>(res => setTimeout(() => res([null, null]), 7000)),
    ]),
    Promise.race([
      fetchHifi('/search/?s=' + encodeURIComponent(cleanedQuery) + '&limit=' + maxResults, DEFAULT_HIFI_INSTANCES),
      new Promise(res => setTimeout(() => res(null), 6000)),
    ]).catch(() => null),
  ]);

  let qobuzTracks: any[] = [];
  try {
    const res   = await qobuzProxyGet('/track/search', { query: cleanedQuery, limit: 75 });
    const items = res?.tracks?.items || [];
    qobuzTracks = items.map((t: any) => mapQobuzTrack(t, userQuality)).filter(Boolean);
  } catch {}

  const [tidalMaster, deezerMaster] = isrcResults as [any, any];
  const bestMaster = tidalMaster && deezerMaster
    ? (tidalMaster.score >= deezerMaster.score ? tidalMaster : deezerMaster)
    : (tidalMaster || deezerMaster);

  let isrcTrack = null;
  const masterIsrc = bestMaster?.isrc || null;
  if (masterIsrc) {
    try {
      const res   = await qobuzProxyGet('/track/search', { query: masterIsrc, limit: 1 });
      const items = res?.tracks?.items || [];
      if (items.length > 0) isrcTrack = mapQobuzTrack(items[0], userQuality);
    } catch {}
  }

  const finalTracks: any[] = [];
  if (isrcTrack) {
    finalTracks.push(isrcTrack);
    for (const t of qobuzTracks) {
      if (finalTracks.length >= maxResults) break;
      if (t.id !== isrcTrack.id) finalTracks.push(t);
    }
  } else {
    finalTracks.push(...qobuzTracks.slice(0, maxResults));
  }

  if (finalTracks.length === 0) {
    try {
      const hd = hifiSeedData as any;
      const items: any[] = hd?.data?.items || hd?.data?.tracks?.items || hd?.data || [];
      (Array.isArray(items) ? items : []).slice(0, maxResults).forEach((item: any) => {
        const t = mapHifiTrack(item, tidalQuality);
        if (t) { t.audioQuality = tidalQualityLabel(tidalQuality) + ' · Fallback'; finalTracks.push(t); }
      });
    } catch {}
  }

  return finalTracks;
}

// ─── SEARCH (unified handler) ─────────────────────────────────────────────────
export async function handleSearch(config: QTConfig, query: string, filter?: string): Promise<any[]> {
  if (!filter || filter === 'tracks') return handleSearchTracks(config, query);

  if (filter === 'albums') {
    try {
      const cleaned = formatQuery(query);
      const [hifiRes, qobuzRes] = await Promise.allSettled([
        fetchHifi('/search/?s=' + encodeURIComponent(cleaned) + '&limit=50', DEFAULT_HIFI_INSTANCES),
        qobuzProxyGet('/album/search', { query: cleaned, limit: 100 }),
      ]);
      const results: any[] = [];
      if (hifiRes.status === 'fulfilled' && hifiRes.value) {
        const albums = hifiRes.value?.data?.albums?.items || hifiRes.value?.albums?.items || [];
        for (const a of (Array.isArray(albums) ? albums : [])) {
          if (!a?.id) continue;
          results.push({ id: 'hifi:' + String(a.id), title: a.title || 'Unknown', artist: a.artist?.name || '', artworkURL: null, year: a.releaseDate ? String(a.releaseDate).slice(0,4) : undefined });
        }
      }
      if (qobuzRes.status === 'fulfilled' && qobuzRes.value) {
        const items = qobuzRes.value?.albums?.items || [];
        const seen  = new Set(results.map(r => r.id));
        for (const a of items) {
          const mapped = mapQobuzAlbum(a);
          if (!mapped || seen.has(mapped.id)) continue;
          seen.add(mapped.id); results.push(mapped);
        }
      }
      return results.slice(0, 25);
    } catch { return []; }
  }

  if (filter === 'artists') {
    try {
      const cleaned = formatQuery(query);
      const [hifiRes, qobuzRes] = await Promise.allSettled([
        fetchHifi('/search/?s=' + encodeURIComponent(cleaned) + '&limit=25', DEFAULT_HIFI_INSTANCES),
        qobuzProxyGet('/artist/search', { query: cleaned, limit: 25 }),
      ]);
      const results: any[] = [];
      if (hifiRes.status === 'fulfilled' && hifiRes.value) {
        const artists = hifiRes.value?.data?.artists?.items || hifiRes.value?.artists?.items || [];
        for (const a of (Array.isArray(artists) ? artists : [])) {
          if (!a?.id) continue;
          results.push({ id: 'hifi:' + String(a.id), name: a.name || 'Unknown', artworkURL: null });
        }
      }
      if (qobuzRes.status === 'fulfilled' && qobuzRes.value) {
        const items = qobuzRes.value?.artists?.items || [];
        const seen  = new Set(results.map(r => r.name?.toLowerCase()));
        for (const a of items) {
          if (!a?.id) continue;
          const name = a.name || 'Unknown';
          if (!seen.has(name.toLowerCase())) {
            seen.add(name.toLowerCase());
            results.push({ id: String(a.id), name, artworkURL: a.image?.large || null });
          }
        }
      }
      return results.slice(0, 25);
    } catch { return []; }
  }

  return [];
}
