import {
  closestPointOnSegment,
  distance,
  lerp,
  type PathPosition,
  type Point,
  type Shape,
} from './shapes.ts';

// 거리는 보드 단위다. 보드(100단위)가 폰 화면에서 약 320px이라 1단위 ≈ 3.2px.

/** 선에서 이만큼 벗어나면 금이 간다(약 13px) */
export const CRACK_DISTANCE = 4;
/** 선에 이만큼 다시 가까워져야 "돌아왔다"고 본다. 한 번 벗어난 것으로 금이 여러 번 가지 않게 한다 */
const RETURN_DISTANCE = 2.5;
/**
 * 바늘이 선에서 이 거리 안(약 8px)에 있어야 선을 긁는 것으로 본다.
 * 넓으면 우산 물결처럼 굽은 곳을 직선으로 지나가도 긁힌 것이 된다.
 */
export const VISIT_RADIUS = 2.5;
/**
 * 바늘을 선 위로 옮긴 지점이 직전 지점에서 선을 따라 이 거리 안이면 그 사이를 이어서 긁은 것으로 본다.
 * 오목한 모서리(토끼 귀와 머리 사이)를 비켜 긁으면 선 위로 옮긴 지점이 모서리를 건너뛰는데,
 * 그 사이 체크포인트가 남아 99%에서 멈추던 문제를 막는다. 물결 하나(약 30)를 건너뛸 만큼 크지는 않다.
 */
export const FOLLOW_LIMIT = 6;
/** 긁은 구간 양 끝에서 이 거리 안의 체크포인트까지 인정한다(바늘 앞쪽은 거의 인정하지 않는다) */
const SCRAPE_TOLERANCE = 0.5;
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
  /**
   * 정확도 계산용: 체크포인트를 처음 긁었을 때 바늘이 선에서 떨어져 있던 거리의 합과 그 체크포인트 수.
   * 이미 긁은 곳을 다시 문질러도 바뀌지 않아, 문질러서 정확도를 부풀릴 수 없다.
   */
  deviationTotal: number;
  sampleCount: number;
  /** 직전에 선 위로 옮긴 바늘 위치. 선에서 멀어지거나 손을 떼면 null */
  lastScrape: PathPosition | null;
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
    lastScrape: null,
  };
}

export interface NearestPoint {
  point: Point;
  distance: number;
  /** point의 선 위 위치 */
  position: PathPosition;
}

/** 윤곽선 위에서 point와 가장 가까운 지점과 그 거리 */
export function nearestOnShape(shape: Shape, point: Point): NearestPoint {
  let nearest: NearestPoint = { point, distance: Infinity, position: { stroke: 0, arc: 0 } };
  shape.segments.forEach((segment, i) => {
    const candidate = closestPointOnSegment(point, segment);
    const offset = distance(point, candidate);
    const start = shape.segmentPositions[i];
    if (offset < nearest.distance && start) {
      const arc = start.arc + distance(segment[0], candidate);
      nearest = { point: candidate, distance: offset, position: { stroke: start.stroke, arc } };
    }
  });
  return nearest;
}

/** 선 위 구간: start에서 선을 따라 length만큼(닫힌 선은 끝을 넘어 처음으로 이어질 수 있다) */
export interface PathSpan {
  stroke: number;
  start: number;
  length: number;
  /** from에서 to로 갈 때 선의 진행 방향과 같은지 */
  forward: boolean;
}

/**
 * from에서 to까지 선을 따라 이어지는 구간. 다른 선이거나 FOLLOW_LIMIT보다 멀면 null.
 * 닫힌 선은 짧은 쪽으로 돈다.
 */
export function pathSpan(shape: Shape, from: PathPosition, to: PathPosition): PathSpan | null {
  const path = shape.paths[to.stroke];
  if (!path || from.stroke !== to.stroke) return null;
  let delta = to.arc - from.arc;
  if (path.isClosed && Math.abs(delta) > path.length / 2) {
    delta -= Math.sign(delta) * path.length;
  }
  if (Math.abs(delta) > FOLLOW_LIMIT) return null;
  const start = delta >= 0 ? from.arc : to.arc;
  return { stroke: to.stroke, start, length: Math.abs(delta), forward: delta >= 0 };
}

/** position이 span 안(양 끝 tolerance 포함)에 있는지 */
function isWithinSpan(
  shape: Shape,
  span: PathSpan,
  { position, tolerance }: { position: PathPosition; tolerance: number },
): boolean {
  const path = shape.paths[span.stroke];
  if (!path || position.stroke !== span.stroke) return false;
  const along = position.arc - (span.start - tolerance);
  const wrapped = path.isClosed ? ((along % path.length) + path.length) % path.length : along;
  return wrapped >= 0 && wrapped <= span.length + 2 * tolerance;
}

/** span 사이에 있는 윤곽선 꼭짓점들(선을 따라가는 순서). 긁은 자국이 모서리를 깎지 않고 선을 따라가게 한다 */
export function cornersWithin(shape: Shape, span: PathSpan): Point[] {
  const corners: { point: Point; along: number }[] = [];
  shape.segments.forEach(([point], i) => {
    const position = shape.segmentPositions[i];
    if (!position || !isWithinSpan(shape, span, { position, tolerance: 0 })) return;
    const length = shape.paths[span.stroke]?.length ?? Infinity;
    const along = (((position.arc - span.start) % length) + length) % length;
    if (along > 0 && along < span.length) corners.push({ point, along });
  });
  corners.sort((a, b) => (span.forward ? a.along - b.along : b.along - a.along));
  return corners.map((corner) => corner.point);
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
  // 선에 처음 닿는 이동이면 출발점도 검사한다(바늘을 댄 자리의 체크포인트가 빠지지 않게)
  const points = state.lastScrape ? samplePath(from, to) : [from, ...samplePath(from, to)];
  for (const point of points) applySample(next, shape, point);
  return next;
}

/** 지점 하나를 검사해 trace를 직접 고친다(traceMove가 만든 복사본에만 쓴다) */
function applySample(trace: TraceState, shape: Shape, point: Point): void {
  const nearest = nearestOnShape(shape, point);
  const offset = nearest.distance;

  if (offset > CRACK_DISTANCE && !trace.isOffPath) {
    trace.isOffPath = true;
    trace.cracks += 1;
    trace.crackPoints.push(point);
  } else if (offset <= RETURN_DISTANCE) {
    trace.isOffPath = false;
  }

  if (offset <= VISIT_RADIUS) {
    markVisited(trace, shape, nearest);
  } else {
    trace.lastScrape = null;
  }
}

/**
 * 직전에 긁은 지점부터 지금 지점까지 선을 따라 지나간 체크포인트를 긁은 것으로 표시하고,
 * 처음 긁힌 체크포인트마다 그때의 이탈 거리를 정확도에 더한다.
 */
function markVisited(trace: TraceState, shape: Shape, nearest: NearestPoint): void {
  const current = nearest.position;
  const span = (trace.lastScrape && pathSpan(shape, trace.lastScrape, current)) ?? {
    stroke: current.stroke,
    start: current.arc,
    length: 0,
    forward: true,
  };
  shape.checkpointPositions.forEach((position, i) => {
    if (!trace.visited[i] && isWithinSpan(shape, span, { position, tolerance: SCRAPE_TOLERANCE })) {
      trace.visited[i] = true;
      trace.visitedCount += 1;
      trace.deviationTotal += nearest.distance;
      trace.sampleCount += 1;
    }
  });
  trace.lastScrape = current;
}

/** 손을 뗐을 때. 다음에 대는 곳은 직전 지점과 이어지지 않는다 */
export function liftNeedle(trace: TraceState): TraceState {
  return { ...trace, lastScrape: null };
}
