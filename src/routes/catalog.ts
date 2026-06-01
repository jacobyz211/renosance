import type { QTConfig } from '../index';
import { qobuzProxyGet } from './qobuz';
import { mapQobuzAlbum, mapQobuzTrack } from '../utils';

const PROVIDER_ID = 'com.resonance.qobuz-tidal';

function mmss(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function toHomeTrack(t: any, quality: string): any {
  const raw = mapQobuzTrack(t, quality);
  if (!raw) return null;
  return {
    type: 'track' as const,
    track: {
      id: `${PROVIDER_ID}:${raw.id}`,
      provider: PROVIDER_ID,
      title: raw.title,
      artists: [{ id: null, name: raw.artist }],
      album: raw.album ? { id: raw.albumId ? `${PROVIDER_ID}:${raw.albumId}` : null, name: raw.album } : null,
      duration: raw.duration ? mmss(raw.duration) : null,
      durationSeconds: raw.duration || null,
      thumbnailURL: raw.artworkURL || null,
      isExplicit: raw.explicit === true,
    },
  };
}

function toHomeAlbum(a: any): any {
  const raw = mapQobuzAlbum(a);
  if (!raw) return null;
  return {
    type: 'album' as const,
    album: {
      id: `${PROVIDER_ID}:${raw.id}`,
      provider: PROVIDER_ID,
      title: raw.title,
      artists: [{ id: null, name: raw.artist }],
      year: raw.year || null,
      thumbnailURL: raw.artworkURL || null,
      isExplicit: raw.explicit === true,
    },
  };
}

export async function handleCatalog(config: QTConfig, id: string, _extra?: any): Promise<any> {
  const quality = config.quality || 'HIRES';
  const sections: any[] = [];

  if (id === 'home') {
    // ─── New Releases ───────────────────────────────────────────────────────
    try {
      const res = await qobuzProxyGet('/album/getFeatured', { type: 'new-releases', limit: 20, offset: 0 });
      const albums = res?.albums?.items || [];
      const items = albums.map(toHomeAlbum).filter(Boolean);
      if (items.length) {
        sections.push({
          id: 'new-releases',
          title: 'New Releases',
          items,
          style: 'cards',
        });
      }
    } catch {}

    // ─── Editor\'s Picks / Press Awards ─────────────────────────────────────
    try {
      const res = await qobuzProxyGet('/album/getFeatured', { type: 'editor-picks', limit: 20, offset: 0 });
      const albums = res?.albums?.items || [];
      const items = albums.map(toHomeAlbum).filter(Boolean);
      if (items.length) {
        sections.push({
          id: 'editors-picks',
          title: "Editor's Picks",
          items,
          style: 'cards',
        });
      }
    } catch {}

    // ─── Most Streamed tracks ────────────────────────────────────────────────
    try {
      const res = await qobuzProxyGet('/track/search', { query: 'top hits 2025', limit: 20 });
      const tracks = res?.tracks?.items || [];
      const items = tracks.map((t: any) => toHomeTrack(t, quality)).filter(Boolean);
      if (items.length) {
        sections.push({
          id: 'top-tracks',
          title: 'Popular Tracks',
          items,
          style: 'quickPicks',
        });
      }
    } catch {}

    return {
      sections,
      filters: [],
      quickAccess: null,
      continuation: null,
    };
  }

  if (id === 'library') {
    // User\'s Qobuz favorites / purchased
    try {
      const res = await qobuzProxyGet('/favorite/getUserFavorites', { type: 'albums', limit: 50, offset: 0 });
      const albums = res?.albums?.items || [];
      const items = albums.map(toHomeAlbum).filter(Boolean);
      if (items.length) {
        sections.push({
          id: 'fav-albums',
          title: 'Favorite Albums',
          items,
          style: 'cards',
        });
      }
    } catch {}

    try {
      const res = await qobuzProxyGet('/favorite/getUserFavorites', { type: 'tracks', limit: 50, offset: 0 });
      const tracks = res?.tracks?.items || [];
      const items = tracks.map((t: any) => toHomeTrack(t, quality)).filter(Boolean);
      if (items.length) {
        sections.push({
          id: 'fav-tracks',
          title: 'Favorite Tracks',
          items,
          style: 'quickPicks',
        });
      }
    } catch {}

    return {
      sections,
      filters: [],
      quickAccess: null,
      continuation: null,
    };
  }

  return { sections: [], filters: [], quickAccess: null, continuation: null };
}
