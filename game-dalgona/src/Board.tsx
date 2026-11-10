import { useEffect, useRef, type PointerEvent, type ReactNode, type RefObject } from 'react';
import { Candy, CandyDefinitions } from './Candy.tsx';
import { BrokenCandy, HoledCandy, ShapePiece, type FinaleKind } from './Finale.tsx';
import { MAX_CRACKS, progressOf } from './rules.ts';
import { distance, formatPoints, type Point, type Shape } from './shapes.ts';
import type { TraceState } from './trace.ts';

/** 그린 자국(흰 선)을 그리는 상태. 이어 긋는 동안 같은 선에 점을 덧붙인다 */
export interface ScratchTrail {
  layer: SVGGElement | null;
  /** 지금 이어 그리는 선. 손을 떼면 null이 되고 다음에 새 선을 시작한다 */
  current: SVGPolylineElement | null;
  /** 마지막으로 덧붙인 점 */
  last: Point | null;
}

/** 그릴 때마다 직접 갱신하는 요소들. React 상태로 다루면 포인터가 움직일 때마다 전체를 다시 그린다 */
export interface BoardElements {
  trail: ScratchTrail;
  /** 점선의 점들(shape.checkpoints와 같은 순서). 그린 점은 흐려진다 */
  dots: (SVGCircleElement | null)[];
  needle: SVGGElement | null;
  progress: HTMLSpanElement | null;
}

/** 이보다 가까운 지점은 덧붙이지 않는다(같은 자리를 문지를 때 점이 쌓이지 않게) */
const TRAIL_MIN_STEP = 0.4;

function appendPoint(trail: ScratchTrail, point: Point): void {
  const svg = trail.layer?.ownerSVGElement;
  if (!trail.current || !svg) return;
  const svgPoint = svg.createSVGPoint();
  svgPoint.x = point.x;
  svgPoint.y = point.y;
  trail.current.points.appendItem(svgPoint);
  trail.last = point;
}

/** 손을 댄 자리에서 새 자국을 시작한다 */
export function startTrail(trail: ScratchTrail, point: Point): void {
  if (!trail.layer) return;
  trail.current = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  trail.current.setAttribute('class', 'dg-trail');
  trail.layer.append(trail.current);
  appendPoint(trail, point);
}

/**
 * 손이 지나간 자리를 그대로 이어 긋는다. 선 위로 옮겨 그리지 않는다(2026-11-10 자동 보정 제거):
 * 흰 선이 곧 내가 그린 그림이다.
 */
export function extendTrail(trail: ScratchTrail, point: Point): void {
  if (!trail.current || (trail.last && distance(trail.last, point) < TRAIL_MIN_STEP)) return;
  appendPoint(trail, point);
}

/** 지금 긋던 자국을 끝낸다(손을 뗐을 때). 다음 긋기는 새 선으로 시작한다 */
export function endTrail(trail: ScratchTrail): void {
  trail.current = null;
  trail.last = null;
}

/** 바늘 위치, 점선(그린 점은 흐리게), 진행률을 그린다 */
export function drawTrace(
  elements: BoardElements,
  { trace, needle }: { trace: TraceState; needle: Point | null },
): void {
  if (elements.needle) {
    elements.needle.classList.toggle('dg-needle-visible', needle !== null);
    if (needle) elements.needle.setAttribute('transform', `translate(${needle.x} ${needle.y})`);
  }
  elements.dots.forEach((dot, i) => {
    const className = trace.visited[i] ? 'dg-dot dg-dot-done' : 'dg-dot';
    if (dot && dot.getAttribute('class') !== className) dot.setAttribute('class', className);
  });
  if (elements.progress) {
    elements.progress.textContent = `${Math.floor(progressOf(trace) * 100)}%`;
  }
}

/** 화면 좌표를 보드 좌표(0~100)로 바꾼다 */
export function toBoardPoint(board: SVGSVGElement, { clientX, clientY }: MouseEvent): Point {
  const rect = board.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
  };
}

/** 금 모양: 금이 간 지점을 지나는 지그재그. 번호마다 방향을 돌려 같은 모양이 반복되지 않게 한다 */
const CRACK_ZIGZAG = [
  { x: -6, y: -2 },
  { x: -2, y: 1 },
  { x: 1, y: -2 },
  { x: 6, y: 2 },
];
const CRACK_ROTATION_DEGREES = 67;

function crackPolyline(center: Point, index: number): string {
  const radians = (index * CRACK_ROTATION_DEGREES * Math.PI) / 180;
  const [cos, sin] = [Math.cos(radians), Math.sin(radians)];
  return formatPoints(
    CRACK_ZIGZAG.map(({ x, y }) => ({
      x: center.x + x * cos - y * sin,
      y: center.y + x * sin + y * cos,
    })),
  );
}

/** 판 안의 마스크·잘라내기 id 앞머리 */
const BOARD_ID = 'dg-board';

interface BoardProps {
  shape: Shape;
  crackPoints: readonly Point[];
  /** 끝나는 연출 중이면 그 종류(완성: 모양이 빠져 떨어짐, 깨짐: 과자가 갈라짐) */
  finale: FinaleKind | null;
  /** 판 위에 겹쳐 보여줄 것(예: 시작 안내) */
  overlay: ReactNode;
  elementsRef: RefObject<BoardElements>;
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void;
  onPointerUp: () => void;
}

/** 바늘: 끝이 (0,0)이고 오른쪽 위로 뻗는다. 떨어진 그림자를 함께 그린다 */
function Needle() {
  return (
    <g>
      <line
        x1={1.2}
        y1={1.2}
        x2={19}
        y2={-14}
        stroke="#000"
        strokeOpacity={0.25}
        strokeWidth={1.6}
      />
      <line
        x1={0}
        y1={0}
        x2={18}
        y2={-16}
        stroke="url(#dg-needle-metal)"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
      <circle
        cx={18}
        cy={-16}
        r={1.8}
        fill="url(#dg-needle-metal)"
        stroke="#4a5058"
        strokeWidth={0.3}
      />
    </g>
  );
}

export function Board({
  shape,
  crackPoints,
  finale,
  overlay,
  elementsRef,
  ...handlers
}: BoardProps) {
  const cracks = crackPoints.length;
  const board = useRef<SVGSVGElement>(null);

  // 판이 나타나면 포커스를 옮겨 스크린리더가 안내(aria-label)를 읽게 한다
  useEffect(() => board.current?.focus(), []);

  return (
    <div className="dg-board-wrap">
      <p className="dg-status">
        <span role="status" aria-label={`균열 ${cracks}번, ${MAX_CRACKS}번이면 깨져요`}>
          균열 {'●'.repeat(cracks)}
          {'○'.repeat(Math.max(MAX_CRACKS - cracks, 0))}
        </span>
        <span
          ref={(node) => {
            elementsRef.current.progress = node;
          }}
        >
          0%
        </span>
      </p>
      {/* 판 아래 그림자는 고정된 배경(CSS)으로 그린다. 계속 바뀌는 SVG에 필터를 걸면 모바일에서 느려진다 */}
      <div className="dg-board-frame">
        <svg
          ref={board}
          tabIndex={-1}
          className={finale ? `dg-board dg-finale-${finale}` : 'dg-board'}
          viewBox="0 0 100 100"
          role="img"
          aria-label={`${shape.name} 달고나. 점선을 따라 정확하게 그리세요`}
          onPointerDown={handlers.onPointerDown}
          onPointerMove={handlers.onPointerMove}
          onPointerUp={handlers.onPointerUp}
          onPointerCancel={handlers.onPointerUp}
        >
          <CandyDefinitions />
          {finale === 'broken' && <BrokenCandy shape={shape} idPrefix={BOARD_ID} />}
          {finale === 'complete' && (
            <>
              <HoledCandy shape={shape} idPrefix={BOARD_ID} />
              <g className="dg-piece-falling">
                <ShapePiece shape={shape} idPrefix={BOARD_ID} />
              </g>
            </>
          )}
          {finale === null && (
            <g>
              <Candy />
              {/* 따라 그릴 점선: 눌러 찍힌 점들. 그린 점은 drawTrace가 흐리게 바꾼다 */}
              {shape.checkpoints.map(({ x, y }, i) => (
                <circle
                  key={i}
                  ref={(node) => {
                    elementsRef.current.dots[i] = node;
                  }}
                  className="dg-dot"
                  cx={x}
                  cy={y}
                  r={0.65}
                />
              ))}
              {/* 그린 자국: extendTrail이 손이 지나간 자리를 그대로 덧붙인다 */}
              <g
                ref={(node) => {
                  elementsRef.current.trail.layer = node;
                }}
              />
            </g>
          )}
          {/* 금: 밝은 가장자리 위에 어두운 틈을 그려 깊이를 낸다 */}
          {crackPoints.map((point, i) => (
            <g key={i} className="dg-crack">
              <polyline className="dg-crack-edge" points={crackPolyline(point, i)} />
              <polyline className="dg-crack-gap" points={crackPolyline(point, i)} />
            </g>
          ))}
          <g
            ref={(node) => {
              elementsRef.current.needle = node;
            }}
            className="dg-needle"
          >
            <Needle />
          </g>
        </svg>
        {overlay && <div className="dg-overlay">{overlay}</div>}
      </div>
    </div>
  );
}
