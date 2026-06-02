import type { QTConfig } from '../index';
import type { SearchResultItem, Track, SearchAlbum, SearchArtist } from '../types';
import { DEFAULT_HIFI_INSTANCES, DEEZER_API } from '../config';
import { httpGet, formatQuery, findBestMatch, mapQobuzTrack, mapHifiTrack, mapQobuzAlbum, tidalQualityLabel } from '../utils';
import { fetchHifi } from './shared';
import { qobuzProxyGet } from './qobuz';

const PROVIDER_ID = 'com.resonance.qobuz-tidal';

function mmss(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function qobuzArtwork(img: any, size = 600): string | null {
  if (!img) return null;
  const url: string = img.large || img.medium || img.small || img.thumbnail || '';
  return url ? url.replace(/_\d+\./, `_${size}.`) : null;
}

// Flat internal track -> Resonance Track
function toTrack(t: any): Track | null {
  if (!t?.id) return null;
  return {
    id: String(t.id).startsWith(PROVIDER_ID + ':') ? t.id : `${PROVIDER_ID}:${t.id}`,
    provider: PROVIDER_ID,
    title: t.title || 'Unknown',
    artists: [{ id: null, name: t.artist || 'Unknown Artist' }],
    album: t.album ? { id: t.albumId ? `${PROVIDER_ID}:${t.albumId}` : null, name: t.album } : null,
    duration: t.duration ? mmss(t.duration) : null,
    durationSeconds: typeof t.duration === 'number' ? t.duration : null,
    thumbnailURL: t.artworkURL || null,
    isExplicit: t.explicit === true,
  };
}

// Raw Qobuz API track object -> Resonance Track
function rawQobuzToTrack(t: any): Track | null {
  if (!t?.id) return null;
  const artistName = t.performer?.name || t.artist?.name || 'Unknown Artist';
  const artwork = qobuzArtwork(t.album?.image);
  return {
    id: `${PROVIDER_ID}:${t.id}`,
    provider: PROVIDER_ID,
    title: t.title || 'Unknown',
    artists: [{ id: null, name: artistName }],
    album: t.album?.title ? { id: t.album.id ? `${PROVIDER_ID}:${t.album.id}` : null, name: t.album.title } : null,
    duration: t.duration ? mmss(t.duration) : null,
    durationSeconds: t.duration ?? null,
    thumbnailURL: artwork,
    isExplicit: t.parental_warning === true,
  };
}

// ─── ISRC helpers ─────────────────────────────────────────────────────────────
async function getIsrcFromTidal(query: string): Promise<string | null> {
  try {
    const data  = await fetchHifi('/search/?s=' + encodeURIComponent(query) + '&limit=30', DEFAULT_HIFI_INSTANCES);
    const arr   = data?.data?.items || data?.data?.tracks?.items || data?.tracks?.items || data?.data || [];
    const items = Array.isArray(arr) ? arr : [];
    const match = findBestMatch(items, query);
    if (!match.item || match.score < 100) return null;
    let isrc = match.item.isrc;
    if (!isrc) {
      try {
        const info = await fetchHifi('/info/?id=' + encodeURIComponent(match.item.id), DEFAULT_HIFI_INSTANCES);
        isrc = (info?.data || info || {}).isrc;
      } catch {}
    }
    return isrc || null;
  } catch { return null; }
}

async function getIsrcFromDeezer(query: string): Promise<string | null> {
  try {
    const data = await httpGet(DEEZER_API + '/search/track', { q: query, limit: 25 }, 10000);
    if (!data?.data?.length) return null;
    const match = findBestMatch(data.data, query);
    if (!match.item || match.score < 100) return null;
    let isrc = match.item.isrc;
    if (!isrc) {
      try { isrc = (await httpGet(DEEZER_API + '/track/' + match.item.id, null, 5000)).isrc; } catch {}
    }
    return isrc || null;
  } catch { return null; }
}

// ─── Search: songs/tracks ─────────────────────────────────────────────────────
async function searchTracks(config: QTConfig, query: string): Promise<SearchResultItem[]> {
  const quality = config.quality || 'HIRES';
  const tidalQ  = config.tidalQuality || 'HIGH';
  const cleaned = formatQuery(query);
  const MAX = 25;

  // Fire Qobuz search + ISRC lookups in parallel
  const [qobuzRes, tidalIsrc, deezerIsrc] = await Promise.allSettled([
    qobuzProxyGet('/track/search', { query: cleaned, limit: 75 }),
    getIsrcFromTidal(cleaned),
    getIsrcFromDeezer(cleaned),
  ]);

  const rawQobuz: any[] = (qobuzRes.status === 'fulfilled' ? qobuzRes.value?.tracks?.items : null) || [];
  const isrc = (tidalIsrc.status === 'fulfilled' ? tidalIsrc.value : null)
    || (deezerIsrc.status === 'fulfilled' ? deezerIsrc.value : null);

  // ISRC pin: find the exact Qobuz match first
  let pinned: Track | null = null;
  if (isrc) {
    try {
      const r = await qobuzProxyGet('/track/search', { query: isrc, limit: 1 });
      const item = r?.tracks?.items?.[0];
      if (item) pinned = rawQobuzToTrack(item);
    } catch {}
  }

  const seen = new Set<string>();
  const results: SearchResultItem[] = [];

  if (pinned) {
    seen.add(pinned.id);
    results.push({ type: 'track', track: pinned });
  }

  for (const t of rawQobuz) {
    if (results.length >= MAX) break;
    const track = rawQobuzToTrack(t);
    if (!track || seen.has(track.id)) continue;
    seen.add(track.id);
    results.push({ type: 'track', track });
  }

  // Tidal fallback if Qobuz returned nothing
  if (results.length === 0) {
    try {
      const hd = await fetchHifi('/search/?s=' + encodeURIComponent(cleaned) + '&limit=' + MAX, DEFAULT_HIFI_INSTANCES);
      const items: any[] = hd?.data?.items || hd?.data?.tracks?.items || hd?.data || [];
      for (const item of (Array.isArray(items) ? items : []).slice(0, MAX)) {
        const flat = mapHifiTrack(item, tidalQ);
        if (!flat) continue;
        const track = toTrack(flat);
        if (!track || seen.has(track.id)) continue;
        seen.add(track.id);
        results.push({ type: 'track', track });
      }
    } catch {}
  }

  return results;
}

// ─── Search: albums ───────────────────────────────────────────────────────────
async function searchAlbums(_config: QTConfig, query: string): Promise<SearchResultItem[]> {
  const cleaned = formatQuery(query);
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  try {
    const res = await qobuzProxyGet('/album/search', { query: cleaned, limit: 50 });
    const items: any[] = res?.albums?.items || [];
    for (const a of items) {
      if (!a?.id) continue;
      const id = `${PROVIDER_ID}:${a.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const artistName = a.artist?.name || 'Unknown Artist';
      const artwork = qobuzArtwork(a.image);
      const year = a.released_at
        ? String(new Date(a.released_at * 1000).getFullYear())
        : (a.release_date_original ? String(a.release_date_original).slice(0, 4) : null);
      const album: SearchAlbum = {
        id,
        provider: PROVIDER_ID,
        title: a.title || 'Unknown',
        artists: [{ id: null, name: artistName }],
        year,
        thumbnailURL: artwork,
        isExplicit: a.parental_warning === true,
      };
      results.push({ type: 'album', album });
      if (results.length >= 25) break;
    }
  } catch {}

  return results;
}

// ─── Search: artists ──────────────────────────────────────────────────────────
async function searchArtists(_config: QTConfig, query: string): Promise<SearchResultItem[]> {
  const cleaned = formatQuery(query);
  const results: SearchResultItem[] = [];
  const seen = new Set<string>();

  try {
    const res = await qobuzProxyGet('/artist/search', { query: cleaned, limit: 25 });
    const items: any[] = res?.artists?.items || [];
    for (const a of items) {
      if (!a?.id) continue;
      const id = `${PROVIDER_ID}:${a.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const artwork = a.image?.large || a.image?.medium || a.image?.small || null;
      const artist: SearchArtist = {
        id,
        provider: PROVIDER_ID,
        name: a.name || 'Unknown',
        thumbnailURL: artwork,
        subscriberCount: null,   // string | null per SDK spec
      };
      results.push({ type: 'artist', artist });
    }
  } catch {}

  return results;
}

// ─── Unified handler ──────────────────────────────────────────────────────────
export async function handleSearch(config: QTConfig, query: string, filter?: string): Promise<SearchResultItem[]> {
  if (!filter || filter === 'songs' || filter === 'tracks') return searchTracks(config, query);
  if (filter === 'albums')  return searchAlbums(config, query);
  if (filter === 'artists') return searchArtists(config, query);
  // unknown filter — default to tracks
  return searchTracks(config, query);
}
