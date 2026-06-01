import { defineAddon } from '@resonance-addons/sdk';
import { handleStream } from './routes/stream';
import { handleSearch } from './routes/search';
import { handleAlbum, handleArtist, handlePlaylist } from './routes/detail';

const PROVIDER_ID = 'com.resonance.qobuz-tidal';

export interface QTConfig {
  qobuzAppId: string;
  qobuzUserToken: string;
  qobuzSecret: string;
  quality: string;          // HIRES | HIRES_96 | CD | MP3
  tidalQuality: string;     // HIGH | LOW
  hifiInstances?: string;   // comma-separated custom HiFi URLs
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
    label: 'Enter your Qobuz API credentials',
    fields: [
      { key: 'qobuzAppId',     type: 'text',     title: 'Qobuz App ID',         isRequired: true,  defaultValue: '312369995' },
      { key: 'qobuzUserToken', type: 'password',  title: 'Qobuz User Auth Token', isRequired: true },
      { key: 'qobuzSecret',    type: 'password',  title: 'Qobuz Secret',          isRequired: true },
      {
        key: 'quality', type: 'select', title: 'Qobuz Quality',
        options: ['HIRES', 'HIRES_96', 'CD', 'MP3'], defaultValue: 'HIRES',
      },
      {
        key: 'tidalQuality', type: 'select', title: 'Tidal Fallback Quality',
        options: ['HIGH', 'LOW'], defaultValue: 'HIGH',
      },
      { key: 'hifiInstances', type: 'text', title: 'Custom HiFi Instances (comma-separated, optional)', isRequired: false },
    ],
  },

  behaviorHints: { configurable: true, configurationRequired: true },

  capabilities: {
    supportsSearchSuggestions: false,
    supportsLikeStatus: false,
    supportsContinuation: false,
    supportsFilters: true,
  },

  handlers: {
    resolveStream:    (config, trackId)   => handleStream(config, trackId),
    search:           (config, query, filter) => handleSearch(config, query, filter),
    getAlbumDetail:   (config, id)        => handleAlbum(config, id),
    getArtistDetail:  (config, id)        => handleArtist(config, id),
    getPlaylistDetail:(config, id)        => handlePlaylist(config, id),
  },
});
