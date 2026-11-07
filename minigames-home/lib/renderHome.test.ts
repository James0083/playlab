import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GAMES } from './games.ts';
import { GAMES_PLACEHOLDER, renderHome } from './renderHome.ts';

const template = readFileSync(new URL('../src/index.html', import.meta.url), 'utf8');

test('실제 홈 템플릿에 게임 목록 자리표시자가 있다 (포맷터가 바꿔도 깨지지 않게)', () => {
  assert.ok(template.includes(GAMES_PLACEHOLDER));
});

test('들어갈 수 있는 게임은 링크, 아닌 게임은 준비 중으로 보인다', () => {
  const html = renderHome(template, GAMES, { isPlayable: (game) => game.slug === 'tteokchigi' });
  assert.match(html, /href="\/games\/tteokchigi\/"/);
  assert.doesNotMatch(html, /href="\/games\/dalgona\/"/);
  assert.match(html, /달고나 뽑기<\/span> \(준비 중\)/);
  assert.equal(html.includes(GAMES_PLACEHOLDER), false);
});

test('자리표시자가 없는 템플릿은 오류를 낸다', () => {
  assert.throws(() => renderHome('<ul></ul>', GAMES, { isPlayable: () => true }));
});

test('카드마다 내 최고기록을 채울 자리가 있다', () => {
  const html = renderHome(template, GAMES, { isPlayable: () => true });
  assert.match(html, /data-best-slug="tteokchigi"/);
});
