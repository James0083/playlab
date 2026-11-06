import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { createHandler } from './worker.js';

const handler = createHandler({ '/games/a': 'https://game-a.pages.dev' });
const env = { ASSETS: { fetch: async () => new Response('home') } };
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function mockUpstream(response) {
  const calls = [];
  globalThis.fetch = async (request, init) => {
    calls.push({ url: request.url, init });
    return response;
  };
  return calls;
}

test('접두사를 제거하고 쿼리를 유지해 프록시한다', async () => {
  const calls = mockUpstream(new Response('game'));
  const res = await handler.fetch(new Request('https://x.test/games/a/assets/a.js?v=1'), env);
  assert.equal(calls[0].url, 'https://game-a.pages.dev/assets/a.js?v=1');
  assert.equal(await res.text(), 'game');
});

test('접두사 정확히 일치하면 루트로 보낸다', async () => {
  const calls = mockUpstream(new Response('game'));
  await handler.fetch(new Request('https://x.test/games/a'), env);
  assert.equal(calls[0].url, 'https://game-a.pages.dev/');
});

test('접두사만 비슷한 경로는 홈으로 넘긴다', async () => {
  const res = await handler.fetch(new Request('https://x.test/games/abc'), env);
  assert.equal(await res.text(), 'home');
});

test('Pages 리다이렉트를 공개 경로로 되돌린다', async () => {
  mockUpstream(new Response(null, { status: 308, headers: { location: '/about' } }));
  const res = await handler.fetch(new Request('https://x.test/games/a/about.html'), env);
  assert.equal(res.status, 308);
  assert.equal(res.headers.get('location'), 'https://x.test/games/a/about');
});

test('외부 리다이렉트는 그대로 둔다', async () => {
  mockUpstream(new Response(null, { status: 302, headers: { location: 'https://other.test/x' } }));
  const res = await handler.fetch(new Request('https://x.test/games/a/out'), env);
  assert.equal(res.headers.get('location'), 'https://other.test/x');
});

test('GET/HEAD 외 메서드는 거부한다', async () => {
  const res = await handler.fetch(
    new Request('https://x.test/games/a', { method: 'POST', body: 'x' }),
    env,
  );
  assert.equal(res.status, 405);
});
