import type { QTConfig } from '../index';
import { UA, TIMEOUT_MS, QOBUZ_BASE, QOBUZ_INSTANCES } from '../config';

export async function qobuzProxyGet(config: QTConfig, endpoint: string, params?: Record<string, string | number>): Promise<any> {
  const appId     = config.qobuzAppId;
  const userToken = config.qobuzUserToken;

  // Direct API first
  try {
    const url = new URL(QOBUZ_BASE + endpoint);
    url.searchParams.set('app_id', appId);
    url.searchParams.set('user_auth_token', userToken);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    const r = await fetch(url.toString(), { signal: ctrl.signal, headers: { 'User-Agent': UA } });
    clearTimeout(timer);
    if (!r.ok) throw new Error('Direct Qobuz HTTP ' + r.status);
    return await r.json();
  } catch (directErr) {
    // Proxy fallback
    for (const inst of QOBUZ_INSTANCES) {
      const ctrl  = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 7000);
      try {
        const u = new URL(inst + endpoint);
        if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
        const r = await fetch(u.toString(), { headers: { 'User-Agent': UA }, signal: ctrl.signal });
        clearTimeout(timer);
        if (!r.ok) { await r.arrayBuffer().catch(() => {}); throw new Error('HTTP ' + r.status); }
        return await r.json();
      } catch { clearTimeout(timer); continue; }
    }
    throw new Error('All Qobuz sources failed for ' + endpoint);
  }
}
