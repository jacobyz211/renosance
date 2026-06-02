export interface AddonDefinition<TConfig = Record<string, string>> {
  id: string;
  name: string;
  description: string;
  version: string;
  icon: { type: 'remote' | 'local'; value: string };
  resources: AddonResource[];
  auth?: AddonAuth;
  config?: Record<string, unknown>;
  behaviorHints?: { configurable?: boolean; configurationRequired?: boolean };
  capabilities?: AddonCapabilities;
  handlers: AddonHandlers<TConfig>;
}

export interface AddonCapabilities {
  supportsSearchSuggestions?: boolean;
  supportsLikeStatus?: boolean;
  supportsContinuation?: boolean;
  supportsFilters?: boolean;
  supportsQuickAccess?: boolean;
  supportsRelated?: boolean;
  supportsRadio?: boolean;
  supportsQueueActions?: boolean;
  supportsAddToPlaylist?: boolean;
}

export type AddonResource =
  | { type: 'stream'; idPrefixes: string[] }
  | { type: 'catalog'; catalogs: { id: string; name: string; isDefault?: boolean }[] }
  | { type: 'lyrics'; syncTypes: string[] };

export interface AddonAuthField {
  key: string;
  type: 'text' | 'password' | 'select';
  title: string;
  isRequired?: boolean;
  options?: string[];
  defaultValue?: string;
}

export interface AddonAuth {
  type: 'token' | 'oauth';
  label: string;
  fields: AddonAuthField[];
}

export interface AddonHandlers<TConfig> {
  resolveStream?: (config: TConfig, trackId: string) => Promise<any>;
  getCatalog?: (config: TConfig, id: string, extra?: any) => Promise<any>;
  search?: (config: TConfig, query: string, filter?: string) => Promise<any[]>;
  searchSuggestions?: (config: TConfig, query: string) => Promise<string[]>;
  fetchLyrics?: (config: TConfig, title: string, artist: string, trackId: string) => Promise<any>;
  getAlbumDetail?: (config: TConfig, id: string) => Promise<any>;
  getArtistDetail?: (config: TConfig, id: string) => Promise<any>;
  getPlaylistDetail?: (config: TConfig, id: string) => Promise<any>;
  loadMorePlaylistTracks?: (config: TConfig, id: string, continuation: string) => Promise<any>;
  getRelated?: (config: TConfig, browseId: string) => Promise<any>;
  getRelatedForTrack?: (config: TConfig, trackId: string) => Promise<any>;
  startQueue?: (config: TConfig, trackId: string, context?: any) => Promise<any>;
  loadMore?: (config: TConfig, token: string) => Promise<any>;
  executeAction?: (config: TConfig, action: any, currentTrack?: any) => Promise<any>;
  setLikeStatus?: (config: TConfig, status: string, trackId: string) => Promise<void>;
  getLikeStatus?: (config: TConfig, trackId: string) => Promise<any>;
  addToPlaylist?: (config: TConfig, trackId: string, playlistId: string) => Promise<void>;
}
