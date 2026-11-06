import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGameClock } from './clock.ts';

test('오디오가 재생 중이면 오디오 시각으로 경과 시간을 잰다', () => {
  const audio = { currentTime: 10, state: 'running' as const };
  const clock = createGameClock(audio);

  audio.currentTime = 11.5;
  assert.equal(clock.elapsedMs(), 1_500);
  assert.equal(clock.toAudioTime(2_000), 12);
});

test('오디오가 멈춰 있으면 performance 시계로 대체하고 효과음 예약은 하지 않는다', () => {
  let nowMs = 500;
  const clock = createGameClock({ currentTime: 0, state: 'suspended' }, () => nowMs);

  nowMs = 1_250;
  assert.equal(clock.elapsedMs(), 750);
  assert.equal(clock.toAudioTime(1_000), null);
});

test('오디오를 쓸 수 없는 환경에서도 시계가 흐른다', () => {
  let nowMs = 0;
  const clock = createGameClock(null, () => nowMs);

  nowMs = 100;
  assert.equal(clock.elapsedMs(), 100);
});
