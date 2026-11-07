import { Candy, CandyDefinitions } from './Candy.tsx';
import { formatPoints, isClosedStroke, type Shape } from './shapes.ts';

// 판이 끝나는 순간의 연출과 결과 화면 그림.
// 완성: 뽑아낸 모양이 판에서 떠오른다. 실패(깨짐·시간 초과): 과자가 두 조각으로 갈라진다.

/** 뽑아낸 모양: 닫힌 선은 과자로 채우고, 열린 선(우산 손잡이)은 굵은 과자 막대로 그린다 */
export function ShapeCutout({ shape }: { shape: Shape }) {
  return (
    <g className="dg-cutout">
      {shape.strokes.map((stroke, i) =>
        isClosedStroke(stroke) ? (
          <polygon key={i} className="dg-cutout-fill" points={formatPoints(stroke)} />
        ) : (
          <polyline key={i} className="dg-cutout-stick" points={formatPoints(stroke)} />
        ),
      )}
    </g>
  );
}

/** 과자가 갈라지는 선(위에서 아래로 지그재그). 왼쪽·오른쪽 조각을 나누는 경계이기도 하다 */
const SPLIT_LINE = 'M52 0 L46 22 L55 40 L47 58 L54 76 L49 100';

/** 깨진 과자: 판을 지그재그 선으로 잘라 두 조각이 벌어지게 한다 */
export function BrokenCandy({ shape }: { shape: Shape }) {
  const outline = shape.strokes.map((stroke, i) => (
    <polyline key={i} className="dg-groove-dark" points={formatPoints(stroke)} />
  ));
  return (
    <g>
      <defs>
        <clipPath id="dg-left-half">
          <path d={`${SPLIT_LINE} L0 100 L0 0 Z`} />
        </clipPath>
        <clipPath id="dg-right-half">
          <path d={`${SPLIT_LINE} L100 100 L100 0 Z`} />
        </clipPath>
      </defs>
      <g className="dg-half dg-half-left" clipPath="url(#dg-left-half)">
        <Candy />
        {outline}
      </g>
      <g className="dg-half dg-half-right" clipPath="url(#dg-right-half)">
        <Candy />
        {outline}
      </g>
    </g>
  );
}

export type FinaleKind = 'complete' | 'broken';

/** 결과 화면 위쪽에 보여줄 그림: 뽑은 모양, 또는 깨진 과자 */
export function ResultArt({ shape, kind }: { shape: Shape; kind: FinaleKind }) {
  return (
    <svg
      className="dg-result-art"
      viewBox="0 0 100 100"
      role="img"
      aria-label={kind === 'complete' ? `뽑아낸 ${shape.name}` : `깨진 ${shape.name} 달고나`}
    >
      <CandyDefinitions />
      {kind === 'complete' ? <ShapeCutout shape={shape} /> : <BrokenCandy shape={shape} />}
    </svg>
  );
}
