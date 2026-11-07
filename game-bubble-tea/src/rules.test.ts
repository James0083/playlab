import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyShake,
  DURATION_MS,
  finalResult,
  intensityFromMotion,
  intensityFromPointer,
  MAX_INTENSITY,
  MAX_SCORE,
  NOISE_FLOOR,
  rateSecond,
  SPILL_ENVELOPE,
  STEADY_TARGET,
  startShake,
  type ShakeState,
} from './rules.ts';

/** 휴대폰 센서 이벤트 간격(약 60Hz) */
const FRAME_MS = 16;

/** 처음부터 끝까지 stepMs마다 intensityAt(시각) 세기로 흔든 결과 */
function shakeFor(intensityAt: (atMs: number) => number, stepMs = FRAME_MS): ShakeState {
  let state = startShake();
  for (let atMs = 0; atMs < DURATION_MS; atMs += stepMs) {
    state = applyShake(state, { atMs, intensity: intensityAt(atMs) });
  }
  return state;
}

/** 실제 흔들기처럼 세기가 0과 amplitude 사이를 오가는 손동작(4Hz) */
const wave = (amplitude: number) => (atMs: number) =>
  Math.abs(amplitude * Math.sin((2 * Math.PI * 4 * atMs) / 1_000));

const still = { x: 0, y: 0, z: 0 };

test('세기는 중력을 뺀 가속도 크기로 재고, 아주 센 값은 상한에서 멈춘다', () => {
  const linear = { x: 3, y: 4, z: 0 };
  assert.equal(intensityFromMotion({ acceleration: still, linearAcceleration: linear }), 5);
  assert.equal(
    intensityFromMotion({ acceleration: still, linearAcceleration: { x: 500, y: 0, z: 0 } }),
    MAX_INTENSITY,
  );
});

test('중력을 분리하지 못하는 기기는 |중력 포함 가속도| − 중력으로 잰다', () => {
  const resting = intensityFromMotion({
    acceleration: { x: 0, y: 9.81, z: 0 },
    linearAcceleration: null,
  });
  assert.ok(resting < 1e-9);
});

test('문지르기 세기는 픽셀이 아니라 영역 폭 기준이다(폭 3개/초 = 12)', () => {
  assert.equal(intensityFromPointer({ distanceRatio: 0.3, durationMs: 100 }), 12);
  assert.equal(intensityFromPointer({ distanceRatio: 0.5, durationMs: 0 }), 0);
});

test('잡음 경계: 바로 아래 세기는 섞기로 치지 않고, 경계값부터 친다', () => {
  assert.equal(shakeFor(() => NOISE_FLOOR - 0.01).mix, 0);
  assert.ok(shakeFor(() => NOISE_FLOOR).mix > 0);
});

test('넘침 경계: 부드럽게 만든 세기가 기준 바로 아래면 넘치지 않고, 기준을 넘으면 넘친다', () => {
  assert.equal(shakeFor(() => SPILL_ENVELOPE - 0.5).spillTimesMs.length, 0);
  assert.ok(shakeFor(() => SPILL_ENVELOPE + 0.5).spillTimesMs.length > 0);
});

test('순간 튄 샘플 하나로는 넘치지 않는다', () => {
  const state = shakeFor((atMs) => (atMs === 4_000 ? MAX_INTENSITY : 12));
  assert.equal(state.spillTimesMs.length, 0);
});

test('계속 너무 세게 흔들어도 넘침은 1초에 한 번까지만 센다', () => {
  assert.equal(shakeFor(() => MAX_INTENSITY).spillTimesMs.length, 10);
});

test('같은 손동작이면 센서 빈도(30·60·200Hz)가 달라도 결과가 같다', () => {
  for (const amplitude of [18, 22, 26]) {
    const scores = [1_000 / 30, 1_000 / 60, 1_000 / 200].map(
      (stepMs) => finalResult(shakeFor(wave(amplitude), stepMs)).score,
    );
    assert.deepEqual(scores, [MAX_SCORE, MAX_SCORE, MAX_SCORE], `진폭 ${amplitude}`);
  }
});

test('적정 세기로 10초 내내 흔들면 최고 점수를 받는다', () => {
  const result = finalResult(shakeFor(() => 12));
  assert.equal(result.mixPercent, 100);
  assert.equal(result.steadySeconds, 10);
  assert.equal(result.spills, 0);
  assert.equal(result.score, MAX_SCORE);
});

test('1초 구간 평가: 목표의 0.75배 바로 아래는 약함, 1.5배를 넘으면 셈, 그 안은 적정', () => {
  const withSecond = (amount: number): ShakeState => ({
    ...startShake(),
    buckets: [STEADY_TARGET, amount, ...Array.from({ length: 8 }, () => 0)],
  });
  assert.equal(rateSecond(withSecond(STEADY_TARGET * 0.75), 1), 'steady');
  assert.equal(rateSecond(withSecond(STEADY_TARGET * 0.75 - 0.01), 1), 'weak');
  assert.equal(rateSecond(withSecond(STEADY_TARGET * 1.5), 1), 'steady');
  assert.equal(rateSecond(withSecond(STEADY_TARGET * 1.5 + 0.01), 1), 'strong');
});

test('첫 1초는 반응 시간을 감안해 목표의 0.6배부터 적정으로 본다', () => {
  const state: ShakeState = {
    ...startShake(),
    buckets: [STEADY_TARGET * 0.6, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
  assert.equal(rateSecond(state, 0), 'steady');
});

test('넘친 1초 구간은 넘침으로 평가한다', () => {
  const state: ShakeState = { ...startShake(), spillTimesMs: [3_500] };
  assert.equal(rateSecond(state, 3), 'spill');
});

test('흔들지 않거나 잡음 수준으로만 흔들면 보너스도 없이 0점이다', () => {
  assert.equal(finalResult(startShake()).score, 0);
  assert.equal(finalResult(shakeFor(() => NOISE_FLOOR - 0.01)).score, 0);
});

test('앞쪽에만 몰아서 흔들면 다 섞여도 적정 보너스를 못 받는다', () => {
  const burst = finalResult(shakeFor((atMs) => (atMs < 5_000 ? 19.5 : 0)));
  assert.equal(burst.mixPercent, 100);
  assert.ok(burst.steadySeconds <= 5);
  assert.ok(burst.score < MAX_SCORE);
});

test('샘플 사이가 크게 벌어져도 그 사이 전체를 흔든 것으로 치지 않는다', () => {
  // 0초와 5초에 샘플 두 개: 인정되는 간격은 0.25초뿐
  let state = applyShake(startShake(), { atMs: 0, intensity: 12 });
  state = applyShake(state, { atMs: 5_000, intensity: 12 });
  assert.ok(state.mix <= 12 * 0.25 + 1e-9);
});

test('같은 시각이나 지난 시각, 플레이 시간 밖의 샘플은 무시한다', () => {
  const start = applyShake(startShake(), { atMs: 100, intensity: 12 });
  assert.equal(applyShake(start, { atMs: 100, intensity: 12 }), start);
  assert.equal(applyShake(start, { atMs: 50, intensity: 12 }), start);
  assert.equal(applyShake(start, { atMs: DURATION_MS, intensity: 12 }), start);
  assert.equal(applyShake(startShake(), { atMs: -1, intensity: 12 }).lastAtMs, null);
});

test('넘칠 때마다 감점되지만 점수는 0 아래로 내려가지 않는다', () => {
  assert.equal(finalResult(shakeFor(() => MAX_INTENSITY)).score, 0);
});
