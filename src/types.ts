// Matches exactly the Resonance SDK internal types (sourced from ytm-addon reference)

export interface ArtistRef {
  id: string | null;
  name: string;
}

export interface AlbumRef {
  id: string | null;
  name: string;
}

export interface Track {
  id: string;
  provider: string;
  title: string;
  artists: ArtistRef[];
  album: AlbumRef | null;
  duration: string | null;
  durationSeconds: number | null;
  thumbnailURL: string | null;
  isExplicit: boolean;
}

export interface SearchAlbum {
  id: string;
  provider: string;
  title: string;
  artists: ArtistRef[];
  year: string | null;
  thumbnailURL: string | null;
  isExplicit: boolean;
}

export interface SearchArtist {
  id: string;
  provider: string;
  name: string;
  thumbnailURL: string | null;
  subscriberCount: string | null;   // MUST be string | null, not number
}

export interface SearchPlaylist {
  id: string;
  provider: string;
  title: string;
  author: string | null;
  trackCount: string | null;
  thumbnailURL: string | null;
}

export type HomeItem =
  | { type: 'track';    track: Track;            playlistId?: string }
  | { type: 'album';    album: SearchAlbum }
  | { type: 'playlist'; playlist: SearchPlaylist }
  | { type: 'artist';   artist: SearchArtist };

export interface HomeSection {
  id: string;           // crypto.randomUUID()
  title: string;
  items: HomeItem[];
  style: 'cards' | 'quickPicks' | 'quickAccess';
  continuationToken?: string;
}

export interface CatalogPage {
  sections: HomeSection[];
  filters: CatalogFilter[];
  quickAccess: QuickAccessItem[] | null;
  continuation: QueueContinuation | null;
}

export interface CatalogFilter {
  id: string;
  title: string;
  isSelected: boolean;
  payload: { providerID: string; data: Record<string, string> };
}

export interface QuickAccessItem {
  id: string;
  title: string;
  thumbnailURL: string | null;
  action: { type: 'playTrack' | 'openPlaylist' | 'openAlbum'; trackId?: string; playlistId?: string; browseId?: string };
  artistName?: string | null;
}

export interface QueueContinuation {
  providerID: string;
  token: string;
}

export type SearchResultItem =
  | { type: 'track';    track: Track }
  | { type: 'artist';   artist: SearchArtist }
  | { type: 'album';    album: SearchAlbum }
  | { type: 'playlist'; playlist: SearchPlaylist };
