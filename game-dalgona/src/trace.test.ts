import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBroken, isComplete, precisionOf } from './rules.ts';
import { getShape, type Point, type Shape } from './shapes.ts';
import { nearestOnShape, samplePath, startTrace, traceMove, type TraceState } from './trace.ts';

/** 점들을 차례로 이으며 긁는다 */
function drag(shape: Shape, points: readonly Point[], state = startTrace(shape)): TraceState {
  let trace = state;
  for (let i = 1; i < points.length; i++) {
    trace = traceMove(trace, shape, { from: points[i - 1]!, to: points[i]! });
  }
  return trace;
}

const circle = getShape(0);

test('선을 정확히 따라 한 바퀴 돌면 금 없이 완성된다', () => {
  const trace = drag(circle, circle.checkpoints);
  assert.equal(trace.cracks, 0);
  assert.ok(isComplete(trace));
  assert.ok(precisionOf(trace) > 0.95);
});

test('반 바퀴만 돌면 완성이 아니다', () => {
  const half = circle.checkpoints.slice(0, circle.checkpoints.length / 2);
  assert.equal(isComplete(drag(circle, half)), false);
});

test('선에서 크게 벗어나면 금이 한 번 간다 (벗어나 있는 동안 더 늘지 않는다)', () => {
  const start = { x: 74, y: 50 }; // 원 위의 점
  const trace = drag(circle, [start, { x: 90, y: 50 }, { x: 92, y: 55 }, { x: 90, y: 60 }]);
  assert.equal(trace.cracks, 1);
  assert.equal(trace.isOffPath, true);
});

test('선으로 돌아왔다가 다시 벗어나면 금이 또 간다', () => {
  const trace = drag(circle, [
    { x: 74, y: 50 },
    { x: 90, y: 50 },
    { x: 74, y: 50 },
    { x: 90, y: 50 },
  ]);
  assert.equal(trace.cracks, 2);
});

test('안쪽을 가로질러 반대편으로 건너뛰면 금이 간다', () => {
  // 한 번의 이동으로 지름을 가로질러도 중간 경로를 검사한다
  const trace = drag(circle, [
    { x: 74, y: 50 },
    { x: 26, y: 50 },
  ]);
  assert.equal(trace.cracks, 1);
});

test('금이 세 번 가면 깨진다', () => {
  const zigzag = [
    { x: 74, y: 50 },
    ...Array.from({ length: 3 }, () => [
      { x: 90, y: 50 },
      { x: 74, y: 50 },
    ]).flat(),
  ];
  assert.ok(isBroken(drag(circle, zigzag)));
});

test('이동 경로를 1단위 간격으로 쪼갠다 (시작점 제외, 끝점 포함)', () => {
  const points = samplePath({ x: 0, y: 0 }, { x: 3, y: 4 });
  assert.equal(points.length, 5);
  assert.deepEqual(points.at(-1), { x: 3, y: 4 });
});

test('윤곽선 위에서 가장 가까운 지점으로 투영한다 (긁은 자국이 선 위에 그려지게)', () => {
  const nearest = nearestOnShape(circle, { x: 77, y: 50 }); // 원(반지름 24) 바깥 3단위
  assert.ok(Math.abs(nearest.distance - 3) < 0.1);
  assert.ok(Math.abs(nearest.point.x - 74) < 0.1);
});

test('끝까지 긁기 전에는 완성되지 않는다 (마지막 5% 남김)', () => {
  const count = circle.checkpoints.length;
  const almost = circle.checkpoints.slice(0, Math.floor(count * 0.95));
  assert.equal(isComplete(drag(circle, almost)), false);
});

test('바늘 앞쪽의 아직 지나가지 않은 체크포인트는 긁은 것으로 치지 않는다', () => {
  const trace = drag(circle, circle.checkpoints.slice(0, 10));
  assert.ok(trace.visitedCount <= 11, `긁힌 체크포인트 ${trace.visitedCount}개`);
});

test('선에서 조금(1단위) 안쪽으로 비켜 긁어도 모서리까지 따라가면 완성된다', () => {
  const square = getShape(2);
  const inset = square.checkpoints.map(({ x, y }) => ({
    x: x + Math.sign(50 - x),
    y: y + Math.sign(50 - y),
  }));
  assert.ok(isComplete(drag(square, inset)));
});
