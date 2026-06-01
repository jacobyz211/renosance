import type { StreamResult } from '@resonance-addons/sdk';
import type { QTConfig } from '../index';
import { UA, TIMEOUT_MS, QOBUZ_BASE, QUALITY_FORMAT_MAP, QOBUZ_INSTANCES, DEFAULT_HIFI_INSTANCES, APP_ID, USER_TOKEN, SECRET } from '../config';
import { cGet, cSet } from '../cache';
import { md5, httpGet } from '../utils';
import { getWorkingHiFiInstance } from './shared';

const STREAM_TTL = 200;

export async function handleStream(config: QTConfig, rawTrackId: string): Promise<StreamResult> {
  const trackId = rawTrackId.includes(':') ? rawTrackId.split(':').pop()! : rawTrackId;

  const qualitySetting = config.quality || 'HIRES';
  const tidalQuality   = config.tidalQuality || 'HIGH';
  const formatId       = QUALITY_FORMAT_MAP[qualitySetting.toUpperCase()] || 27;

  // ─── Qobuz stream ────────────────────────────────────────────────────────
  if (!trackId.startsWith('hifi:')) {
    const streamKey = `qt:stream:${trackId}:${formatId}`;
    const cached = cGet(streamKey) as any;
    if (cached?.url) return cached;

    const ts  = Math.floor(Date.now() / 1000);
    const sig = md5(
      'trackgetFileUrlformat_id' + formatId +
      'intentstreamtrack_id' + trackId + ts + SECRET
    );
    const directUrl =
      `${QOBUZ_BASE}/track/getFileUrl` +
      `?app_id=${APP_ID}` +
      `&user_auth_token=${encodeURIComponent(USER_TOKEN)}` +
      `&track_id=${encodeURIComponent(trackId)}` +
      `&format_id=${formatId}` +
      `&intent=stream` +
      `&request_ts=${ts}` +
      `&request_sig=${sig}`;

    let streamData: any = null;

    // ── 1. Direct Qobuz API ──
    try {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      const r = await fetch(directUrl, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
      clearTimeout(timer);
      if (!r.ok) throw new Error('Direct Qobuz stream HTTP ' + r.status);
      streamData = await r.json();
    } catch {
      // ── 2. Proxy fallback — same signed params forwarded ──
      for (const inst of QOBUZ_INSTANCES) {
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 7000);
        try {
          const u = new URL(`${inst}/track/getFileUrl`);
          u.searchParams.set('app_id',          APP_ID);
          u.searchParams.set('user_auth_token', USER_TOKEN);
          u.searchParams.set('track_id',        trackId);
          u.searchParams.set('format_id',       String(formatId));
          u.searchParams.set('intent',          'stream');
          u.searchParams.set('request_ts',      String(ts));
          u.searchParams.set('request_sig',     sig);
          const r = await fetch(u.toString(), { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: ctrl.signal });
          clearTimeout(timer);
          if (!r.ok) { await r.arrayBuffer().catch(() => {}); throw new Error('HTTP ' + r.status); }
          streamData = await r.json();
          if (streamData?.url) break;
        } catch { clearTimeout(timer); continue; }
      }
    }

    if (!streamData?.url) throw new Error(`No stream URL found for track ${trackId}`);

    const result: StreamResult = {
      url:             streamData.url,
      format:          formatId === 5 ? 'mp3' : 'flac',
      durationSeconds: streamData.duration ?? null,
      bitrate:         formatId === 5 ? 320 : (formatId === 6 ? 1411 : null),
    };
    cSet(streamKey, result, STREAM_TTL);
    return result;
  }

  // ─── Tidal/HiFi stream ───────────────────────────────────────────────────
  const realId    = trackId.replace('hifi:', '');
  const inst      = await getWorkingHiFiInstance(DEFAULT_HIFI_INSTANCES);

  let streamUrl: string | null = null;
  let duration:  number | null = null;

  for (const path of [
    `/track/stream?id=${encodeURIComponent(realId)}&quality=${tidalQuality}`,
    `/track/?id=${encodeURIComponent(realId)}&quality=${tidalQuality}`,
    `/track/${encodeURIComponent(realId)}?quality=${tidalQuality}`,
  ]) {
    try {
      const data = await httpGet(inst + path, null, TIMEOUT_MS) as any;
      streamUrl = data?.data?.url || data?.url || data?.streamUrl || null;
      duration  = data?.data?.duration || data?.duration || null;
      if (streamUrl) break;
    } catch { continue; }
  }

  if (!streamUrl) {
    for (const fallbackInst of DEFAULT_HIFI_INSTANCES) {
      for (const path of [
        `/track/stream?id=${encodeURIComponent(realId)}&quality=${tidalQuality}`,
        `/track/?id=${encodeURIComponent(realId)}&quality=${tidalQuality}`,
      ]) {
        try {
          const data = await httpGet(fallbackInst + path, null, 6000) as any;
          streamUrl = data?.data?.url || data?.url || null;
          duration  = data?.data?.duration || data?.duration || null;
          if (streamUrl) break;
        } catch { continue; }
      }
      if (streamUrl) break;
    }
  }

  if (!streamUrl) throw new Error(`No HiFi stream URL found for track ${realId}`);

  return { url: streamUrl, format: 'aac', durationSeconds: duration };
}
