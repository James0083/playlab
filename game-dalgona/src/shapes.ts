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

export interface Shape extends ShapeDefinition {
  /** 반드시 긁고 지나가야 하는 점들. 윤곽선을 CHECKPOINT_SPACING 간격으로 나눈 것 */
  checkpoints: readonly Point[];
  /** 선과의 거리 계산에 쓰는 짧은 선분들 */
  segments: readonly Segment[];
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

/**
 * 토끼 실루엣: 머리와 두 귀를 한 줄로 잇는다(바깥 윤곽만).
 * 머리 아래쪽 → 왼쪽 귀 → 귀 사이 정수리 → 오른쪽 귀 → 다시 머리. 귀는 바깥으로 살짝 벌어진다.
 */
const RABBIT_HEAD = { cx: 50, cy: 63, rx: 16 };
const RABBIT_OUTLINE = closed([
  ...arc({ ...RABBIT_HEAD, from: -62, to: 242 }),
  ...arc({ cx: 42, cy: 33, rx: 5.5, ry: 14, from: 100, to: 440, rotate: -12 }),
  ...arc({ ...RABBIT_HEAD, from: 258, to: 282 }),
  ...arc({ cx: 58, cy: 33, rx: 5.5, ry: 14, from: 100, to: 440, rotate: 12 }),
]);

/** 우산 갓: 위쪽 반원 + 아래쪽 물결 3개 */
const UMBRELLA_CANOPY = [
  ...arc({ cx: 50, cy: 52, rx: 26, from: 180, to: 360 }),
  ...[67.33, 50, 32.67].flatMap((cx) => arc({ cx, cy: 52, rx: 26 / 3, ry: 5, from: 360, to: 180 })),
];
/** 우산 손잡이: 갓 가운데에서 내려와 J자로 휜다 */
const UMBRELLA_HANDLE = [
  { x: 50, y: 47 },
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

export function buildShape(definition: ShapeDefinition): Shape {
  const lines = definition.strokes.map((stroke) => resample(stroke, CHECKPOINT_SPACING));
  return {
    ...definition,
    checkpoints: lines.flat(),
    segments: lines.flatMap((line) =>
      line.slice(1).map((point, i): Segment => [line[i] ?? point, point]),
    ),
  };
}

/** SHAPE_DEFINITIONS에 체크포인트와 선분을 붙인 것 */
export const SHAPES: readonly Shape[] = SHAPE_DEFINITIONS.map(buildShape);

export function getShape(index: number): Shape {
  const shape = SHAPES[index];
  if (!shape) throw new RangeError(`모양 번호가 범위를 벗어났습니다: ${index}`);
  return shape;
}
