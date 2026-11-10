import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isBroken, isComplete, precisionOf } from './rules.ts';
import { getShape, type Point, type Shape } from './shapes.ts';
import { distanceToShape, samplePath, startTrace, traceMove, type TraceState } from './trace.ts';

/** 한 번 대고(첫 점) 점들을 차례로 이으며 그린다 */
function drag(shape: Shape, points: readonly Point[], state = startTrace(shape)): TraceState {
  const first = points[0];
  if (!first) return state;
  let trace = traceMove(state, shape, { from: first, to: first });
  for (let i = 1; i < points.length; i++) {
    trace = traceMove(trace, shape, { from: points[i - 1]!, to: points[i]! });
  }
  return trace;
}

/** 각 체크포인트를 선의 수직 방향으로 offset만큼 옮긴 경로(선과 나란히 비켜 그리기) */
function offsetPath(shape: Shape, offset: number): Point[] {
  const points = shape.checkpoints;
  return points.map((point, i) => {
    const prev = points[i - 1] ?? points.at(-1)!;
    const next = points[i + 1] ?? points[0]!;
    const length = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
    return {
      x: point.x - ((next.y - prev.y) / length) * offset,
      y: point.y + ((next.x - prev.x) / length) * offset,
    };
  });
}

/** 닫힌 경로를 한 바퀴 다 돌도록 처음 점으로 돌아온다 */
const loop = (points: Point[]) => [...points, points[0]!];

const circle = getShape(0);

test('점선을 정확히 따라 한 바퀴 그리면 금 없이 완성되고 정확도가 100%에 가깝다', () => {
  const trace = drag(circle, loop([...circle.checkpoints]));
  assert.equal(trace.cracks, 0);
  assert.ok(isComplete(trace));
  assert.ok(precisionOf(trace) > 0.95);
});

test('자동 보정 없음: 선과 나란히 비켜 그릴수록 정확도가 떨어진다', () => {
  const precisions = [0.5, 1.5, 2.5].map((offset) => {
    const trace = drag(circle, loop(offsetPath(circle, offset)));
    assert.ok(isComplete(trace), `${offset}단위 비켜 그려도 점 3단위 안이라 완성`);
    return precisionOf(trace);
  });
  // 정확도 = 1 − 평균 이탈 거리 / 3
  [0.83, 0.5, 0.17].forEach((expected, i) => {
    assert.ok(Math.abs(precisions[i]! - expected) < 0.03, `${precisions[i]} ≠ ${expected}`);
  });
});

test('점에서 3단위 넘게 떨어져 그리면 그린 것으로 치지 않는다(완성 안 됨)', () => {
  const trace = drag(circle, loop(offsetPath(circle, 3.5)));
  assert.equal(trace.visitedCount, 0);
  assert.equal(isComplete(trace), false);
});

test('반 바퀴만 그리면 완성이 아니다', () => {
  const half = circle.checkpoints.slice(0, circle.checkpoints.length / 2);
  assert.equal(isComplete(drag(circle, half)), false);
});

test('끝까지 그리기 전에는 완성되지 않는다 (마지막 5% 남김)', () => {
  const count = circle.checkpoints.length;
  const almost = circle.checkpoints.slice(0, Math.floor(count * 0.95));
  assert.equal(isComplete(drag(circle, almost)), false);
});

test('손이 아직 가지 않은 앞쪽 점은 그린 것으로 치지 않는다 (3단위 앞까지만)', () => {
  // 0~9번 점까지 그림: 2단위 앞(10번)은 그린 것으로 치고, 4단위 앞(11번)부터는 남는다
  const trace = drag(circle, circle.checkpoints.slice(0, 10));
  assert.equal(trace.visited[10], true);
  assert.equal(trace.visited[11], false);
  assert.equal(trace.visited[20], false);
});

test('손을 떼고 몇 점 건너뛰어 다시 그리면 그 사이 점은 남는다 (이어 주지 않음)', () => {
  const first = drag(circle, circle.checkpoints.slice(0, 6));
  const resumed = drag(circle, circle.checkpoints.slice(9, 14), first);
  assert.equal(resumed.visited[7], false);
});

test('이미 그린 곳을 정확히 덧그려도 정확도가 오르지 않는다', () => {
  const sloppy = drag(circle, loop(offsetPath(circle, 2)));
  const redrawn = drag(circle, loop([...circle.checkpoints]), sloppy);
  assert.equal(precisionOf(redrawn), precisionOf(sloppy));
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

test('선에서 먼 곳에 처음 손을 대도 금이 간다', () => {
  const trace = drag(circle, [{ x: 50, y: 50 }]);
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

test('윤곽선까지의 거리', () => {
  assert.ok(Math.abs(distanceToShape(circle, { x: 77, y: 50 }) - 3) < 0.1); // 반지름 24 바깥 3단위
});

test('네모를 1단위 안쪽으로 따라 그려도 모서리까지 완성된다', () => {
  const square = getShape(2);
  const inset = square.checkpoints.map(({ x, y }) => ({
    x: x + Math.sign(50 - x),
    y: y + Math.sign(50 - y),
  }));
  assert.ok(isComplete(drag(square, loop(inset))));
});

test('토끼를 선 안쪽·바깥쪽으로 2단위 비켜 한 바퀴 그려도 오목한 귀 밑까지 완성된다', () => {
  const rabbit = getShape(4);
  for (const offset of [2, -2]) {
    const trace = drag(rabbit, loop(offsetPath(rabbit, offset)));
    assert.equal(trace.visitedCount, rabbit.checkpoints.length, `비켜 그린 거리 ${offset}`);
  }
});

test('우산 물결을 직선으로 지나가면 완성되지 않는다', () => {
  const umbrella = getShape(5);
  const [canopy, handle] = umbrella.strokes;
  // 위쪽 반원만(중심 (50,52) 반지름 26인 점). 물결 점은 빼고 아래 직선으로 대신 지나간다
  const top = canopy!.filter(
    (point) => Math.abs(Math.hypot(point.x - 50, point.y - 52) - 26) < 0.01,
  );
  const straight = [
    { x: 76, y: 50 },
    { x: 24, y: 50 },
  ];
  let trace = drag(umbrella, [...top, ...straight]);
  trace = drag(umbrella, [...handle!], trace);
  assert.equal(isComplete(trace), false);
});
