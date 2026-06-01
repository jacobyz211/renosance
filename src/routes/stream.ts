import type { StreamResult } from '@resonance-addons/sdk';
import type { QTConfig } from '../index';
import { UA, TIMEOUT_MS, QOBUZ_BASE, QUALITY_FORMAT_MAP, DEFAULT_HIFI_INSTANCES } from '../config';
import { cGet, cSet } from '../cache';
import { md5, httpGet, getWorkingHiFiInstance } from './shared';
import { qobuzQualityLabel, tidalQualityLabel } from '../utils';

export async function handleStream(config: QTConfig, rawTrackId: string): Promise<StreamResult> {
  // Strip prefix if present (e.g. "com.resonance.qobuz-tidal:12345")
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
    const sig = md5('trackgetFileUrlformat_id' + formatId + 'intentstreamtrack_id' + trackId + ts + config.qobuzSecret);
    const url = `${QOBUZ_BASE}/track/getFileUrl?app_id=${config.qobuzAppId}&user_auth_token=${config.qobuzUserToken}&track_id=${trackId}&format_id=${formatId}&intent=stream&request_ts=${ts}&request_sig=${sig}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': UA } });
      clearTimeout(timer);
      if (!r.ok) throw new Error('Qobuz stream HTTP ' + r.status);
      const data = await r.json() as any;
      if (!data?.url) throw new Error('No URL in Qobuz response');
      const result: StreamResult = {
        url: data.url,
        format: formatId === 5 ? 'mp3' : 'flac',
        durationSeconds: data.duration || null,
        bitrate: formatId === 5 ? 320 : null,
      };
      cSet(streamKey, result, 200);
      return result;
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  }

  // ─── Tidal/HiFi stream ───────────────────────────────────────────────────
  const realId    = trackId.replace('hifi:', '');
  const instances = config.hifiInstances?.split(',').map(s => s.trim()).filter(Boolean) || DEFAULT_HIFI_INSTANCES;
  const inst      = await getWorkingHiFiInstance(instances);

  const data = await httpGet(`${inst}/track/?id=${encodeURIComponent(realId)}&quality=${tidalQuality}`, null, TIMEOUT_MS) as any;
  const streamUrl = data?.data?.url || data?.url;
  if (!streamUrl) throw new Error('No HiFi stream URL found');

  return {
    url: streamUrl,
    format: 'aac',
    durationSeconds: data?.data?.duration || data?.duration || null,
  };
}
