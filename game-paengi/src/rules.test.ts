import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applySpin,
  FALL_RPM,
  MAX_RPM,
  MAX_SCORE,
  MAX_TURNS_PER_SECOND,
  rpmOf,
  scoreOf,
  SPIN_MS,
  startBalance,
  startSpin,
  stepBalance,
  STEP_MS,
  tiltFromKeys,
  tiltFromOrientation,
  tiltFromPointer,
  type BalanceState,
  type SpinState,
} from './rules.ts';

/** 정해진 씨앗으로 같은 난수를 다시 만든다(mulberry32) */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** 일정한 속도로 돌린다. 양수 = 시계 방향 */
function spin(turnsPerSecond: number, { hz = 60, untilMs = SPIN_MS } = {}): SpinState {
  let state = startSpin();
  for (let atMs = 0; atMs < untilMs; atMs += 1_000 / hz) {
    state = applySpin(state, { atMs, turns: turnsPerSecond / hz });
  }
  return state;
}

type Controller = (state: BalanceState) => { x: number; y: number };
const handsOff: Controller = () => ({ x: 0, y: 0 });
/** 위치·속도 반대쪽으로 기울이는 사람(반응이 느리면 delaySteps만큼 옛 상태를 본다) */
const steady: Controller = ({ position, velocity }) => ({
  x: -3 * position.x - 1.5 * velocity.x,
  y: -3 * position.y - 1.5 * velocity.y,
});

function balance(rpm: number, controller: Controller, { seed = 1, delaySteps = 0 } = {}) {
  const random = seededRandom(seed);
  let state = startBalance(rpm, random() * Math.PI * 2);
  const history: BalanceState[] = [];
  while (!state.fallen && state.elapsedMs < 60_000) {
    history.push(state);
    const seen = history[Math.max(history.length - 1 - delaySteps, 0)] ?? state;
    state = stepBalance(state, { tilt: controller(seen), drift: random() * 2 - 1 });
  }
  return state;
}

test('최고 회전은 1800 RPM(5초 동안 초당 3바퀴), 최고 점수는 250점(25초)', () => {
  assert.equal(MAX_RPM, 1_800);
  assert.equal(MAX_SCORE, 250);
});

test('돌리기: 초당 2바퀴로 5초면 약 10바퀴 = 1200 RPM', () => {
  const state = spin(2);
  assert.equal(state.direction, 1);
  assert.ok(Math.abs(rpmOf(state) - 1_200) < 6, `${rpmOf(state)}`);
});

test('돌리기: 반시계로 돌려도 같은 속도가 된다', () => {
  assert.ok(Math.abs(rpmOf(spin(-2)) - rpmOf(spin(2))) < 1e-9);
});

test('돌리기: 아무리 빨리 돌려도 초당 3바퀴까지만 인정한다', () => {
  assert.ok(rpmOf(spin(20)) <= MAX_RPM);
  assert.ok(spin(20).turns <= (MAX_TURNS_PER_SECOND * SPIN_MS) / 1_000);
});

test('돌리기: 반대로 돌리면 회전이 줄고, 0 아래로는 내려가지 않는다', () => {
  let state = spin(2, { untilMs: 2_000 }); // 약 4바퀴
  const before = state.turns;
  for (let atMs = 2_000; atMs < 3_000; atMs += 1_000 / 60) {
    state = applySpin(state, { atMs, turns: -2 / 60 });
  }
  assert.ok(Math.abs(state.turns - (before - 2)) < 0.05, `${state.turns}`);
  assert.ok(state.reversedTurns > 1.9);
  for (let atMs = 3_000; atMs < SPIN_MS; atMs += 1_000 / 60) {
    state = applySpin(state, { atMs, turns: -3 / 60 });
  }
  assert.equal(state.turns, 0);
});

test('돌리기: 제자리에서 앞뒤로 조금씩 흔들면 방향이 정해지지 않아 회전이 오르지 않는다', () => {
  let state = startSpin();
  for (let i = 0; i < 200; i++) {
    state = applySpin(state, { atMs: i * 20, turns: i % 2 === 0 ? 0.05 : -0.05 });
  }
  assert.equal(state.direction, null);
  assert.equal(rpmOf(state), 0);
});

test('돌리기: 시간 밖·시간이 거꾸로 가는 입력은 무시한다', () => {
  const state = applySpin(applySpin(startSpin(), { atMs: 100, turns: 0 }), {
    atMs: 200,
    turns: 0.3,
  });
  assert.equal(applySpin(state, { atMs: 200, turns: 0.3 }), state);
  assert.equal(applySpin(state, { atMs: 150, turns: 0.3 }), state);
  assert.equal(applySpin(state, { atMs: SPIN_MS, turns: 0.3 }), state);
});

test('균형: 회전이 처음부터 쓰러질 만큼 느리면 바로 끝(0점)', () => {
  const state = startBalance(FALL_RPM);
  assert.equal(state.fallen, 'stopped');
  assert.equal(scoreOf(state), 0);
});

test('균형: 아무것도 안 하면 가장 빨리 돌려도 판 밖으로 미끄러져 15초 안에 쓰러진다', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const state = balance(MAX_RPM, handsOff, { seed });
    assert.equal(state.fallen, 'out');
    assert.ok(scoreOf(state) < 150, `씨앗 ${seed}: ${scoreOf(state)}점`);
  }
});

test('균형: 잘 기울이면 회전이 다 줄 때까지 버텨 최고 점수에 가깝다 (0.25초 늦게 반응해도)', () => {
  for (const delaySteps of [0, 15]) {
    const state = balance(MAX_RPM, steady, { delaySteps });
    assert.equal(state.fallen, 'stopped');
    assert.ok(scoreOf(state) >= MAX_SCORE - 5, `${scoreOf(state)}점`);
    assert.ok(scoreOf(state) <= MAX_SCORE);
  }
});

test('균형: 덜 돌릴수록 버틸 수 있는 시간이 줄어든다', () => {
  const scores = [1_800, 1_200, 750].map((rpm) => scoreOf(balance(rpm, steady)));
  assert.ok(scores[0]! > scores[1]! && scores[1]! > scores[2]!, scores.join(', '));
});

test('균형: 판을 끝까지 한쪽으로 기울이면 그쪽으로 미끄러져 나간다', () => {
  const state = balance(MAX_RPM, () => ({ x: 1, y: 0 }));
  assert.equal(state.fallen, 'out');
  assert.ok(state.position.x > 0.9);
});

test('균형: 기울기 크기는 1을 넘어도 1로 줄인다(더 세게 기울여도 더 빨라지지 않는다)', () => {
  const start = startBalance(MAX_RPM);
  const normal = stepBalance(start, { tilt: { x: 1, y: 0 }, drift: 0 });
  const huge = stepBalance(start, { tilt: { x: 50, y: 0 }, drift: 0 });
  assert.deepEqual(huge.velocity, normal.velocity);
});

test('균형: 한 걸음은 1/60초, 쓰러진 뒤에는 바뀌지 않는다', () => {
  const state = stepBalance(startBalance(MAX_RPM), { tilt: { x: 0, y: 0 }, drift: 0 });
  assert.equal(state.elapsedMs, STEP_MS);
  const fallen = { ...state, fallen: 'out' as const };
  assert.equal(stepBalance(fallen, { tilt: { x: 0, y: 0 }, drift: 0 }), fallen);
});

test('기울이기: 폰은 시작 자세 기준, 25도면 가장 크게', () => {
  const baseline = { beta: 30, gamma: 0 };
  assert.deepEqual(tiltFromOrientation({ beta: 30, gamma: 0 }, baseline), { x: 0, y: 0 });
  assert.deepEqual(tiltFromOrientation({ beta: 30, gamma: 12.5 }, baseline), { x: 0.5, y: 0 });
  const far = tiltFromOrientation({ beta: 90, gamma: 0 }, baseline);
  assert.ok(Math.abs(far.y - 1) < 1e-9);
});

test('기울이기: 마우스는 누른 곳 쪽으로, 키보드는 누른 방향으로(대각선도 크기 1)', () => {
  assert.deepEqual(tiltFromPointer({ x: 50, y: 0 }, 100), { x: 0.5, y: 0 });
  const edge = tiltFromPointer({ x: 300, y: 400 }, 100);
  assert.ok(Math.abs(Math.hypot(edge.x, edge.y) - 1) < 1e-9);
  assert.deepEqual(tiltFromKeys(new Set(['ArrowLeft'])), { x: -1, y: 0 });
  const diagonal = tiltFromKeys(new Set(['ArrowRight', 'ArrowDown']));
  assert.ok(Math.abs(Math.hypot(diagonal.x, diagonal.y) - 1) < 1e-9);
  assert.deepEqual(tiltFromKeys(new Set(['ArrowLeft', 'ArrowRight'])), { x: 0, y: 0 });
});
