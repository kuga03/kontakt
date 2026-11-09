/**
 * Cloudflare Worker: OTA manifest + boot-gate version endpoint (CORS).
 *
 * Env vars (Worker Settings → Variables):
 *   GAME_VERSION   - fallback version, e.g. "Beta v0.21"
 *   MANIFEST_URL   - (optional) public URL to a JSON manifest {version,url,checksum?}
 *                    When set, the worker fetches and returns it (CI updates that file in R2).
 *                    Falls back to GAME_VERSION-only response if fetch fails.
 */
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const fallback = { version: env.GAME_VERSION || 'Beta v0.21' };
    if (env.MANIFEST_URL) {
      try {
        const r = await fetch(env.MANIFEST_URL, { cf: { cacheTtl: 0, cacheEverything: false } });
        if (r && r.ok) {
          const m = await r.json();
          if (m && typeof m.version === 'string') {
            return new Response(JSON.stringify(m), { status: 200, headers: cors });
          }
        }
      } catch (e) { /* fall through */ }
    }
    return new Response(JSON.stringify(fallback), { status: 200, headers: cors });
  }
};
