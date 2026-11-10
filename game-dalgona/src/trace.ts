import { closestPointOnSegment, distance, lerp, type Point, type Shape } from './shapes.ts';

// 따라 그리기 판정. 거리는 보드 단위다. 보드(100단위)가 폰 화면에서 약 320px이라 1단위 ≈ 3.2px.
// 2026-11-10 방식 변경: 선 근처를 지나면 선 위로 옮겨 긁어 주던 자동 보정을 없앴다.
// 손이 실제로 지나간 자리로만 판정하고, 점선(체크포인트)을 얼마나 정확히 따라 그렸는지로 점수를 낸다.

/** 선에서 이만큼 벗어나면 금이 간다(약 13px) */
export const CRACK_DISTANCE = 4;
/** 선에 이만큼 다시 가까워져야 "돌아왔다"고 본다. 한 번 벗어난 것으로 금이 여러 번 가지 않게 한다 */
const RETURN_DISTANCE = 2.5;
/**
 * 점선의 점(체크포인트)에서 이 거리 안(약 10px)을 지나가야 그 점을 그린 것으로 본다.
 * 넓으면 우산 물결처럼 굽은 곳을 직선으로 지나가도 그린 것이 된다(물결 깊이 9).
 */
export const COVER_RADIUS = 3;
/** 이동 경로를 이 간격으로 쪼개 검사한다. 빠르게 그어 점이나 이탈을 건너뛰지 못하게 한다 */
const SAMPLE_STEP = 1;

export interface TraceState {
  /** 체크포인트(점선의 점)별로 그렸는지 */
  visited: boolean[];
  visitedCount: number;
  cracks: number;
  /** 금이 간 위치. 화면에 금을 그릴 때 쓴다 */
  crackPoints: Point[];
  /** 지금 선에서 벗어나 있는지 */
  isOffPath: boolean;
  /**
   * 정확도 계산용: 점을 처음 그렸을 때 손이 선에서 떨어져 있던 거리의 합과 그 점의 수.
   * 이미 그린 곳을 다시 그려도 바뀌지 않아, 덧그려서 정확도를 고칠 수 없다.
   */
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

/** point에서 윤곽선까지 가장 가까운 거리 */
export function distanceToShape(shape: Shape, point: Point): number {
  let nearest = Infinity;
  for (const segment of shape.segments) {
    nearest = Math.min(nearest, distance(point, closestPointOnSegment(point, segment)));
  }
  return nearest;
}

/** from에서 to까지를 SAMPLE_STEP 간격으로 쪼갠 지점들(from 제외, to 포함) */
export function samplePath(from: Point, to: Point): Point[] {
  const steps = Math.max(Math.ceil(distance(from, to) / SAMPLE_STEP), 1);
  return Array.from({ length: steps }, (_, i) => lerp(from, to, (i + 1) / steps));
}

/**
 * 손이 from에서 to로 움직였을 때의 결과. 원래 state는 바꾸지 않는다.
 * 처음 댄 자리는 from과 to를 같은 점으로 넘긴다.
 */
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

  if (offset > CRACK_DISTANCE && !trace.isOffPath) {
    trace.isOffPath = true;
    trace.cracks += 1;
    trace.crackPoints.push(point);
  } else if (offset <= RETURN_DISTANCE) {
    trace.isOffPath = false;
  }

  // 손이 지나간 자리 가까이의 점만 그린 것으로 친다. 처음 그린 순간의 이탈 거리를 정확도에 더한다
  shape.checkpoints.forEach((checkpoint, i) => {
    if (trace.visited[i] || distance(point, checkpoint) > COVER_RADIUS) return;
    trace.visited[i] = true;
    trace.visitedCount += 1;
    trace.deviationTotal += offset;
    trace.sampleCount += 1;
  });
}
