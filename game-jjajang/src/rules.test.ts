import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  applyTurn,
  clumpEfficiency,
  DURATION_MS,
  finalResult,
  MAX_BONUS_SWITCHES,
  MAX_SCORE,
  MAX_TURNS_PER_SECOND,
  MIN_STROKE_TURNS,
  MIX_TARGET_TURNS,
  startStir,
  strokeZone,
  type StirState,
} from './rules.ts';

/**
 * 일정한 속도로 돌리는 손동작을 흉내 낸다.
 * @param turnsPerSecond 초당 바퀴 수
 * @param strokeTurns 한 방향으로 이만큼 돌리고 반대로 바꾼다. Infinity면 한 방향만
 * @param hz 입력 빈도
 */
function stir({
  turnsPerSecond,
  strokeTurns = Infinity,
  hz = 60,
  untilMs = DURATION_MS,
}: {
  turnsPerSecond: number;
  strokeTurns?: number;
  hz?: number;
  untilMs?: number;
}): StirState {
  let state = startStir();
  const stepMs = 1_000 / hz;
  const step = turnsPerSecond / hz;
  let direction = 1;
  let inStroke = 0;
  for (let atMs = 0; atMs < untilMs; atMs += stepMs) {
    state = applyTurn(state, { atMs, turns: direction * step });
    inStroke += step;
    if (inStroke >= strokeTurns - 1e-9) {
      direction = -direction;
      inStroke = 0;
    }
  }
  return state;
}

test('최고 점수는 150점이다', () => {
  assert.equal(MAX_SCORE, 150);
});

test('뭉침: 2바퀴까지는 다 비벼지고, 4바퀴부터는 1/4만 비벼진다', () => {
  assert.equal(clumpEfficiency(2), 1);
  assert.equal(clumpEfficiency(3), 0.625);
  assert.equal(clumpEfficiency(4), 0.25);
  assert.equal(clumpEfficiency(10), 0.25);
});

test('한 방향으로 4바퀴: 비빔 3.25바퀴, 헛돈 0.75바퀴(입력을 쪼갠 크기와 관계없음)', () => {
  for (const pieces of [8, 40, 400]) {
    let state = startStir();
    state = applyTurn(state, { atMs: 0, turns: 0 });
    for (let i = 1; i <= pieces; i++) {
      // 2초에 4바퀴: 속도 상한(초당 2.5바퀴)과 입력 간격 상한(0.25초)에 걸리지 않는다
      state = applyTurn(state, { atMs: i * (2_000 / pieces), turns: 4 / pieces });
    }
    // 2바퀴는 그대로 + 2~4바퀴는 효율이 1 → 0.25로 줄어 평균 0.625 × 2바퀴
    assert.ok(Math.abs(state.mix - 3.25) < 1e-9, `${pieces}조각: ${state.mix}`);
    assert.ok(Math.abs(state.clumpedTurns - 0.75) < 1e-9);
  }
});

test('1.5바퀴마다 방향을 바꾸며 초당 2바퀴: 다 비비고 방향 바꾸기 보너스를 다 받는다', () => {
  const result = finalResult(stir({ turnsPerSecond: 2, strokeTurns: 1.5 }));
  assert.equal(result.mixPercent, 100);
  assert.ok(result.switches >= MAX_BONUS_SWITCHES);
  assert.equal(result.clumpedTurns, 0);
  // 15바퀴 ÷ 초당 2바퀴 = 약 7.5초에 다 비빈다(방향을 바꿀 때 0.1바퀴씩 늦게 인정) → 남은 시간 보너스
  const { mixedAtMs } = result;
  assert.ok(mixedAtMs !== null && mixedAtMs >= 7_500 && mixedAtMs < 7_700, `${mixedAtMs}`);
  assert.equal(result.score, 100 + 30 + Math.floor((DURATION_MS - mixedAtMs) / 200));
});

test('한 방향으로만 돌리면 같은 속도라도 덜 비벼진다', () => {
  const oneWay = finalResult(stir({ turnsPerSecond: 2 }));
  const switching = finalResult(stir({ turnsPerSecond: 2, strokeTurns: 1.5 }));
  assert.equal(oneWay.switches, 0);
  // 20바퀴를 돌려도 비빔은 7.25바퀴(48%)
  assert.ok(oneWay.mixPercent < 50, `한 방향 ${oneWay.mixPercent}%`);
  assert.ok(oneWay.score < switching.score - 80);
});

test('제자리에서 앞뒤로 흔들기는 비빈 것으로 치지 않는다', () => {
  // 방향을 바꾼 것으로 보지 않을 만큼 작게(0.05바퀴), 바꾼 것으로 보지만 짧게(0.2바퀴)
  for (const strokeTurns of [0.05, 0.2]) {
    const state = stir({ turnsPerSecond: MAX_TURNS_PER_SECOND, strokeTurns });
    assert.ok(strokeTurns < MIN_STROKE_TURNS);
    assert.equal(state.mix, 0, `${strokeTurns}바퀴 흔들기`);
    assert.equal(state.switches, 0);
  }
});

test('방향 바꾸기는 직전 방향으로 1바퀴 이상 돌렸을 때만 센다', () => {
  assert.equal(stir({ turnsPerSecond: 2, strokeTurns: 0.75 }).switches, 0);
  assert.ok(stir({ turnsPerSecond: 2, strokeTurns: 1.1 }).switches > 0);
});

test('원 그리는 동안 살짝 거꾸로 떨려도 방향이 바뀌지 않고, 떨린 만큼 바퀴가 늘지 않는다', () => {
  let state = startStir();
  state = applyTurn(state, { atMs: 0, turns: 0 });
  let atMs = 0;
  // 앞으로 0.1, 뒤로 0.05를 반복한다(순수하게 앞으로 간 양은 0.05씩)
  for (let i = 0; i < 20; i++) {
    state = applyTurn(state, { atMs: (atMs += 100), turns: 0.1 });
    state = applyTurn(state, { atMs: (atMs += 100), turns: -0.05 });
  }
  assert.equal(state.strokes.length, 0);
  assert.ok(Math.abs((state.stroke?.turns ?? 0) - 1.05) < 1e-9, `${state.stroke?.turns}`);
});

test('아무리 빨리 돌려도 초당 2.5바퀴까지만 인정한다', () => {
  const state = stir({ turnsPerSecond: 20 });
  const counted = state.mix + state.clumpedTurns;
  assert.ok(counted <= (MAX_TURNS_PER_SECOND * DURATION_MS) / 1_000 + 1e-9, `${counted}`);
  // 1바퀴씩 바꾸며 아주 빠르게(입력 하나에 1바퀴): 속도 상한에 깎여도 점수는 최고 점수를 넘지 않는다
  let fast = startStir();
  for (let atMs = 0; atMs < DURATION_MS; atMs += 16) {
    fast = applyTurn(fast, { atMs, turns: Math.floor(atMs / 400) % 2 === 0 ? 1 : -1 });
  }
  assert.ok(fast.mixedAtMs !== null && fast.mixedAtMs >= 6_000);
  assert.ok(finalResult(fast).score <= MAX_SCORE);
});

test('인정 속도 상한으로 2바퀴마다 바꾸면 최고 점수에 닿고(첫 입력 지연 1점 이내) 넘지 않는다', () => {
  const result = finalResult(stir({ turnsPerSecond: MAX_TURNS_PER_SECOND, strokeTurns: 2 }));
  assert.ok(result.score >= MAX_SCORE - 1 && result.score <= MAX_SCORE, `${result.score}`);
});

test('입력 빈도(30·60·200Hz)가 달라도 같은 손동작이면 같은 점수', () => {
  const scores = [30, 60, 200].map(
    (hz) => finalResult(stir({ turnsPerSecond: 1.8, strokeTurns: 1.5, hz })).score,
  );
  assert.ok(Math.max(...scores) - Math.min(...scores) <= 1, scores.join(', '));
});

test('입력이 끊겼다 이어지면 그 사이는 0.25초만큼만 인정한다', () => {
  let state = startStir();
  state = applyTurn(state, { atMs: 0, turns: 0 });
  state = applyTurn(state, { atMs: 5_000, turns: 10 });
  assert.ok(Math.abs((state.stroke?.turns ?? 0) - MAX_TURNS_PER_SECOND * 0.25) < 1e-9);
});

test('시간이 거꾸로 가거나 같은 시각을 반복한 입력, 플레이 시간 밖 입력은 무시한다', () => {
  let state = startStir();
  state = applyTurn(state, { atMs: 1_000, turns: 0 });
  state = applyTurn(state, { atMs: 1_100, turns: 0.2 });
  const before = state;
  assert.equal(applyTurn(state, { atMs: 1_100, turns: 0.2 }), before);
  assert.equal(applyTurn(state, { atMs: 900, turns: 0.2 }), before);
  assert.equal(applyTurn(state, { atMs: DURATION_MS, turns: 0.2 }), before);
  assert.equal(applyTurn(state, { atMs: -1, turns: 0.2 }), before);
});

test('하나도 안 돌리면 0점', () => {
  assert.equal(finalResult(startStir()).score, 0);
  assert.equal(finalResult(stir({ turnsPerSecond: 0 })).score, 0);
});

test('구간 상태: 1바퀴 전은 짧음, 1~2바퀴는 바꾸기 좋음, 2바퀴 넘으면 뭉침', () => {
  assert.equal(strokeZone(0.99), 'short');
  assert.equal(strokeZone(1), 'good');
  assert.equal(strokeZone(2), 'good');
  assert.equal(strokeZone(2.01), 'clump');
});

test('결과에 마지막 구간까지 돌린 기록이 남는다', () => {
  const result = finalResult(stir({ turnsPerSecond: 2, strokeTurns: 1.5, untilMs: 2_000 }));
  // 2초에 4바퀴 = 1.5 + 1.5 + 1(진행 중)
  assert.deepEqual(
    result.strokes.map(({ direction }) => direction),
    [1, -1, 1],
  );
  assert.ok(MIX_TARGET_TURNS > 4 && result.mixedAtMs === null);
});
