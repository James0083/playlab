// 달고나 모양 정의와 기하 계산. 좌표는 보드 단위(0~100, viewBox와 같음)이고 y는 아래로 증가한다.

export interface Point {
  x: number;
  y: number;
}

/** 한 번에 이어 긋는 선. 닫힌 도형은 마지막 점이 첫 점과 같다 */
export type Stroke = readonly Point[];
export type Segment = readonly [Point, Point];

export interface ShapeDefinition {
  id: string;
  name: string;
  /** 난이도(★ 개수) */
  stars: number;
  /** 완벽하게 뽑았을 때 점수 */
  baseScore: number;
  strokes: readonly Stroke[];
}

/** 선 위의 위치: 몇 번째 선(strokes 순서)의, 선 시작점부터 선을 따라 잰 길이 */
export interface PathPosition {
  stroke: number;
  arc: number;
}

export interface ShapePath {
  /** 선을 따라 잰 전체 길이 */
  length: number;
  /** 닫힌 선이면 끝에서 시작으로 이어진다 */
  isClosed: boolean;
}

export interface Shape extends ShapeDefinition {
  /** 반드시 긁고 지나가야 하는 점들. 윤곽선을 CHECKPOINT_SPACING 간격으로 나눈 것 */
  checkpoints: readonly Point[];
  /** checkpoints와 같은 순서로, 각 체크포인트의 선 위 위치 */
  checkpointPositions: readonly PathPosition[];
  /** 선과의 거리 계산에 쓰는 짧은 선분들 */
  segments: readonly Segment[];
  /** segments와 같은 순서로, 각 선분 시작점의 선 위 위치 */
  segmentPositions: readonly PathPosition[];
  /** strokes와 같은 순서로, 선마다 길이와 닫힘 여부 */
  paths: readonly ShapePath[];
}

/** 체크포인트 간격(보드 단위). 작을수록 촘촘히 긁어야 한다 */
export const CHECKPOINT_SPACING = 2;

// ---- 기하 유틸 ----

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** 선분 위에서 점과 가장 가까운 지점 */
export function closestPointOnSegment(point: Point, [a, b]: Segment): Point {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (lengthSquared === 0) return a;
  const t = ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / lengthSquared;
  return lerp(a, b, Math.min(Math.max(t, 0), 1));
}

/** 점에서 선분까지의 최단 거리 */
export function distanceToSegment(point: Point, segment: Segment): number {
  return distance(point, closestPointOnSegment(point, segment));
}

/** 선을 따라 spacing 간격으로 점을 다시 찍는다. 꼭짓점 간격이 제각각이어도 체크포인트가 고르게 된다 */
export function resample(stroke: Stroke, spacing: number): Point[] {
  const [first, ...rest] = stroke;
  if (!first) return [];
  const result = [first];
  let previous = first;
  let sinceLastPoint = 0;
  for (const next of rest) {
    const length = distance(previous, next);
    let along = spacing - sinceLastPoint;
    while (along <= length) {
      result.push(lerp(previous, next, along / length));
      along += spacing;
    }
    sinceLastPoint = length - (along - spacing);
    previous = next;
  }
  return result;
}

/** 이 거리 안이면 시작점과 끝점이 같은 것으로 본다. 원(0°→360°)은 부동소수점 오차로 끝점이 아주 조금 어긋난다 */
const CLOSED_TOLERANCE = 0.1;

/** 닫힌 도형(시작점으로 돌아오는 선)인지 */
export function isClosedStroke(stroke: Stroke): boolean {
  const [first] = stroke;
  const last = stroke.at(-1);
  return first !== undefined && last !== undefined && distance(first, last) <= CLOSED_TOLERANCE;
}

/** SVG polyline의 points 속성 문자열 */
export function formatPoints(stroke: Stroke): string {
  return stroke.map(({ x, y }) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

// ---- 모양 만들기 ----

interface ArcOptions {
  cx: number;
  cy: number;
  rx: number;
  ry?: number;
  /** 시작·끝 각도(도). 0°는 오른쪽, 90°는 아래 */
  from: number;
  to: number;
  /** 타원 자체를 중심 기준으로 이만큼(도, 시계 방향) 기울인다 */
  rotate?: number;
}

const ARC_STEP_DEGREES = 5;

/** 타원 호 위의 점들 */
function arc({ cx, cy, rx, ry = rx, from, to, rotate = 0 }: ArcOptions): Point[] {
  const count = Math.max(Math.ceil(Math.abs(to - from) / ARC_STEP_DEGREES), 1);
  const tilt = (rotate * Math.PI) / 180;
  return Array.from({ length: count + 1 }, (_, i) => {
    const radians = ((from + ((to - from) * i) / count) * Math.PI) / 180;
    const [x, y] = [rx * Math.cos(radians), ry * Math.sin(radians)];
    return {
      x: cx + x * Math.cos(tilt) - y * Math.sin(tilt),
      y: cy + x * Math.sin(tilt) + y * Math.cos(tilt),
    };
  });
}

/** 첫 점으로 돌아와 닫힌 도형을 만든다 */
function closed(points: Point[]): Point[] {
  const [first] = points;
  return first ? [...points, first] : points;
}

interface Ellipse {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /** 시계 방향 기울기(도) */
  rotate: number;
}

/** 점이 타원 안에 있는지 */
function isInsideEllipse({ cx, cy, rx, ry, rotate }: Ellipse, { x, y }: Point): boolean {
  const tilt = (-rotate * Math.PI) / 180;
  const [dx, dy] = [x - cx, y - cy];
  const localX = dx * Math.cos(tilt) - dy * Math.sin(tilt);
  const localY = dx * Math.sin(tilt) + dy * Math.cos(tilt);
  return (localX / rx) ** 2 + (localY / ry) ** 2 < 1;
}

/** 타원 둘레 중 다른 타원들 밖에 있는 구간들(각도가 커지는 방향, 1° 간격) */
function outsideArcs(ellipse: Ellipse, others: readonly Ellipse[]): Point[][] {
  const ring = arc({ ...ellipse, from: 0, to: 359 });
  const isOutside = ring.map((point) => !others.some((other) => isInsideEllipse(other, point)));
  // 가려진 점에서 출발해야 한 구간이 0°를 넘어가도 둘로 쪼개지지 않는다
  const start = isOutside.indexOf(false);
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (let i = 1; i <= ring.length; i++) {
    const index = (start + i) % ring.length;
    const point = ring[index];
    if (isOutside[index] && point) {
      run.push(point);
    } else if (run.length > 0) {
      runs.push(run);
      run = [];
    }
  }
  return runs;
}

/**
 * 겹친 타원들의 바깥 윤곽(합집합의 테두리)을 한 줄로 잇는다.
 * 각 타원에서 다른 타원 밖에 있는 호를 구하고, 끝점에서 가장 가까운 다음 호를 이어 붙인다.
 */
function unionOutline(ellipses: readonly Ellipse[]): Point[] {
  const pieces = ellipses.flatMap((ellipse) =>
    outsideArcs(
      ellipse,
      ellipses.filter((other) => other !== ellipse),
    ),
  );
  const outline = pieces.shift() ?? [];
  while (pieces.length > 0) {
    const end = outline.at(-1) ?? { x: 0, y: 0 };
    let nearest = 0;
    pieces.forEach((piece, i) => {
      const best = pieces[nearest]?.[0] ?? end;
      if (piece[0] && distance(end, piece[0]) < distance(end, best)) nearest = i;
    });
    outline.push(...pieces.splice(nearest, 1).flat());
  }
  return closed(outline);
}

/**
 * 토끼 얼굴(쿠키 틀 모양): 옆으로 넓은 타원 머리 + 위로 길쭉한 두 귀.
 * 귀 아랫부분을 머리 안으로 깊이 묻어, 귀와 머리가 만나는 곳이 안쪽으로 꺾인 홈이 된다.
 */
const RABBIT_OUTLINE = unionOutline([
  { cx: 50, cy: 62, rx: 24, ry: 19, rotate: 0 },
  { cx: 40, cy: 37, rx: 7.5, ry: 16, rotate: -12 },
  { cx: 60, cy: 37, rx: 7.5, ry: 16, rotate: 12 },
]);

/**
 * 우산 갓: 위쪽 반원 + 아래쪽 물결 3개.
 * 물결 깊이(UMBRELLA_WAVE_DEPTH)가 얕으면 물결을 직선으로 지나가도 선 근처에 머물러 긁힌 것이 된다.
 */
const UMBRELLA_WAVE_DEPTH = 9;
const UMBRELLA_CANOPY = [
  ...arc({ cx: 50, cy: 52, rx: 26, from: 180, to: 360 }),
  ...[67.33, 50, 32.67].flatMap((cx) =>
    arc({ cx, cy: 52, rx: 26 / 3, ry: UMBRELLA_WAVE_DEPTH, from: 360, to: 180 }),
  ),
];
/** 우산 손잡이: 가운데 물결 꼭대기에서 내려와 J자로 휜다 */
const UMBRELLA_HANDLE = [
  { x: 50, y: 52 - UMBRELLA_WAVE_DEPTH },
  { x: 50, y: 74 },
  ...arc({ cx: 45, cy: 74, rx: 5, from: 0, to: 180 }),
];

/** 쉬운 것부터. 이 순서대로 해금된다. 우산은 물결 3개와 J자 손잡이(열린 선)가 있어 가장 어렵다 */
export const SHAPE_DEFINITIONS: readonly ShapeDefinition[] = [
  {
    id: 'circle',
    name: '동그라미',
    stars: 1,
    baseScore: 100,
    strokes: [arc({ cx: 50, cy: 50, rx: 24, from: 0, to: 360 })],
  },
  {
    id: 'triangle',
    name: '세모',
    stars: 2,
    baseScore: 200,
    strokes: [
      closed([
        { x: 50, y: 24 },
        { x: 76, y: 70 },
        { x: 24, y: 70 },
      ]),
    ],
  },
  {
    id: 'square',
    name: '네모',
    stars: 2,
    baseScore: 300,
    strokes: [
      closed([
        { x: 28, y: 28 },
        { x: 72, y: 28 },
        { x: 72, y: 72 },
        { x: 28, y: 72 },
      ]),
    ],
  },
  {
    id: 'house',
    name: '집',
    stars: 3,
    baseScore: 400,
    strokes: [
      closed([
        { x: 50, y: 24 },
        { x: 76, y: 48 },
        { x: 70, y: 48 },
        { x: 70, y: 76 },
        { x: 30, y: 76 },
        { x: 30, y: 48 },
        { x: 24, y: 48 },
      ]),
    ],
  },
  { id: 'rabbit', name: '토끼', stars: 4, baseScore: 600, strokes: [RABBIT_OUTLINE] },
  {
    id: 'umbrella',
    name: '우산',
    stars: 5,
    baseScore: 800,
    strokes: [UMBRELLA_CANOPY, UMBRELLA_HANDLE],
  },
];

/** 선 하나를 체크포인트와 선분으로 나눈다. 선분은 마지막 체크포인트에서 선의 끝점(닫힌 선은 시작점)까지 잇는다 */
function buildPath(stroke: Stroke, strokeIndex: number) {
  const checkpoints = resample(stroke, CHECKPOINT_SPACING);
  const end = stroke.at(-1);
  const last = checkpoints.at(-1);
  const line =
    end && last && distance(last, end) > CLOSED_TOLERANCE ? [...checkpoints, end] : checkpoints;
  const arcs = [0];
  const segments: Segment[] = [];
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    if (!a || !b) continue;
    segments.push([a, b]);
    arcs.push((arcs.at(-1) ?? 0) + distance(a, b));
  }
  const position = (i: number): PathPosition => ({ stroke: strokeIndex, arc: arcs[i] ?? 0 });
  return {
    checkpoints,
    checkpointPositions: checkpoints.map((_, i) => position(i)),
    segments,
    segmentPositions: segments.map((_, i) => position(i)),
    path: { length: arcs.at(-1) ?? 0, isClosed: isClosedStroke(stroke) },
  };
}

export function buildShape(definition: ShapeDefinition): Shape {
  const built = definition.strokes.map(buildPath);
  return {
    ...definition,
    checkpoints: built.flatMap((part) => part.checkpoints),
    checkpointPositions: built.flatMap((part) => part.checkpointPositions),
    segments: built.flatMap((part) => part.segments),
    segmentPositions: built.flatMap((part) => part.segmentPositions),
    paths: built.map((part) => part.path),
  };
}

/** SHAPE_DEFINITIONS에 체크포인트와 선분을 붙인 것 */
export const SHAPES: readonly Shape[] = SHAPE_DEFINITIONS.map(buildShape);

export function getShape(index: number): Shape {
  const shape = SHAPES[index];
  if (!shape) throw new RangeError(`모양 번호가 범위를 벗어났습니다: ${index}`);
  return shape;
}
