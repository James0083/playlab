import { closestPointOnSegment, distance, lerp, type Point, type Shape } from './shapes.ts';

// 거리는 보드 단위다. 보드(100단위)가 폰 화면에서 약 320px이라 1단위 ≈ 3.2px.

/** 선에서 이만큼 벗어나면 금이 간다(약 16px). 손가락 굵기를 감안한 값 */
export const CRACK_DISTANCE = 5;
/** 선에 이만큼 다시 가까워져야 "돌아왔다"고 본다. 한 번 벗어난 것으로 금이 여러 번 가지 않게 한다 */
const RETURN_DISTANCE = 3;
/** 바늘이 체크포인트에서 이 거리 안을 지나면 긁은 것으로 본다 */
export const VISIT_RADIUS = 3.5;
/** 이동 경로를 이 간격으로 쪼개 검사한다. 빠르게 그어 체크포인트나 이탈을 건너뛰지 못하게 한다 */
const SAMPLE_STEP = 1;

export interface TraceState {
  /** 체크포인트별로 긁었는지 */
  visited: boolean[];
  visitedCount: number;
  cracks: number;
  /** 금이 간 위치. 화면에 금을 그릴 때 쓴다 */
  crackPoints: Point[];
  /** 지금 선에서 벗어나 있는지 */
  isOffPath: boolean;
  /** 정확도 계산용: 검사한 지점들의 선과의 거리 합(CRACK_DISTANCE에서 자름)과 개수 */
  deviationTotal: number;
  sampleCount: number;
}

export function startTrace(shape: Shape): TraceState {
  return {
    visited: shape.checkpoints.map(() => false),
    visitedCount: 0,
    cracks: 0,
    crackPoints: [],
    isOffPath: false,
    deviationTotal: 0,
    sampleCount: 0,
  };
}

/** 윤곽선 위에서 point와 가장 가까운 지점과 그 거리 */
export function nearestOnShape(shape: Shape, point: Point): { point: Point; distance: number } {
  let nearest = { point, distance: Infinity };
  for (const segment of shape.segments) {
    const candidate = closestPointOnSegment(point, segment);
    const offset = distance(point, candidate);
    if (offset < nearest.distance) nearest = { point: candidate, distance: offset };
  }
  return nearest;
}

export function distanceToShape(shape: Shape, point: Point): number {
  return nearestOnShape(shape, point).distance;
}

/** from에서 to까지를 SAMPLE_STEP 간격으로 쪼갠 지점들(from 제외, to 포함) */
export function samplePath(from: Point, to: Point): Point[] {
  const steps = Math.max(Math.ceil(distance(from, to) / SAMPLE_STEP), 1);
  return Array.from({ length: steps }, (_, i) => lerp(from, to, (i + 1) / steps));
}

/** 바늘이 from에서 to로 움직였을 때의 결과. 원래 state는 바꾸지 않는다 */
export function traceMove(
  state: TraceState,
  shape: Shape,
  { from, to }: { from: Point; to: Point },
): TraceState {
  const next: TraceState = {
    ...state,
    visited: [...state.visited],
    crackPoints: [...state.crackPoints],
  };
  for (const point of samplePath(from, to)) applySample(next, shape, point);
  return next;
}

/** 지점 하나를 검사해 trace를 직접 고친다(traceMove가 만든 복사본에만 쓴다) */
function applySample(trace: TraceState, shape: Shape, point: Point): void {
  const offset = distanceToShape(shape, point);
  trace.deviationTotal += Math.min(offset, CRACK_DISTANCE);
  trace.sampleCount += 1;

  if (offset > CRACK_DISTANCE && !trace.isOffPath) {
    trace.isOffPath = true;
    trace.cracks += 1;
    trace.crackPoints.push(point);
  } else if (offset <= RETURN_DISTANCE) {
    trace.isOffPath = false;
  }

  if (offset <= VISIT_RADIUS) markVisited(trace, shape, point);
}

function markVisited(trace: TraceState, shape: Shape, point: Point): void {
  shape.checkpoints.forEach((checkpoint, i) => {
    if (!trace.visited[i] && distance(checkpoint, point) <= VISIT_RADIUS) {
      trace.visited[i] = true;
      trace.visitedCount += 1;
    }
  });
}
