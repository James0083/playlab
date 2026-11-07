import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DURATION_MS, MAX_SCORE, MIN_TAP_INTERVAL_MS, scoreTap } from './rules.ts';

test('첫 탭은 언제 쳐도 점수가 된다', () => {
  assert.equal(scoreTap({ elapsedMs: 0, lastScoredMs: null }), 1);
});

test('인정 간격 경계: 바로 안쪽은 점수가 되고 바로 바깥쪽은 무시된다', () => {
  assert.equal(scoreTap({ elapsedMs: 1_000 + MIN_TAP_INTERVAL_MS, lastScoredMs: 1_000 }), 1);
  assert.equal(scoreTap({ elapsedMs: 1_000 + MIN_TAP_INTERVAL_MS - 1, lastScoredMs: 1_000 }), 0);
});

test('연타로는 최고 점수를 넘길 수 없다', () => {
  let score = 0;
  let lastScoredMs: number | null = null;
  // 1ms마다 탭하는 매크로
  for (let elapsedMs = 0; elapsedMs < DURATION_MS; elapsedMs++) {
    const points = scoreTap({ elapsedMs, lastScoredMs });
    if (points > 0) lastScoredMs = elapsedMs;
    score += points;
  }
  assert.equal(score, MAX_SCORE);
});
