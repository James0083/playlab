import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyElapsed,
  applyTap,
  COMBO_STEP,
  FIRST_KICK_MS,
  GOOD_WINDOW_MS,
  isMissed,
  judgeTap,
  kickTimeMs,
  MAX_KICKS,
  MAX_SCORE,
  MIN_PERIOD_MS,
  multiplierOf,
  PERFECT_WINDOW_MS,
  periodMs,
  scoreKick,
  startRound,
  START_PERIOD_MS,
  type RoundState,
} from './rules.ts';

/** 모든 킥을 차는 시각에서 offsetMs만큼 어긋나게 쳐서 끝까지(또는 끝날 때까지) 진행한다 */
function playAll(offsetMs: number): RoundState {
  let state = startRound();
  while (!state.isOver) state = applyTap(state, kickTimeMs(state.kicks) + offsetMs);
  return state;
}

test('주기는 킥마다 줄다가 최소값에서 멈춘다', () => {
  assert.equal(periodMs(0), START_PERIOD_MS);
  assert.ok(periodMs(5) < periodMs(4));
  assert.equal(periodMs(1_000), MIN_PERIOD_MS);
});

test('킥 시각은 첫 킥에서 시작해 주기만큼씩 늘어난다', () => {
  assert.equal(kickTimeMs(0), FIRST_KICK_MS);
  assert.equal(kickTimeMs(1), FIRST_KICK_MS + periodMs(0));
  assert.equal(kickTimeMs(2), FIRST_KICK_MS + periodMs(0) + periodMs(1));
});

test('이웃한 킥의 인정 범위는 겹치지 않는다', () => {
  for (let index = 0; index < MAX_KICKS; index++) {
    assert.ok(periodMs(index) > 2 * GOOD_WINDOW_MS);
  }
});

test('판정 경계: PERFECT 범위 안팎, GOOD 범위 안팎', () => {
  const at = (offsetMs: number) => judgeTap({ tapMs: kickTimeMs(0) + offsetMs, index: 0 });
  assert.deepEqual(
    [at(PERFECT_WINDOW_MS), at(-PERFECT_WINDOW_MS)].map((o) => o.kind === 'hit' && o.judgement),
    ['PERFECT', 'PERFECT'],
  );
  assert.equal((at(PERFECT_WINDOW_MS + 1) as { judgement: string }).judgement, 'GOOD');
  assert.equal((at(GOOD_WINDOW_MS) as { judgement: string }).judgement, 'GOOD');
  assert.deepEqual(at(-GOOD_WINDOW_MS - 1), { kind: 'miss', reason: 'early' });
});

test('점수 배율은 10킥마다 오른다', () => {
  assert.equal(multiplierOf(0), 1);
  assert.equal(multiplierOf(COMBO_STEP - 1), 1);
  assert.equal(multiplierOf(COMBO_STEP), 2);
  assert.equal(scoreKick('PERFECT', COMBO_STEP), 4);
  assert.equal(scoreKick('GOOD', COMBO_STEP * 2), 3);
});

test('모두 PERFECT면 최고 점수로 완주한다', () => {
  const state = playAll(0);
  assert.equal(state.reason, 'cleared');
  assert.equal(state.kicks, MAX_KICKS);
  assert.equal(state.score, MAX_SCORE);
  assert.equal(state.perfects, MAX_KICKS);
});

test('모두 GOOD이면 완주해도 최고 점수보다 낮다', () => {
  const state = playAll(GOOD_WINDOW_MS);
  assert.equal(state.reason, 'cleared');
  assert.equal(state.score, MAX_SCORE / 2);
});

test('첫 킥 전에 일찍 치면 바로 끝난다', () => {
  const state = applyTap(startRound(), 100);
  assert.equal(state.isOver, true);
  assert.equal(state.reason, 'early');
  assert.equal(state.score, 0);
});

test('치지 않고 범위가 지나면 놓친 것으로 끝난다', () => {
  const state = startRound();
  const limitMs = kickTimeMs(0) + GOOD_WINDOW_MS;
  assert.equal(isMissed({ elapsedMs: limitMs, index: 0 }), false);
  assert.equal(applyElapsed(state, limitMs).isOver, false);
  const missed = applyElapsed(state, limitMs + 1);
  assert.equal(missed.reason, 'late');
});

test('범위를 넘겨 늦게 도착한 탭은 놓친 것이다', () => {
  const state = applyTap(startRound(), kickTimeMs(0) + GOOD_WINDOW_MS + 1);
  assert.equal(state.reason, 'late');
});

test('연타하면 두 번째 탭에서 끝난다(한 킥에 한 번만 인정)', () => {
  let state = applyTap(startRound(), kickTimeMs(0));
  assert.equal(state.kicks, 1);
  state = applyTap(state, kickTimeMs(0) + 30);
  assert.equal(state.isOver, true);
  assert.equal(state.reason, 'early');
  assert.equal(state.kicks, 1);
});

test('1ms마다 치는 매크로는 첫 탭에서 끝나 점수를 못 얻는다', () => {
  let state = startRound();
  for (let tapMs = 0; tapMs < 10_000 && !state.isOver; tapMs++) state = applyTap(state, tapMs);
  assert.equal(state.score, 0);
});

test('끝난 판은 더 이상 바뀌지 않는다', () => {
  const over = applyTap(startRound(), 0);
  assert.equal(applyTap(over, kickTimeMs(0)), over);
  assert.equal(applyElapsed(over, 999_999), over);
});

test('킥 수가 쌓이면 PERFECT 점수가 배율만큼 오른다', () => {
  let state = startRound();
  for (let count = 0; count < COMBO_STEP + 1; count++) {
    state = applyTap(state, kickTimeMs(state.kicks));
  }
  // 10킥 × 2점 + 11번째 킥 2점 × 2배
  assert.equal(state.score, COMBO_STEP * 2 + 4);
});
