interface CacheEntry { val: unknown; exp: number; }
const memCache = new Map<string, CacheEntry>();
const trackMetaCache = new Map<string, { title: string; artist: string; isrc: string | null }>();
const qobuzMapCache = new Map<string, { qobuzId: string; title: string }>();

export function cGet(key: string): unknown | null {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() > e.exp) { memCache.delete(key); return null; }
  return e.val;
}

export function cSet(key: string, value: unknown, ttlSeconds: number): void {
  memCache.set(key, { val: value, exp: Date.now() + ttlSeconds * 1000 });
  if (memCache.size > 500) memCache.delete(memCache.keys().next().value!);
}

export function cacheTrackMeta(id: string, title: string, artist: string, isrc: string | null) {
  if (!id || !title) return;
  trackMetaCache.set(String(id), { title, artist: artist || 'Unknown', isrc: isrc || null });
  if (trackMetaCache.size > 5000) trackMetaCache.delete(trackMetaCache.keys().next().value!);
}

export function getCachedMeta(id: string) {
  return trackMetaCache.get(String(id)) || null;
}

export function cacheQobuzTrackId(hifiId: string, qobuzTrack: { id: string | number; title: string }) {
  qobuzMapCache.set(`qobuz_map:${hifiId}`, { qobuzId: String(qobuzTrack.id), title: qobuzTrack.title });
}

export function getCachedQobuzTrack(hifiId: string) {
  const val = qobuzMapCache.get(`qobuz_map:${hifiId}`);
  return val ? { id: val.qobuzId, title: val.title } : null;
}
