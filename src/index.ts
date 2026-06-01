import { defineAddon } from '@resonance-addons/sdk';
import { handleStream } from './routes/stream';
import { handleSearch } from './routes/search';
import { handleAlbum, handleArtist, handlePlaylist } from './routes/detail';
import { handleCatalog } from './routes/catalog';

const PROVIDER_ID = 'com.resonance.qobuz-tidal';

export interface QTConfig {
  quality:      string;  // HIRES | HIRES_96 | CD | MP3
  tidalQuality: string;  // HIGH | LOW
}

export const addon = defineAddon<QTConfig>({
  id: PROVIDER_ID,
  name: 'Qobuz + Tidal',
  description: 'Hi-Res Qobuz streaming with Tidal HiFi fallback — ISRC scoring engine',
  version: '1.1.0',
  icon: { type: 'remote', value: 'https://www.qobuz.com/apple-touch-icon.png' },

  resources: [
    { type: 'stream', idPrefixes: [PROVIDER_ID] },
    {
      type: 'catalog',
      catalogs: [
        { id: 'home',    name: 'Home',    isDefault: true },
        { id: 'library', name: 'Library' },
      ],
    },
  ],

  auth: {
    type: 'token',
    label: 'Select quality settings',
    fields: [
      {
        key: 'quality', type: 'select', title: 'Qobuz Quality',
        options: ['HIRES', 'HIRES_96', 'CD', 'MP3'], defaultValue: 'HIRES',
      },
      {
        key: 'tidalQuality', type: 'select', title: 'Tidal Fallback Quality',
        options: ['HIGH', 'LOW'], defaultValue: 'HIGH',
      },
    ],
  },

  behaviorHints: { configurable: true, configurationRequired: false },

  capabilities: {
    supportsSearchSuggestions: false,
    supportsLikeStatus: false,
    supportsContinuation: false,
    supportsFilters: false,
  },

  handlers: {
    resolveStream:     (config, trackId)       => handleStream(config, trackId),
    getCatalog:        (config, id, extra)     => handleCatalog(config, id, extra),
    search:            (config, query, filter) => handleSearch(config, query, filter),
    getAlbumDetail:    (config, id)            => handleAlbum(config, id),
    getArtistDetail:   (config, id)            => handleArtist(config, id),
    getPlaylistDetail: (config, id)            => handlePlaylist(config, id),
  },
});
