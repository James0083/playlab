import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adviceFor } from './advice.ts';
import type { StirResult, Stroke } from './rules.ts';

/** 다 비비고 보너스를 다 받은 결과에서 일부만 바꿔 쓴다 */
function result(overrides: Partial<StirResult>): StirResult {
  return {
    score: 150,
    mixPercent: 100,
    switches: 6,
    mixedAtMs: 6_500,
    clumpedTurns: 0,
    strokes: Array.from({ length: 8 }, (_, i) => ({ direction: i % 2 ? -1 : 1, turns: 1.8 })),
    ...overrides,
  };
}

test('덜 비볐고 많이 뭉쳤으면 뭉침부터 알려 준다', () => {
  assert.match(adviceFor(result({ mixPercent: 60, clumpedTurns: 3 })), /뭉쳤어요/);
});

test('덜 비볐는데 뭉치지 않았으면 더 빨리', () => {
  assert.match(adviceFor(result({ mixPercent: 80, clumpedTurns: 0.2 })), /빨리 휘저어/);
});

test('방향 바꾸기가 모자라면: 짧게 바꾼 구간이 많으면 1바퀴를 채우라고, 아니면 횟수를', () => {
  const short = Array.from({ length: 10 }, (_, i): Stroke => ({
    direction: i % 2 === 0 ? 1 : -1,
    turns: 0.6,
  }));
  assert.match(adviceFor(result({ switches: 1, strokes: short })), /1바퀴는 채우고/);
  assert.match(adviceFor(result({ switches: 3 })), /6번 바꾸면/);
});

test('다 받았지만 조금 뭉쳤거나 늦게 다 비볐으면 그것을, 아니면 완벽', () => {
  assert.match(adviceFor(result({ clumpedTurns: 0.4 })), /2바퀴 넘기 전에/);
  assert.match(adviceFor(result({ mixedAtMs: 9_000 })), /시간 보너스/);
  assert.match(adviceFor(result({})), /완벽/);
});
