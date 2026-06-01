import type { QTConfig } from '../index';
import { DEFAULT_HIFI_INSTANCES } from '../config';
import { cleanTitle, mapQobuzTrack, mapQobuzAlbum, mapHifiTrack,
         trackArtist, coverUrl, tidalQualityLabel, normalizeStr, isArtistInvolved } from '../utils';
import { fetchHifiAny } from './shared';
import { qobuzProxyGet } from './qobuz';
import { cacheTrackMeta } from '../cache';

export async function handleAlbum(config: QTConfig, albumId: string): Promise<any> {
  const userQ     = config.quality || 'HIRES';
  const tidalQ    = config.tidalQuality || 'HIGH';
  const instances = config.hifiInstances?.split(',').map(s => s.trim()).filter(Boolean) || DEFAULT_HIFI_INSTANCES;

  if (!albumId.startsWith('hifi:')) {
    let res: any = null;
    try { res = await qobuzProxyGet(config, '/album/get', { album_id: albumId, limit: 100 }); } catch {}
    if (!res?.id) throw new Error('Album not found on Qobuz');
    const tracks = (res.tracks?.items || [])
      .map((t: any) => { if (!t.album) t.album = { id: albumId, title: res.title, artist: res.artist, image: res.image }; return mapQobuzTrack(t, userQ); })
      .filter(Boolean)
      .sort((a: any, b: any) => a.discNumber !== b.discNumber ? a.discNumber - b.discNumber : a.trackNumber - b.trackNumber);
    return { id: String(albumId), title: res.title || 'Unknown', artist: res.artist?.name || 'Unknown', artworkURL: res.image?.large || null, year: res.release_date_original?.substring(0,4) || null, trackCount: tracks.length, tracks };
  }

  const realId  = albumId.replace('hifi:', '');
  const settled = await Promise.allSettled([
    fetchHifiAny('/album/?id=' + encodeURIComponent(realId) + '&limit=100', instances),
    fetchHifiAny('/album/' + encodeURIComponent(realId) + '?limit=100', instances),
  ]);
  let data: any = null;
  for (const r of settled) { if (r.status === 'fulfilled' && r.value) { data = r.value; break; } }
  if (!data) throw new Error('Album not found on any HiFi instance');
  const album      = data?.data?.album || data?.data || data?.album || data;
  let rawItems: any[] = album?.items || album?.tracks?.items || album?.tracks || data?.items || [];
  if (!Array.isArray(rawItems)) rawItems = [];
  const artistName = album?.artist?.name || 'Unknown';
  const cover      = album?.cover || album?.image || album?.artwork;
  const tracks     = rawItems.map((item: any, i: number) => {
    const t = item?.item || item;
    if (!t?.id) return null;
    cacheTrackMeta(t.id, cleanTitle(t.title), trackArtist(t) || artistName, t.isrc || null);
    return { id: 'hifi:' + String(t.id), title: cleanTitle(t.title), artist: trackArtist(t) || artistName, duration: t.duration || 0, trackNumber: t.trackNumber || i + 1, discNumber: t.volumeNumber || 1, artworkURL: coverUrl(cover, 1280), audioQuality: tidalQualityLabel(tidalQ), format: 'aac' };
  }).filter(Boolean);
  return { id: albumId, title: album?.title || 'Unknown', artist: artistName, artworkURL: coverUrl(cover, 1280), year: album?.releaseDate ? String(album.releaseDate).slice(0,4) : undefined, trackCount: tracks.length, tracks };
}

export async function handleArtist(config: QTConfig, artistId: string): Promise<any> {
  const userQ     = config.quality || 'HIRES';
  const instances = config.hifiInstances?.split(',').map(s => s.trim()).filter(Boolean) || DEFAULT_HIFI_INSTANCES;

  if (!artistId.startsWith('hifi:')) {
    let a: any = null;
    try { a = await qobuzProxyGet(config, '/artist/get', { artist_id: artistId, extra: 'albums,tracks', limit: 200 }); } catch {}
    if (!a) return { id: String(artistId), name: 'Unknown', artworkURL: null, bio: null, albums: [], topTracks: [] };
    const artistNameNorm = normalizeStr(a.name || '');
    let albumItems: any[] = [...(a?.albums?.items || [])];
    try {
      const raw = await qobuzProxyGet(config, '/artist/' + artistId + '/albums', { limit: 200, offset: 0 });
      albumItems.push(...(raw?.albums?.items || raw?.items || []));
    } catch {}
    // Dedup
    const seen = new Map<string, boolean>();
    albumItems = albumItems.filter(al => { if (!al?.id || seen.has(String(al.id))) return false; seen.set(String(al.id), true); return isArtistInvolved(normalizeStr(al.artist?.name || ''), artistNameNorm); });
    albumItems.sort((x: any, y: any) => (y.release_date_original || '0').localeCompare(x.release_date_original || '0'));
    let trackItems: any[] = [];
    try {
      const tr = await qobuzProxyGet(config, '/track/search', { query: a.name, limit: 60 });
      trackItems = (tr?.tracks?.items || []).filter((t: any) => normalizeStr(t.performer?.name || t.artist?.name || '') === artistNameNorm);
    } catch {}
    return {
      id: String(artistId),
      name: a.name || 'Unknown',
      artworkURL: a.image?.large || a.image?.thumbnail || null,
      bio: a.biography?.content || null,
      albums: albumItems.slice(0, 125).map(mapQobuzAlbum).filter(Boolean),
      topTracks: trackItems.slice(0, 15).map((t: any) => mapQobuzTrack(t, userQ)).filter(Boolean),
    };
  }

  const realId = artistId.replace('hifi:', '');
  const [infoRes, albumsRes, topRes] = await Promise.allSettled([
    fetchHifiAny('/artist/?id=' + realId, instances),
    fetchHifiAny('/artist/albums/?id=' + realId + '&limit=50', instances),
    fetchHifiAny('/artist/toptracks/?id=' + realId + '&limit=30', instances),
  ]);
  const safeD = (r: any) => { if (r.status !== 'fulfilled') return {}; const v = r.value; return v?.data?.data || v?.data || v || {}; };
  const infoD = safeD(infoRes);
  const albumsD = safeD(albumsRes);
  const topD = safeD(topRes);
  const artistInfo = infoD?.artist?.id ? infoD.artist : (infoD?.id ? infoD : {});
  const artistName = artistInfo.name || 'Unknown';
  const tidalQ = config.tidalQuality || 'HIGH';
  const albumMap: Record<string, any> = {};
  for (const a of (albumsD?.items || albumsD?.albums?.items || [])) { if (a?.id) albumMap[String(a.id)] = a; }
  const albums = Object.values(albumMap).sort((x: any, y: any) => parseInt(String(y.releaseDate).slice(0,4)) - parseInt(String(x.releaseDate).slice(0,4)))
    .slice(0, 125).map((al: any) => ({ id: 'hifi:' + String(al.id), title: al.title, artist: artistName, artworkURL: coverUrl(al.cover, 1280), year: al.releaseDate ? String(al.releaseDate).slice(0,4) : undefined }));
  const topTracks = (topD?.items || topD?.tracks?.items || []).slice(0, 15).map((t: any) => {
    if (!t?.id) return null;
    return { id: 'hifi:' + String(t.id), title: cleanTitle(t.title), artist: trackArtist(t) || artistName, artworkURL: coverUrl(t.album?.cover, 1280), duration: t.duration || 0, audioQuality: tidalQualityLabel(tidalQ), format: 'aac' };
  }).filter(Boolean);
  return { id: artistId, name: artistName, artworkURL: coverUrl(artistInfo.picture, 480) || null, bio: null, albums, topTracks };
}

export async function handlePlaylist(config: QTConfig, playlistId: string): Promise<any> {
  const userQ = config.quality || 'HIRES';
  let res: any = null;
  try { res = await qobuzProxyGet(config, '/playlist/get', { playlist_id: playlistId, extra: 'tracks', limit: 500 }); } catch {}
  if (!res?.id && !res?.name) throw new Error('Playlist not found on Qobuz');
  let rawTrackList: any[] = res.tracks?.items || res.tracks?.data || (Array.isArray(res.tracks) ? res.tracks : []) || res.items || [];
  const tracks = rawTrackList.map((t: any) => mapQobuzTrack(t?.track || t, userQ)).filter(Boolean);
  return {
    id: String(playlistId),
    title: res.name || res.title || 'Playlist',
    creator: res.owner?.name || undefined,
    artworkURL: res.images300?.[0] || null,
    trackCount: tracks.length,
    tracks,
  };
}
