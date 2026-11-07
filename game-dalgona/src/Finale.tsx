import { Candy, CandyDefinitions } from './Candy.tsx';
import { formatPoints, isClosedStroke, type Shape } from './shapes.ts';

// 판이 끝나는 순간의 연출과 결과 화면 그림.
// 완성: 뽑아낸 모양이 판에서 빠져 떨어지고 판에는 모양대로 구멍이 남는다.
// 실패(깨짐·시간 초과): 과자가 두 조각으로 갈라진다.

/** 열린 선(우산 손잡이)을 뽑았을 때의 과자 막대 굵기 */
const STICK_WIDTH = 4;

/** 모양의 면(닫힌 선)과 막대(열린 선)를 같은 색으로 그린다. 구멍 마스크와 조각 윤곽에 쓴다 */
function ShapeArea({ shape, color }: { shape: Shape; color: string }) {
  return shape.strokes.map((stroke, i) =>
    isClosedStroke(stroke) ? (
      <polygon key={i} points={formatPoints(stroke)} fill={color} />
    ) : (
      <polyline
        key={i}
        points={formatPoints(stroke)}
        fill="none"
        stroke={color}
        strokeWidth={STICK_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  );
}

interface FinaleArtProps {
  shape: Shape;
  /** 한 화면에 그림이 둘 이상 있어도 마스크 id가 겹치지 않게 붙이는 앞머리 */
  idPrefix: string;
}

/** 모양이 빠져나간 판: 모양대로 뚫린 구멍 안쪽에 그늘을 넣는다 */
export function HoledCandy({ shape, idPrefix }: FinaleArtProps) {
  const maskId = `${idPrefix}-hole`;
  return (
    <g>
      <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={100} height={100}>
        <rect width={100} height={100} fill="#fff" />
        <ShapeArea shape={shape} color="#000" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <Candy />
      </g>
      {/* 구멍 가장자리: 판 두께가 보이도록 어두운 테두리 */}
      <g className="dg-hole-rim">
        {shape.strokes.map((stroke, i) => (
          <polyline key={i} points={formatPoints(stroke)} />
        ))}
      </g>
    </g>
  );
}

/** 뽑아낸 조각: 판과 같은 무늬를 모양대로 잘라 낸다 */
export function ShapePiece({ shape, idPrefix }: FinaleArtProps) {
  const maskId = `${idPrefix}-piece`;
  return (
    <g className="dg-piece">
      <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={100} height={100}>
        <ShapeArea shape={shape} color="#fff" />
      </mask>
      <g mask={`url(#${maskId})`}>
        <Candy />
      </g>
      <g className="dg-piece-edge">
        {shape.strokes.map((stroke, i) => (
          <polyline key={i} points={formatPoints(stroke)} />
        ))}
      </g>
    </g>
  );
}

/** 과자가 갈라지는 선(위에서 아래로 지그재그). 왼쪽·오른쪽 조각을 나누는 경계이기도 하다 */
const SPLIT_LINE = 'M52 0 L46 22 L55 40 L47 58 L54 76 L49 100';

/** 깨진 과자: 판을 지그재그 선으로 잘라 두 조각이 벌어지게 한다 */
export function BrokenCandy({ shape, idPrefix }: FinaleArtProps) {
  const outline = shape.strokes.map((stroke, i) => (
    <polyline key={i} className="dg-groove-dark" points={formatPoints(stroke)} />
  ));
  return (
    <g>
      <defs>
        <clipPath id={`${idPrefix}-left-half`}>
          <path d={`${SPLIT_LINE} L0 100 L0 0 Z`} />
        </clipPath>
        <clipPath id={`${idPrefix}-right-half`}>
          <path d={`${SPLIT_LINE} L100 100 L100 0 Z`} />
        </clipPath>
      </defs>
      <g className="dg-half dg-half-left" clipPath={`url(#${idPrefix}-left-half)`}>
        <Candy />
        {outline}
      </g>
      <g className="dg-half dg-half-right" clipPath={`url(#${idPrefix}-right-half)`}>
        <Candy />
        {outline}
      </g>
    </g>
  );
}

export type FinaleKind = 'complete' | 'broken';

const RESULT_ID = 'dg-result';

/**
 * 결과 화면 위쪽 그림.
 * 완성: 구멍 난 판 옆으로 뽑아낸 조각이 빠져나와 놓여 있다. 실패: 깨진 과자.
 */
export function ResultArt({ shape, kind }: { shape: Shape; kind: FinaleKind }) {
  return (
    <svg
      className="dg-result-art"
      viewBox="0 0 100 100"
      role="img"
      aria-label={
        kind === 'complete' ? `${shape.name} 모양을 뽑아낸 달고나` : `깨진 ${shape.name} 달고나`
      }
    >
      <CandyDefinitions />
      {kind === 'complete' ? (
        <>
          <g transform="translate(2 2) scale(0.72)">
            <HoledCandy shape={shape} idPrefix={RESULT_ID} />
          </g>
          <g
            className="dg-piece-fallen"
            transform="translate(66 68) rotate(14) scale(0.62) translate(-50 -50)"
          >
            <ShapePiece shape={shape} idPrefix={RESULT_ID} />
          </g>
        </>
      ) : (
        <BrokenCandy shape={shape} idPrefix={RESULT_ID} />
      )}
    </svg>
  );
}
