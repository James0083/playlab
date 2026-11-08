import assert from 'node:assert/strict';
import { test } from 'node:test';
import { homePathOf } from './navigation.ts';

test('Cloudflare(루트 배포)에서는 게임 주소의 홈이 / 이다', () => {
  assert.equal(homePathOf('/games/dalgona/'), '/');
  assert.equal(homePathOf('/games/bubble-tea/index.html'), '/');
});

test('GitHub Pages(저장소 이름 경로)에서는 /games/ 앞까지가 홈이다', () => {
  assert.equal(homePathOf('/playlab/games/dalgona/'), '/playlab/');
});

test('게임 주소가 아니면 / 로 간다', () => {
  assert.equal(homePathOf('/'), '/');
  assert.equal(homePathOf('/about'), '/');
});
