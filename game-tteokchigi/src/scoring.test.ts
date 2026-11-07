import assert from 'node:assert/strict';
import { test } from 'node:test';
import { scheduleBeats } from './rules.ts';
import {
  comboMultiplier,
  initialScoreState,
  MAX_SCORE,
  scoreTap,
  type ScoreState,
} from './scoring.ts';
import type { Judgement } from './rules.ts';

/** 판정과 박자 번호를 차례로 넣어 최종 상태와 총점을 구한다 */
function play(taps: readonly [Judgement, number][]): { state: ScoreState; total: number } {
  let state = initialScoreState();
  let total = 0;
  for (const [judgement, beatIndex] of taps) {
    const result = scoreTap(state, { judgement, beatIndex });
    state = result.state;
    total = Math.max(total + result.delta, 0);
  }
  return { state, total };
}

test('콤보 배율: 10콤보부터 2배, 30콤보부터 3배', () => {
  assert.equal(comboMultiplier(9), 1);
  assert.equal(comboMultiplier(10), 2);
  assert.equal(comboMultiplier(30), 3);
});

test('연속 박자를 맞히면 콤보가 쌓이고 배율이 점수에 곱해진다', () => {
  const taps = Array.from({ length: 10 }, (_, i): [Judgement, number] => ['GREAT', i]);
  const { state, total } = play(taps);
  assert.equal(state.combo, 10);
  assert.equal(total, 9 * 3 + 3 * 2); // 9번은 ×1, 10번째는 ×2
});

test('박자를 건너뛰거나 MISS하면 콤보가 끊긴다', () => {
  assert.equal(
    play([
      ['GOOD', 0],
      ['GOOD', 2],
    ]).state.combo,
    1,
  );
  assert.equal(
    play([
      ['GOOD', 0],
      ['MISS', 1],
      ['GOOD', 1],
    ]).state.combo,
    1,
  );
});

test('첫 MISS는 감점이 없고, 연속 MISS부터 1점씩 깎인다 (연타 방지)', () => {
  assert.equal(
    play([
      ['PERFECT', 0],
      ['MISS', 0],
    ]).total,
    2,
  );
  assert.equal(
    play([
      ['PERFECT', 0],
      ['MISS', 0],
      ['MISS', 0],
      ['MISS', 0],
    ]).total,
    0,
  );
});

test('판정별 개수와 최대 콤보를 기록한다', () => {
  const { state } = play([
    ['GREAT', 0],
    ['GREAT', 1],
    ['MISS', 2],
    ['GOOD', 3],
  ]);
  assert.deepEqual(state.counts, { GREAT: 2, PERFECT: 0, GOOD: 1, MISS: 1 });
  assert.equal(state.maxCombo, 2);
});

test('최고 점수는 모든 박자를 GREAT로 콤보를 이어 친 점수다 (마이그레이션 max_score와 같아야 함)', () => {
  const beats = scheduleBeats().length;
  const expected = Array.from({ length: beats }, (_, i) => 3 * comboMultiplier(i + 1)).reduce(
    (a, b) => a + b,
  );
  assert.equal(MAX_SCORE, expected);
});
