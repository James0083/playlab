import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { GAMES } from './games.ts';
import {
  BASE_PATH_PLACEHOLDER,
  GAMES_PLACEHOLDER,
  normalizeBasePath,
  renderHome,
  withBasePath,
} from './renderHome.ts';

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

test('GitHub Pages처럼 경로 앞부분이 있으면 게임 링크 앞에 붙인다', () => {
  const html = renderHome(template, GAMES, { isPlayable: () => true, basePath: '/playlab/' });
  assert.match(html, /href="\/playlab\/games\/tteokchigi\/"/);
});

test('경로 앞부분은 앞뒤에 /가 붙은 꼴로 맞춘다', () => {
  assert.equal(normalizeBasePath(undefined), '/');
  assert.equal(normalizeBasePath(''), '/');
  assert.equal(normalizeBasePath('/'), '/');
  assert.equal(normalizeBasePath('/playlab'), '/playlab/');
  assert.equal(normalizeBasePath('playlab/'), '/playlab/');
});

test('404 페이지의 홈으로 링크가 경로 앞부분을 따른다', () => {
  const notFound = readFileSync(new URL('../src/404.html', import.meta.url), 'utf8');
  assert.ok(notFound.includes(`href="${BASE_PATH_PLACEHOLDER}"`));
  assert.match(withBasePath(notFound, '/playlab/'), /href="\/playlab\/">홈으로/);
});

test('카드에 게임 그림(SVG)이 들어가고, 그림이 없는 게임은 이모지가 나온다', () => {
  const html = renderHome(template, GAMES, { isPlayable: () => true });
  assert.match(html, /<span class="art"><svg[^>]*>[\s\S]*?<\/svg><\/span>/);
  const unknown = [{ ...GAMES[0], slug: 'unknown-game', emoji: '🎲' }];
  assert.match(
    renderHome(template, unknown, { isPlayable: () => true }),
    /class="art emoji"[^>]*>🎲/,
  );
});
