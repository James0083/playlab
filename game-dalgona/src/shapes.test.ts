import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  CHECKPOINT_SPACING,
  distance,
  distanceToSegment,
  isClosedStroke,
  resample,
  SHAPES,
} from './shapes.ts';

test('선을 일정한 간격으로 다시 샘플링한다', () => {
  const points = resample(
    [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 5 },
    ],
    2,
  );
  // 전체 길이 8 → 0, 2, 4, 6, 8 지점
  assert.equal(points.length, 5);
  for (let i = 1; i < points.length; i++) {
    assert.ok(Math.abs(distance(points[i - 1] ?? points[0]!, points[i]!) - 2) < 1.01);
  }
});

test('점과 선분 사이 거리', () => {
  const segment = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
  ] as const;
  assert.equal(distanceToSegment({ x: 5, y: 3 }, segment), 3);
  assert.equal(distanceToSegment({ x: -4, y: 3 }, segment), 5); // 끝점 바깥은 끝점까지
});

test('모든 모양은 달고나 판(반지름 46) 안에 있고 체크포인트가 촘촘하다', () => {
  for (const shape of SHAPES) {
    for (const point of shape.checkpoints) {
      assert.ok(distance(point, { x: 50, y: 50 }) < 46, `${shape.name}이 판 밖으로 나감`);
    }
    for (const [a, b] of shape.segments) {
      assert.ok(distance(a, b) <= CHECKPOINT_SPACING + 0.01, `${shape.name} 체크포인트 간격`);
    }
  }
});

test('어려운 모양일수록 기준 점수가 높거나 같다', () => {
  const scores = SHAPES.map((shape) => shape.baseScore);
  assert.deepEqual(
    scores,
    [...scores].sort((a, b) => a - b),
  );
});

test('여러 선으로 된 모양(우산)도 선과 선 사이는 잇지 않는다', () => {
  for (const shape of SHAPES) {
    shape.segments.forEach((segment, i) => {
      const next = shape.segments[i + 1];
      const sameStroke =
        shape.segmentPositions[i]?.stroke === shape.segmentPositions[i + 1]?.stroke;
      if (next && sameStroke) assert.deepEqual(segment[1], next[0], `${shape.name} 선분이 끊김`);
    });
    assert.equal(new Set(shape.segmentPositions.map((p) => p.stroke)).size, shape.strokes.length);
  }
});

test('닫힌 선은 마지막 체크포인트에서 시작점까지 선분이 이어진다', () => {
  for (const shape of SHAPES) {
    shape.strokes.forEach((stroke, index) => {
      if (!isClosedStroke(stroke)) return;
      const segments = shape.segments.filter((_, i) => shape.segmentPositions[i]?.stroke === index);
      assert.ok(distance(segments.at(-1)![1], stroke[0]!) < 0.11, `${shape.name}이 닫히지 않음`);
    });
  }
});

test('토끼 귀는 머리에 깊이 묻혀, 귀와 머리가 만나는 곳이 머리 윗선보다 아래에 있다', () => {
  const rabbit = SHAPES.find((shape) => shape.id === 'rabbit')!;
  const outline = rabbit.strokes[0]!;
  // 귀 사이(가운데)의 가장 낮은 점이 귀 끝보다 충분히 아래
  const top = Math.min(...outline.map((p) => p.y));
  const notch = Math.max(
    ...outline
      .filter((p) => Math.abs(p.x - 50) < 2)
      .filter((p) => p.y < 60)
      .map((p) => p.y),
  );
  assert.ok(notch - top > 20, `귀 길이 ${notch - top}`);
});

test('닫힌 도형 판별: 원·토끼·우산 갓은 닫혀 있고 우산 손잡이는 열려 있다 (뽑은 모양을 채워 그릴 때 사용)', () => {
  const byId = Object.fromEntries(SHAPES.map((shape) => [shape.id, shape]));
  assert.ok(isClosedStroke(byId.circle!.strokes[0]!));
  assert.ok(isClosedStroke(byId.rabbit!.strokes[0]!));
  assert.ok(isClosedStroke(byId.umbrella!.strokes[0]!));
  assert.equal(isClosedStroke(byId.umbrella!.strokes[1]!), false);
});
