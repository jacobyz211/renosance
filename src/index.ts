import { defineAddon } from '@resonance-addons/sdk';
import { handleStream } from './routes/stream';
import { handleSearch } from './routes/search';
import { handleAlbum, handleArtist, handlePlaylist } from './routes/detail';

const PROVIDER_ID = 'com.resonance.qobuz-tidal';

// No credentials in config — all hardcoded in config.ts
export interface QTConfig {
  quality:      string;  // HIRES | HIRES_96 | CD | MP3
  tidalQuality: string;  // HIGH | LOW
}

export const addon = defineAddon<QTConfig>({
  id: PROVIDER_ID,
  name: 'Qobuz + Tidal',
  description: 'Hi-Res Qobuz streaming with Tidal HiFi fallback — ISRC scoring engine v1.13',
  version: '1.0.0',
  icon: { type: 'remote', value: 'https://www.qobuz.com/apple-touch-icon.png' },

  resources: [
    { type: 'stream', idPrefixes: [PROVIDER_ID] },
    {
      type: 'catalog',
      catalogs: [
        { id: 'search', name: 'Search', isDefault: true },
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
    supportsFilters: true,
  },

  handlers: {
    resolveStream:     (config, trackId)          => handleStream(config, trackId),
    search:            (config, query, filter)    => handleSearch(config, query, filter),
    getAlbumDetail:    (config, id)               => handleAlbum(config, id),
    getArtistDetail:   (config, id)               => handleArtist(config, id),
    getPlaylistDetail: (config, id)               => handlePlaylist(config, id),
  },
});
