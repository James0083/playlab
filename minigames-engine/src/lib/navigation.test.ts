import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backGoesHome, homePathOf } from './navigation.ts';

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

test('뒤로 가기: 시작·결과 화면에서는 홈으로, 카운트다운·플레이 중에는 아니다', () => {
  assert.equal(backGoesHome('idle'), true);
  assert.equal(backGoesHome('result'), true);
  assert.equal(backGoesHome('countdown'), false);
  assert.equal(backGoesHome('playing'), false);
});
