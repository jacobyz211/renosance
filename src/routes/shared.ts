import { UA, DEFAULT_HIFI_INSTANCES } from '../config';
import { cGet, cSet } from '../cache';
import { httpGet } from '../utils';

export { httpGet } from '../utils';
export { md5 } from '../utils';

export async function getWorkingHiFiInstance(instances: string[]): Promise<string> {
  const list     = instances.length ? instances : DEFAULT_HIFI_INSTANCES;
  const cacheKey = 'qt:hifi:working:v4';
  const cached   = cGet(cacheKey) as string | null;
  if (cached) return cached;
  for (const inst of list) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      const r = await fetch(`${inst}/search/?s=test&limit=1`, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(timer);
      await r.arrayBuffer().catch(() => {});
      if (r.ok) { cSet(cacheKey, inst, 300); return inst; }
    } catch { clearTimeout(timer); }
  }
  return DEFAULT_HIFI_INSTANCES[4];
}

export async function fetchHifi(path: string, instances: string[]): Promise<any> {
  const inst = await getWorkingHiFiInstance(instances);
  return httpGet(inst + path, null, 12000);
}

export async function fetchHifiAny(path: string, instances: string[]): Promise<any> {
  const list = instances.length ? instances : DEFAULT_HIFI_INSTANCES;
  for (const inst of list) {
    try { return await httpGet(inst + path, null, 6000); } catch {}
  }
  throw new Error('All HiFi instances failed: ' + path);
}
