import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adviceFor, type TopResult } from './advice.ts';

function result(overrides: Partial<TopResult>): TopResult {
  return {
    score: 250,
    startRpm: 1_800,
    reversedTurns: 0,
    survivedMs: 25_000,
    reason: 'stopped',
    ...overrides,
  };
}

test('느리게 돌렸으면 돌리기부터: 반대로 돌렸으면 한 방향으로, 아니면 더 빨리', () => {
  assert.match(adviceFor(result({ startRpm: 600, reversedTurns: 2 })), /한 방향으로만/);
  assert.match(adviceFor(result({ startRpm: 600 })), /더 빨리 돌려요/);
});

test('충분히 돌렸는데 판 밖으로 나갔으면 기울이기', () => {
  assert.match(adviceFor(result({ reason: 'out', startRpm: 1_500 })), /반대쪽으로 기울여/);
});

test('끝까지 버텼으면 조금 더 빨리 또는 완벽', () => {
  assert.match(adviceFor(result({ startRpm: 1_440 })), /조금만 더 빨리/);
  assert.match(adviceFor(result({})), /완벽/);
});
