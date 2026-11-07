import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyShake,
  DURATION_MS,
  evennessOf,
  finalResult,
  intensityFromAcceleration,
  intensityFromPointer,
  MAX_INTENSITY,
  MAX_SCORE,
  mixRatio,
  NOISE_FLOOR,
  SPILL_INTENSITY,
  startShake,
  type ShakeState,
} from './rules.ts';

/** 휴대폰 센서 이벤트 간격(약 60Hz) */
const FRAME_MS = 16;

/** 처음부터 끝까지 FRAME_MS마다 intensityAt(시각) 세기로 흔든 결과 */
function shakeFor(intensityAt: (atMs: number) => number, stepMs = FRAME_MS): ShakeState {
  let state = startShake();
  for (let atMs = 0; atMs < DURATION_MS; atMs += stepMs) {
    state = applyShake(state, { atMs, intensity: intensityAt(atMs) });
  }
  return state;
}

test('가만히 들고 있으면(중력만) 세기는 0이고, 아주 센 값은 상한에서 멈춘다', () => {
  assert.ok(intensityFromAcceleration({ x: 0, y: 9.81, z: 0 }) < 1e-9);
  assert.ok(Math.abs(intensityFromAcceleration({ x: 0, y: 21.81, z: 0 }) - 12) < 1e-9);
  assert.equal(intensityFromAcceleration({ x: 500, y: 0, z: 0 }), MAX_INTENSITY);
});

test('마우스로 2px/ms 속도로 움직이면 목표 세기 12가 되고, 시간이 0이면 0이다', () => {
  assert.equal(intensityFromPointer({ distancePx: 200, durationMs: 100 }), 12);
  assert.equal(intensityFromPointer({ distancePx: 50, durationMs: 0 }), 0);
});

test('잡음 경계: 바로 아래 세기는 섞기로 치지 않고, 경계값부터 친다', () => {
  const below = shakeFor(() => NOISE_FLOOR - 0.01);
  const at = shakeFor(() => NOISE_FLOOR);
  assert.equal(below.mix, 0);
  assert.ok(at.mix > 0);
});

test('넘침 경계: 바로 아래 세기는 넘치지 않고, 경계값이면 넘친다', () => {
  const start = applyShake(startShake(), { atMs: 0, intensity: 0 });
  assert.equal(applyShake(start, { atMs: 16, intensity: SPILL_INTENSITY - 0.01 }).spills, 0);
  assert.equal(applyShake(start, { atMs: 16, intensity: SPILL_INTENSITY }).spills, 1);
});

test('한 번 넘친 뒤에는 세기가 충분히 내려왔다가 다시 올라가야 또 넘친 것으로 센다', () => {
  const steps = [26, 26, 20, 26, 10, 26];
  const state = steps.reduce(
    (acc, intensity, i) => applyShake(acc, { atMs: i * FRAME_MS, intensity }),
    startShake(),
  );
  // 26 → (20은 아직 넘치는 중) → 26은 같은 넘침, 10으로 진정 → 26에서 두 번째 넘침
  assert.equal(state.spills, 2);
});

test('10초 내내 알맞은 세기로 고르게 흔들면 최고 점수를 받는다', () => {
  const result = finalResult(shakeFor(() => 12));
  assert.equal(result.mixPercent, 100);
  assert.equal(result.spills, 0);
  assert.equal(result.score, MAX_SCORE);
});

test('흔들지 않거나 잡음 수준으로만 흔들면 보너스도 없이 0점이다', () => {
  assert.equal(finalResult(startShake()).score, 0);
  assert.equal(finalResult(shakeFor(() => NOISE_FLOOR - 0.01)).score, 0);
});

test('살살 고르게 흔들면 고르기 보너스는 섞인 만큼만, 넘치지 않음 보너스는 받지 못한다', () => {
  const state = shakeFor(() => 5);
  const mixed = mixRatio(state);
  assert.ok(mixed < 1);
  assert.ok(evennessOf(state) > 0.99);
  assert.equal(finalResult(state).score, Math.round(100 * mixed + 30 * evennessOf(state) * mixed));
});

test('앞쪽에만 몰아서 흔들면 고르게 흔든 것보다 점수가 낮다', () => {
  const even = finalResult(shakeFor(() => 12));
  const burst = finalResult(shakeFor((atMs) => (atMs < 5_000 ? 24 : 0)));
  assert.equal(burst.mixPercent, 100);
  assert.ok(burst.score < even.score);
});

test('센서 값을 부풀려도 상한 세기로만 계산되고 계속 넘친다', () => {
  const result = finalResult(shakeFor((atMs) => (Math.floor(atMs / 500) % 2 === 0 ? 1_000 : 0)));
  assert.ok(result.spills >= 10);
  assert.ok(result.score < MAX_SCORE / 2);
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
  const state: ShakeState = { ...startShake(), spills: 50 };
  assert.equal(finalResult(state).score, 0);
});
