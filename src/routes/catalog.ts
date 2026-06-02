import type { QTConfig } from '../index';
import type { CatalogPage, HomeSection, HomeItem, Track, SearchAlbum } from '../types';
import { qobuzProxyGet } from './qobuz';

const PROVIDER_ID = 'com.resonance.qobuz-tidal';

function uuid(): string {
  // crypto.randomUUID() is available in Bun/modern runtimes
  return crypto.randomUUID();
}

function mmss(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function qobuzArtwork(img: any, size = 600): string | null {
  if (!img) return null;
  const url: string = img.large || img.medium || img.small || img.thumbnail || img.back || '';
  if (!url) return null;
  // Replace _600. sizing token if present
  return url.replace(/_\d+\./, `_${size}.`);
}

function mapQobuzTrackToHomeItem(t: any, quality: string): HomeItem | null {
  if (!t?.id) return null;
  const artistName = t.performer?.name || t.artist?.name || 'Unknown Artist';
  const artwork = qobuzArtwork(t.album?.image);
  const track: Track = {
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
  return { type: 'track', track };
}

function mapQobuzAlbumToHomeItem(a: any): HomeItem | null {
  if (!a?.id) return null;
  const artistName = a.artist?.name || 'Unknown Artist';
  const artwork = qobuzArtwork(a.image);
  const year = a.released_at
    ? String(new Date(a.released_at * 1000).getFullYear())
    : (a.release_date_original ? String(a.release_date_original).slice(0, 4) : null);
  const album: SearchAlbum = {
    id: `${PROVIDER_ID}:${a.id}`,
    provider: PROVIDER_ID,
    title: a.title || 'Unknown',
    artists: [{ id: null, name: artistName }],
    year,
    thumbnailURL: artwork,
    isExplicit: a.parental_warning === true,
  };
  return { type: 'album', album };
}

export async function handleCatalog(config: QTConfig, id: string, extra?: any): Promise<CatalogPage> {
  const quality = config.quality || 'HIRES';
  const sections: HomeSection[] = [];

  if (id === 'home') {
    // New Releases
    try {
      const res = await qobuzProxyGet('/album/getFeatured', { type: 'new-releases', limit: 20, offset: 0 });
      const albums: any[] = res?.albums?.items || [];
      const items: HomeItem[] = albums.map(mapQobuzAlbumToHomeItem).filter(Boolean) as HomeItem[];
      if (items.length > 0) {
        sections.push({ id: uuid(), title: 'New Releases', items, style: 'cards' });
      }
    } catch (e) { console.error('[catalog] new-releases error:', e); }

    // Editor's Picks
    try {
      const res = await qobuzProxyGet('/album/getFeatured', { type: 'editor-picks', limit: 20, offset: 0 });
      const albums: any[] = res?.albums?.items || [];
      const items: HomeItem[] = albums.map(mapQobuzAlbumToHomeItem).filter(Boolean) as HomeItem[];
      if (items.length > 0) {
        sections.push({ id: uuid(), title: "Editor's Picks", items, style: 'cards' });
      }
    } catch (e) { console.error('[catalog] editor-picks error:', e); }

    // Press Awards (Hi-Res)
    try {
      const res = await qobuzProxyGet('/album/getFeatured', { type: 'press-awards', limit: 20, offset: 0 });
      const albums: any[] = res?.albums?.items || [];
      const items: HomeItem[] = albums.map(mapQobuzAlbumToHomeItem).filter(Boolean) as HomeItem[];
      if (items.length > 0) {
        sections.push({ id: uuid(), title: 'Press Awards', items, style: 'cards' });
      }
    } catch (e) { console.error('[catalog] press-awards error:', e); }

    // Most Streamed
    try {
      const res = await qobuzProxyGet('/track/search', { query: 'best of 2024', limit: 20 });
      const tracks: any[] = res?.tracks?.items || [];
      const items: HomeItem[] = tracks.map((t: any) => mapQobuzTrackToHomeItem(t, quality)).filter(Boolean) as HomeItem[];
      if (items.length > 0) {
        sections.push({ id: uuid(), title: 'Popular Tracks', items, style: 'quickPicks' });
      }
    } catch (e) { console.error('[catalog] popular error:', e); }
  }

  if (id === 'library') {
    // Favorite Albums
    try {
      const res = await qobuzProxyGet('/favorite/getUserFavorites', { type: 'albums', limit: 50, offset: 0 });
      const albums: any[] = res?.albums?.items || [];
      const items: HomeItem[] = albums.map(mapQobuzAlbumToHomeItem).filter(Boolean) as HomeItem[];
      if (items.length > 0) {
        sections.push({ id: uuid(), title: 'Favorite Albums', items, style: 'cards' });
      }
    } catch (e) { console.error('[catalog] fav-albums error:', e); }

    // Favorite Tracks
    try {
      const res = await qobuzProxyGet('/favorite/getUserFavorites', { type: 'tracks', limit: 50, offset: 0 });
      const tracks: any[] = res?.tracks?.items || [];
      const items: HomeItem[] = tracks.map((t: any) => mapQobuzTrackToHomeItem(t, quality)).filter(Boolean) as HomeItem[];
      if (items.length > 0) {
        sections.push({ id: uuid(), title: 'Favorite Tracks', items, style: 'quickPicks' });
      }
    } catch (e) { console.error('[catalog] fav-tracks error:', e); }

    // Purchases
    try {
      const res = await qobuzProxyGet('/purchase/getUserPurchases', { type: 'albums', limit: 50, offset: 0 });
      const albums: any[] = res?.albums?.items || [];
      const items: HomeItem[] = albums.map(mapQobuzAlbumToHomeItem).filter(Boolean) as HomeItem[];
      if (items.length > 0) {
        sections.push({ id: uuid(), title: 'Purchased Albums', items, style: 'cards' });
      }
    } catch { /* purchases may 404 — silently skip */ }
  }

  return {
    sections,
    filters: [],
    quickAccess: null,
    continuation: null,
  };
}
