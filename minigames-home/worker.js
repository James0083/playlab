import { GAMES } from './lib/games.ts';

const liveRoutes = () =>
  Object.fromEntries(
    GAMES.filter((g) => g.status === 'live').map((g) => [`/games/${g.slug}`, g.origin]),
  );

/** Pages가 보낸 리다이렉트는 pages.dev 기준이므로 공개 경로로 되돌린다. */
function rewriteLocation(location, targetUrl, origin, prefix, publicUrl) {
  const resolved = new URL(location, targetUrl);
  if (resolved.origin !== new URL(origin).origin) return location;
  return new URL(prefix + resolved.pathname + resolved.search + resolved.hash, publicUrl).href;
}

export function createHandler(routes) {
  return {
    async fetch(request, env) {
      const url = new URL(request.url);

      for (const [prefix, origin] of Object.entries(routes)) {
        if (url.pathname !== prefix && !url.pathname.startsWith(`${prefix}/`)) continue;

        // 게임은 정적 파일만 서빙한다. 점수 API는 Supabase로 바로 간다.
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          return new Response('Method Not Allowed', {
            status: 405,
            headers: { Allow: 'GET, HEAD' },
          });
        }

        const targetUrl = new URL((url.pathname.slice(prefix.length) || '/') + url.search, origin);
        const upstream = await fetch(new Request(targetUrl, request), { redirect: 'manual' });
        const response = new Response(upstream.body, upstream);

        const location = upstream.headers.get('location');
        if (location) {
          response.headers.set(
            'location',
            rewriteLocation(location, targetUrl, origin, prefix, url),
          );
        }
        return response;
      }

      return env.ASSETS.fetch(request);
    },
  };
}

export default createHandler(liveRoutes());
