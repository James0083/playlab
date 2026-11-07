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

test('출력 지연이 있으면 화면·판정 시계를 그만큼 늦춰 들리는 소리에 맞춘다', () => {
  const audio = {
    currentTime: 10,
    state: 'running' as const,
    baseLatency: 0.01,
    outputLatency: 0.19,
  };
  const clock = createGameClock(audio);
  audio.currentTime = 11.2;
  // 1.2초 지났지만 소리는 0.2초 늦게 들리므로 들리는 기준으로는 1.0초
  assert.ok(Math.abs(clock.elapsedMs() - 1_000) < 1e-6);
  // 예약 시각은 그대로(소리는 지연을 거쳐 들리면서 화면과 맞는다)
  assert.equal(clock.toAudioTime(2_000), 12);
});
