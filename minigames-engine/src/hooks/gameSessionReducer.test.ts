import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createInitialState, gameSessionReducer as reduce } from './gameSessionReducer.ts';

const playing = (durationMs: number | null = 10_000) =>
  reduce(reduce(createInitialState(durationMs), { type: 'start' }), { type: 'begin', now: 1_000 });

test('start → begin으로 카운트다운을 거쳐 플레이가 시작된다', () => {
  const counting = reduce(createInitialState(10_000), { type: 'start' });
  assert.equal(counting.phase, 'countdown');

  const state = reduce(counting, { type: 'begin', now: 1_000 });
  assert.equal(state.phase, 'playing');
  assert.equal(state.startedAt, 1_000);
});

test('플레이 중에만 점수가 오른다', () => {
  const idle = reduce(createInitialState(10_000), { type: 'addScore', delta: 5 });
  assert.equal(idle.score, 0);

  assert.equal(reduce(playing(), { type: 'addScore', delta: 5 }).score, 5);
});

test('시간이 다 되면 결과 단계로 넘어간다', () => {
  const ticking = reduce(playing(), { type: 'tick', now: 4_000 });
  assert.equal(ticking.remainingMs, 7_000);

  const finished = reduce(ticking, { type: 'tick', now: 11_000 });
  assert.equal(finished.phase, 'result');
  assert.equal(finished.remainingMs, 0);
});

test('무한 콤보 방식은 시간이 지나도 끝나지 않고 end로만 끝난다', () => {
  const state = reduce(playing(null), { type: 'tick', now: 999_999 });
  assert.equal(state.phase, 'playing');
  assert.equal(reduce(state, { type: 'end' }).phase, 'result');
});

test('start는 이전 판의 점수를 지운다', () => {
  const scored = reduce(playing(), { type: 'addScore', delta: 5 });
  const restarted = reduce(reduce(scored, { type: 'end' }), { type: 'start' });
  assert.equal(restarted.score, 0);
  assert.equal(restarted.remainingMs, 10_000);
});
