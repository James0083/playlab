import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keyTurns, motionTurns, pointerTurns, startMotionTracker } from './rotation.ts';

test('마우스·터치: 원의 가운데를 기준으로 시계 방향이 양수', () => {
  // 한 번에 1/4바퀴보다 크게 바뀌면(손가락을 떼었다 다른 곳에 댐) 세지 않는다
  assert.equal(pointerTurns({ x: 100, y: 0 }, { x: -10, y: 100 }, 10), 0);
  const quarterOfQuarter = pointerTurns({ x: 100, y: 0 }, { x: 92.39, y: 38.27 }, 10);
  assert.ok(Math.abs(quarterOfQuarter - 1 / 16) < 1e-3);
  assert.ok(pointerTurns({ x: 92.39, y: 38.27 }, { x: 100, y: 0 }, 10) < 0);
  // 가운데에 너무 가까우면 세지 않는다
  assert.equal(pointerTurns({ x: 5, y: 0 }, { x: 0, y: 5 }, 10), 0);
  // 한 바퀴 경계(−π/π)를 지나도 튀지 않는다
  const acrossBoundary = pointerTurns({ x: -100, y: 1 }, { x: -100, y: -1 }, 10);
  assert.ok(Math.abs(acrossBoundary) < 0.01);
});

test('키보드: ↑→↓← 순서는 시계, 반대는 반시계, 같은 키·맞은편 키는 0', () => {
  assert.equal(keyTurns('ArrowUp', 'ArrowRight'), 0.25);
  assert.equal(keyTurns('ArrowLeft', 'ArrowUp'), 0.25);
  assert.equal(keyTurns('ArrowUp', 'ArrowLeft'), -0.25);
  assert.equal(keyTurns('ArrowUp', 'ArrowUp'), 0);
  assert.equal(keyTurns('ArrowUp', 'ArrowDown'), 0);
  assert.equal(keyTurns(null, 'ArrowUp'), 0);
});

/** 폰으로 원을 그리는 동작: 가속도는 원의 가운데를 향한 채 돈다 */
function circleReadings({
  hz,
  turnsPerSecond,
  seconds,
  clockwise,
}: {
  hz: number;
  turnsPerSecond: number;
  seconds: number;
  clockwise: boolean;
}) {
  const sign = clockwise ? -1 : 1; // 기기 좌표(위가 +y)에서 시계 방향은 각도가 준다
  return Array.from({ length: Math.round(hz * seconds) + 1 }, (_, i) => {
    const atMs = (i * 1_000) / hz;
    const angle = sign * 2 * Math.PI * turnsPerSecond * (atMs / 1_000);
    return {
      atMs,
      linearAcceleration: { x: 5 * Math.cos(angle), y: 5 * Math.sin(angle), z: 0.3 },
      spinRate: null,
    };
  });
}

function sumMotionTurns(readings: ReturnType<typeof circleReadings>): number {
  let tracker = startMotionTracker();
  let total = 0;
  for (const reading of readings) {
    const measured = motionTurns(tracker, reading);
    tracker = measured.tracker;
    total += measured.turns;
  }
  return total;
}

test('폰 원 그리기: 센서 빈도와 관계없이 돈 바퀴 수를 재고, 방향 부호가 맞다', () => {
  for (const hz of [30, 60, 200]) {
    const clockwise = sumMotionTurns(
      circleReadings({ hz, turnsPerSecond: 2, seconds: 2, clockwise: true }),
    );
    assert.ok(Math.abs(clockwise - 4) < 1e-6, `${hz}Hz: ${clockwise}`);
  }
  const counter = sumMotionTurns(
    circleReadings({ hz: 60, turnsPerSecond: 1, seconds: 1, clockwise: false }),
  );
  assert.ok(Math.abs(counter + 1) < 1e-6);
});

test('폰을 앞뒤로 흔들기(원이 아님)는 돈 것으로 치지 않는다', () => {
  const readings = Array.from({ length: 121 }, (_, i) => {
    const atMs = (i * 1_000) / 60;
    const swing = 12 * Math.sin(2 * Math.PI * 3 * (atMs / 1_000));
    return { atMs, linearAcceleration: { x: swing, y: swing * 0.2, z: 0 }, spinRate: null };
  });
  assert.ok(Math.abs(sumMotionTurns(readings)) < 0.05);
});

test('폰 손목 돌리기(자이로): 반시계가 양수인 회전 속도를 시계 방향 양수로 바꾼다', () => {
  let tracker = startMotionTracker();
  tracker = motionTurns(tracker, { atMs: 0, linearAcceleration: null, spinRate: -360 }).tracker;
  const { turns } = motionTurns(tracker, { atMs: 100, linearAcceleration: null, spinRate: -360 });
  assert.ok(Math.abs(turns - 0.1) < 1e-9);
  // 손떨림 수준의 느린 회전은 무시한다
  const slow = motionTurns(tracker, { atMs: 100, linearAcceleration: null, spinRate: 10 });
  assert.equal(slow.turns, 0);
});
