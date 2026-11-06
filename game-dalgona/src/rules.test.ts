import assert from 'node:assert/strict';
import { test } from 'node:test';
import { finalScore, MAX_SCORE, parseUnlockedCount, unlockAfterClear } from './rules.ts';
import { getShape } from './shapes.ts';
import { startTrace } from './trace.ts';

const square = getShape(2); // 기준 300점

test('완벽하게 뽑으면 기준 점수를 그대로 받는다', () => {
  assert.equal(finalScore(square, startTrace(square)), 300);
});

test('정확도가 0이면 절반, 금 하나당 15%씩 깎인다', () => {
  const sloppy = { ...startTrace(square), deviationTotal: 50, sampleCount: 10 }; // 평균 이탈 5 = 정확도 0
  assert.equal(finalScore(square, sloppy), 150);
  const cracked = { ...startTrace(square), cracks: 2 };
  assert.equal(finalScore(square, cracked), 210);
});

test('최고 점수는 토끼 기준 점수 (마이그레이션 max_score와 같아야 함)', () => {
  assert.equal(MAX_SCORE, 800);
});

test('해금 수는 저장값이 없거나 이상하면 1, 범위를 넘으면 전체 수', () => {
  assert.equal(parseUnlockedCount(null, 6), 1);
  assert.equal(parseUnlockedCount('abc', 6), 1);
  assert.equal(parseUnlockedCount('0', 6), 1);
  assert.equal(parseUnlockedCount('4', 6), 4);
  assert.equal(parseUnlockedCount('99', 6), 6);
});

test('모양을 완성하면 다음 모양이 열리고, 이미 연 것은 줄지 않는다', () => {
  assert.equal(unlockAfterClear(1, 0, 6), 2);
  assert.equal(unlockAfterClear(4, 0, 6), 4);
  assert.equal(unlockAfterClear(6, 5, 6), 6);
});
