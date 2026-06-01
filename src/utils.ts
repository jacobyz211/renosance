import { UA, TIMEOUT_MS, QUALITY_FORMAT_MAP } from './config';

// ─── md5 (pure JS, replaces Cloudflare crypto) ───────────────────────────────
export function md5(str: string): string {
  function safeAdd(x: number, y: number) {
    const lsw = (x & 0xFFFF) + (y & 0xFFFF);
    return ((((x >> 16) + (y >> 16) + (lsw >> 16)) << 16) | (lsw & 0xFFFF)) >>> 0;
  }
  function bitRotateLeft(num: number, cnt: number) { return (num << cnt) | (num >>> (32 - cnt)); }
  function md5cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    return safeAdd(bitRotateLeft(safeAdd(safeAdd(a, q), safeAdd(x, t)), s), b);
  }
  function md5ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn((b & c) | (~b & d), a, b, x, s, t); }
  function md5gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function md5hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn(b ^ c ^ d, a, b, x, s, t); }
  function md5ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return md5cmn(c ^ (b | ~d), a, b, x, s, t); }
  const utf8 = unescape(encodeURIComponent(str));
  const b: number[] = [];
  for (let i = 0; i < utf8.length; i++) b.push(utf8.charCodeAt(i));
  b.push(0x80);
  while (b.length % 64 !== 56) b.push(0);
  const bitLen = utf8.length * 8;
  b.push(bitLen & 0xFF, (bitLen >> 8) & 0xFF, (bitLen >> 16) & 0xFF, (bitLen >> 24) & 0xFF, 0, 0, 0, 0);
  let a = 0x67452301, bv = 0xEFCDAB89, c = 0x98BADCFE, d = 0x10325476;
  for (let i = 0; i < b.length; i += 64) {
    const M: number[] = [];
    for (let j = 0; j < 16; j++) M[j] = b[i + j * 4] | (b[i + j * 4 + 1] << 8) | (b[i + j * 4 + 2] << 16) | (b[i + j * 4 + 3] << 24);
    let [aa, bb, cc, dd] = [a, bv, c, d];
    a=md5ff(a,bv,c,d,M[0],7,-680876936);d=md5ff(d,a,bv,c,M[1],12,-389564586);c=md5ff(c,d,a,bv,M[2],17,606105819);bv=md5ff(bv,c,d,a,M[3],22,-1044525330);
    a=md5ff(a,bv,c,d,M[4],7,-176418897);d=md5ff(d,a,bv,c,M[5],12,1200080426);c=md5ff(c,d,a,bv,M[6],17,-1473231341);bv=md5ff(bv,c,d,a,M[7],22,-45705983);
    a=md5ff(a,bv,c,d,M[8],7,1770035416);d=md5ff(d,a,bv,c,M[9],12,-1958414417);c=md5ff(c,d,a,bv,M[10],17,-42063);bv=md5ff(bv,c,d,a,M[11],22,-1990404162);
    a=md5ff(a,bv,c,d,M[12],7,1804603682);d=md5ff(d,a,bv,c,M[13],12,-40341101);c=md5ff(c,d,a,bv,M[14],17,-1502002290);bv=md5ff(bv,c,d,a,M[15],22,1236535329);
    a=md5gg(a,bv,c,d,M[1],5,-165796510);d=md5gg(d,a,bv,c,M[6],9,-1069501632);c=md5gg(c,d,a,bv,M[11],14,643717713);bv=md5gg(bv,c,d,a,M[0],20,-373897302);
    a=md5gg(a,bv,c,d,M[5],5,-701558691);d=md5gg(d,a,bv,c,M[10],9,38016083);c=md5gg(c,d,a,bv,M[15],14,-660478335);bv=md5gg(bv,c,d,a,M[4],20,-405537848);
    a=md5gg(a,bv,c,d,M[9],5,568446438);d=md5gg(d,a,bv,c,M[14],9,-1019803690);c=md5gg(c,d,a,bv,M[3],14,-187363961);bv=md5gg(bv,c,d,a,M[8],20,1163531501);
    a=md5gg(a,bv,c,d,M[13],5,-1444681467);d=md5gg(d,a,bv,c,M[2],9,-51403784);c=md5gg(c,d,a,bv,M[7],14,1735328473);bv=md5gg(bv,c,d,a,M[12],20,-1926607734);
    a=md5hh(a,bv,c,d,M[5],4,-378558);d=md5hh(d,a,bv,c,M[8],11,-2022574463);c=md5hh(c,d,a,bv,M[11],16,1839030562);bv=md5hh(bv,c,d,a,M[14],23,-35309556);
    a=md5hh(a,bv,c,d,M[1],4,-1530992060);d=md5hh(d,a,bv,c,M[4],11,1272893353);c=md5hh(c,d,a,bv,M[7],16,-155497632);bv=md5hh(bv,c,d,a,M[10],23,-1094730640);
    a=md5hh(a,bv,c,d,M[13],4,681279174);d=md5hh(d,a,bv,c,M[0],11,-358537222);c=md5hh(c,d,a,bv,M[3],16,-722521979);bv=md5hh(bv,c,d,a,M[6],23,76029189);
    a=md5hh(a,bv,c,d,M[9],4,-640364487);d=md5hh(d,a,bv,c,M[12],11,-421815835);c=md5hh(c,d,a,bv,M[15],16,530742520);bv=md5hh(bv,c,d,a,M[2],23,-995338651);
    a=md5ii(a,bv,c,d,M[0],6,-198630844);d=md5ii(d,a,bv,c,M[7],10,1126891415);c=md5ii(c,d,a,bv,M[14],15,-1416354905);bv=md5ii(bv,c,d,a,M[5],21,-57434055);
    a=md5ii(a,bv,c,d,M[12],6,1700485571);d=md5ii(d,a,bv,c,M[3],10,-1894986606);c=md5ii(c,d,a,bv,M[10],15,-1051523);bv=md5ii(bv,c,d,a,M[1],21,-2054922799);
    a=md5ii(a,bv,c,d,M[8],6,1873313359);d=md5ii(d,a,bv,c,M[15],10,-30611744);c=md5ii(c,d,a,bv,M[6],15,-1560198380);bv=md5ii(bv,c,d,a,M[13],21,1309151649);
    a=md5ii(a,bv,c,d,M[4],6,-145523070);d=md5ii(d,a,bv,c,M[11],10,-1120210379);c=md5ii(c,d,a,bv,M[2],15,718787259);bv=md5ii(bv,c,d,a,M[9],21,-343485551);
    a=safeAdd(a,aa);bv=safeAdd(bv,bb);c=safeAdd(c,cc);d=safeAdd(d,dd);
  }
  return [a,bv,c,d].map(n => ('00000000' + (n >>> 0).toString(16)).slice(-8).replace(/(..)(..)(..)(..)/, '$4$3$2$1')).join('');
}

// ─── HTTP ─────────────────────────────────────────────────────────────────────
export async function httpGet(url: string, params?: Record<string, string | number> | null, timeout = 10000): Promise<any> {
  const u = new URL(url);
  if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(u.toString(), { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) { await r.arrayBuffer().catch(() => {}); throw new Error('HTTP ' + r.status); }
    return r.json();
  } catch (e) { clearTimeout(timer); throw e; }
}

// ─── String helpers ───────────────────────────────────────────────────────────
export function normalizeStr(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´]/g, "'").replace(/[\u2022\u00b7\u2027\u22c5]/g, ' ')
    .replace(/\s{2,}/g, ' ').toLowerCase().trim();
}

export function removeFeat(str: string): string {
  if (!str) return '';
  str = str.replace(/\s*\\([^)]\*(feat|ft|featuring)[^)]\*\\)/gi, '');
  str = str.replace(/\s*\\[[^\\]]*(feat|ft|featuring)[^\]]*\]/gi, '');
  const match = str.match(/\b(feat\.?|ft\.?|featuring)\b/i);
  if (match && match.index! > 0) str = str.substring(0, match.index);
  return str.trim();
}

export function cleanTitle(title: string): string {
  return title ? removeFeat(title) : 'Unknown';
}

export function formatQuery(q: string): string {
  q = q.replace(/[''`´]/g, "'").replace(/[""«»]/g, '"');
  q = removeFeat(q);
  const parts = q.split('-');
  if (parts.length > 1) return parts.map(p => removeFeat(p.trim())).join(' - ');
  return removeFeat(q);
}

// ─── ISRC Scoring Engine ──────────────────────────────────────────────────────
export function findBestMatch(items: any[], query: string): { item: any; score: number } {
  let bestItem = null, bestScore = -1;
  const qNorm = normalizeStr(query);
  const hasHyphen = qNorm.includes('-');
  let qTitleOnly = hasHyphen ? qNorm.split('-')[1].trim() : qNorm;
  if (hasHyphen && qNorm.split('-')[0].trim() === '') qTitleOnly = qNorm;
  const qWords = qNorm.replace(/[^a-z0-9\s]/gi, ' ').split(/\s+/).filter(w => w.length > 1);
  for (let i = 0; i < Math.min(items.length, 50); i++) {
    const t = items[i];
    const tTitle = normalizeStr(cleanTitle(t.title || ''));
    const tArtist = normalizeStr(t.performer?.name || t.artist?.name || t.artists?.[0]?.name || '');
    let score = 0;
    const targetStr = (tTitle + ' ' + tArtist).replace(/[^a-z0-9\s]/gi, ' ');
    score += qWords.filter(w => targetStr.includes(w)).length * 10;
    let titleMatch = false, artistMatch = false;
    if (hasHyphen) {
      const p1 = qNorm.split('-')[0].trim(), p2 = qNorm.split('-')[1].trim();
      if (p1 && (tTitle === p1 || tTitle.includes(p1) || p1.includes(tTitle))) titleMatch = true;
      if (p2 && (tTitle === p2 || tTitle.includes(p2) || p2.includes(tTitle))) titleMatch = true;
      if (p1 && (tArtist === p1 || tArtist.includes(p1) || p1.includes(tArtist))) artistMatch = true;
      if (p2 && (tArtist === p2 || tArtist.includes(p2) || p2.includes(tArtist))) artistMatch = true;
    } else {
      if (tTitle && (qNorm === tTitle || qNorm.includes(tTitle) || tTitle.includes(qNorm))) titleMatch = true;
      if (tArtist && (qNorm === tArtist || qNorm.includes(tArtist) || tArtist.includes(qNorm))) artistMatch = true;
    }
    if (titleMatch) score += 40;
    if (artistMatch) score += 40;
    if (titleMatch && artistMatch) score += 100;
    if (tTitle === qTitleOnly || tTitle === qNorm) score += 60;
    if (qWords.filter(w => tTitle.includes(w)).length === 0 && tTitle !== qTitleOnly && !qNorm.includes(tTitle)) {
      if (qNorm !== tArtist && !tArtist.includes(qNorm)) score -= 100;
    }
    if (!/\b(cover|karaoke|tribute|instrumental|8-bit)\b/i.test(qNorm) && /\b(cover|karaoke|tribute|instrumental|8-bit)\b/i.test(t.title || '')) score -= 500;
    if (score > bestScore) { bestScore = score; bestItem = t; }
  }
  return { item: bestItem, score: bestScore };
}

// ─── Artist match helpers ─────────────────────────────────────────────────────
export function isArtistMatch(normArtist: string, normQuery: string): boolean {
  if (!normArtist || !normQuery) return false;
  if (normArtist === normQuery) return true;
  return new RegExp('^' + normQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|&|,|/|$)').test(normArtist);
}

export function isArtistInvolved(normArtist: string, normQuery: string): boolean {
  if (!normArtist || !normQuery) return false;
  if (normArtist === normQuery) return true;
  const sep = '(^|\\s|&|,|/)';
  const end = '(\\s|&|,|/|$)';
  if (new RegExp(sep + normQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + end).test(normArtist)) return true;
  const tokens = normArtist.split(/\s+/);
  const qWords = normQuery.split(/\s+/);
  if (qWords.length >= 1 && qWords.length <= tokens.length) {
    for (let i = 0; i <= tokens.length - qWords.length; i++) {
      if (qWords.every((w, j) => tokens[i + j] === w)) return true;
    }
  }
  return false;
}

// ─── Quality labels ───────────────────────────────────────────────────────────
export function qobuzQualityLabel(formatId: number, item?: any): string {
  if (formatId === 5) return '320kbps MP3';
  if (formatId === 6) return '16-bit / 44.1 kHz FLAC';
  if (formatId === 7) return '24-bit / 96 kHz FLAC';
  if (formatId === 27) {
    const bits = item?.bit_depth || item?.maximum_bit_depth || 24;
    const rate = item?.sampling_rate || item?.maximum_sampling_rate || 192;
    return `${bits}-bit / ${rate} kHz FLAC`;
  }
  return '16-bit / 44.1 kHz FLAC';
}

export function tidalQualityLabel(q: string): string {
  if (q === 'HIGH') return '320kbps AAC (Tidal)';
  if (q === 'LOW') return '96kbps AAC (Tidal)';
  return `${q} (Tidal)`;
}

// ─── Artwork helpers ──────────────────────────────────────────────────────────
export function coverUrl(uuid: string | null | undefined, size = 320): string | null {
  if (!uuid) return null;
  const s = String(uuid);
  if (s.startsWith('http')) return s;
  return 'https://resources.tidal.com/images/' + s.replace(/-/g, '/') + '/' + size + 'x' + size + '.jpg';
}

export function trackArtist(t: any): string {
  if (!t) return 'Unknown';
  if (t.artists?.length) return t.artists.map((a: any) => a.name).join(', ');
  return t.artist?.name || t.performer?.name || 'Unknown';
}

// ─── Mappers ──────────────────────────────────────────────────────────────────
export function mapQobuzTrack(t: any, userQuality: string): any {
  if (!t?.id) return null;
  const formatId = QUALITY_FORMAT_MAP[String(userQuality).toUpperCase()] || 27;
  return {
    id: String(t.id),
    title: cleanTitle(t.title),
    artist: t.performer?.name || t.artist?.name || t.album?.artist?.name || 'Unknown Artist',
    album: t.album?.title || '',
    albumId: t.album?.id ? String(t.album.id) : null,
    artworkURL: t.album?.image?.large || t.album?.image?.thumbnail || t.album?.cover || null,
    duration: t.duration || 0,
    trackNumber: t.track_number || 0,
    discNumber: t.media_number || t.volume_number || 1,
    audioQuality: qobuzQualityLabel(formatId, t),
    isrc: t.isrc || undefined,
    format: formatId === 5 ? 'mp3' : 'flac',
    explicit: t.parental_advisory === true || t.explicit === true,
  };
}

export function mapHifiTrack(t: any, tidalQuality: string): any {
  if (!t?.id) return null;
  return {
    id: 'hifi:' + t.id,
    title: cleanTitle(t.title),
    artist: trackArtist(t),
    album: t.album?.title || '',
    albumId: t.album?.id ? 'hifi:' + t.album.id : null,
    artworkURL: coverUrl(t.album?.cover, 1280),
    duration: t.duration || 0,
    trackNumber: t.trackNumber || 0,
    discNumber: t.volumeNumber || 1,
    audioQuality: tidalQualityLabel(tidalQuality),
    format: 'aac',
    explicit: t.explicit === true,
  };
}

export function mapQobuzAlbum(a: any): any {
  if (!a?.id) return null;
  return {
    id: String(a.id),
    title: a.title || 'Unknown',
    artist: a.artist?.name || 'Unknown Artist',
    artworkURL: a.image?.large || a.image?.thumbnail || a.image?.small || null,
    year: a.release_date_original?.substring(0, 4) || a.release_date?.substring(0, 4) || null,
    releaseDate: a.release_date_original || a.release_date || null,
    trackCount: a.tracks_count || a.maximum_track_count || 0,
    explicit: a.parental_advisory === true || a.explicit === true,
  };
}
