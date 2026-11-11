import type { RefObject } from 'react';

// 바로 위에서 내려다본 양철 팽이(SVG). 양철 테두리 원판 안에 동심원 색 스티커, 가운데 플라스틱 손잡이,
// 원판 아래로 노란 골진 플라스틱 원뿔 몸통과 쇠 심이 있다. (0, 0)이 쇠 심이 바닥에 닿는 점이다.
// 입체감: 축이 기울면 원판이 기운 쪽으로 밀리며 타원으로 눌리고, 반대쪽으로 몸통이 드러나며 그림자가 늘어난다.
// 쓰러지면 원판이 거의 옆면으로 보이고 몸통이 판 위에 눕는다.

/** 매 프레임 직접 갱신하는 팽이 요소 */
export interface TopElements {
  /** 기운 방향으로 돌린 그룹(그 안에서는 +x가 기운 방향) */
  body: SVGGElement | null;
  shadow: SVGEllipseElement | null;
  cone: SVGGElement | null;
  disc: SVGGElement | null;
  knob: SVGGElement | null;
  /** 회전과 함께 도는 무늬(점·표식)와, 빠를 때 덮는 번짐 */
  patternSpin: SVGGElement | null;
  blur: SVGGElement | null;
}

export function createTopElements(): TopElements {
  return {
    body: null,
    shadow: null,
    cone: null,
    disc: null,
    knob: null,
    patternSpin: null,
    blur: null,
  };
}

/** 원판 반지름, 쇠 심 끝에서 원판까지 높이, 손잡이 높이 */
export const DISC_RADIUS = 36;
/** 실제 팽이처럼 몸통 높이가 원판 반지름의 1.3배쯤 */
const DISC_HEIGHT = 48;
const KNOB_HEIGHT = 10;
const KNOB_RADIUS = 7.5;
/** 양철 테두리 폭 */
const RIM_WIDTH = 6;

export interface TopPose {
  /** 축이 기운 각도(도). 0이면 꼿꼿이 서 있다 */
  leanDegrees: number;
  /** 기운 방향(라디안, 화면 기준) */
  leanDirection: number;
  /** 무늬 각도(도) */
  spinDegrees: number;
  /** 무늬가 번진 정도(0 = 또렷, 1 = 띠로만 보임) */
  blur: number;
}

/** 기울기에 맞춰 팽이 각 부분을 놓는다 */
export function drawTop(elements: TopElements, pose: TopPose): void {
  const radians = (pose.leanDegrees * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  // 원판 가운데는 기운 쪽으로 높이 × sin만큼 밀리고, 기운 축 방향으로 cos만큼 눌려 보인다
  const discShift = DISC_HEIGHT * sin;
  const knobShift = (DISC_HEIGHT + KNOB_HEIGHT) * sin;
  elements.body?.setAttribute(
    'transform',
    `rotate(${((pose.leanDirection * 180) / Math.PI).toFixed(2)})`,
  );
  elements.disc?.setAttribute(
    'transform',
    `translate(${discShift.toFixed(2)} 0) scale(${Math.max(cos, 0.04).toFixed(3)} 1)`,
  );
  elements.knob?.setAttribute(
    'transform',
    `translate(${knobShift.toFixed(2)} 0) scale(${Math.max(cos, 0.04).toFixed(3)} 1)`,
  );
  // 몸통: 쇠 심(원점)에서 원판 테두리까지의 삼각형. 서 있을 때는 원판에 가려 보이지 않는다
  elements.cone?.setAttribute(
    'transform',
    `scale(${Math.max(discShift, 0.01).toFixed(2)} ${DISC_RADIUS})`,
  );
  // 그림자는 빛(왼쪽 위) 반대쪽으로 조금 치우치고, 기울수록 기운 쪽으로 늘어난다
  elements.shadow?.setAttribute(
    'transform',
    `translate(${(discShift * 0.55 + 2).toFixed(2)} 2) scale(${(1 + sin * 0.7).toFixed(3)} 1)`,
  );
  elements.patternSpin?.setAttribute('transform', `rotate(${pose.spinDegrees.toFixed(1)})`);
  elements.patternSpin?.setAttribute('opacity', (1 - 0.9 * pose.blur).toFixed(2));
  elements.blur?.setAttribute('opacity', pose.blur.toFixed(2));
}

/** 스티커 동심원: 바깥에서 안으로 [반지름, 색] */
const RINGS: readonly [number, string][] = [
  [DISC_RADIUS - RIM_WIDTH, '#f6f1e6'],
  [25, '#d8322a'],
  [20.5, '#f1f1ec'],
  [17, '#2a52a8'],
  [13, '#f0c32a'],
  [10, '#2e9d4c'],
];

/** 스티커 위의 표식들: 바깥 흰 띠의 축구공 두 개와 글자 띠처럼 보이는 짧은 호. 돌면 함께 돈다 */
function Marks() {
  const r = 27.7;
  return (
    <g>
      {[0, 180].map((deg) => (
        <g key={deg} transform={`rotate(${deg}) translate(${r} 0)`}>
          <circle r={1.9} fill="#fff" stroke="#222" strokeWidth={0.5} />
          <circle r={0.7} fill="#222" />
        </g>
      ))}
      {[60, 240].map((deg) => (
        <path
          key={deg}
          d={`M${r} 0 A${r} ${r} 0 0 1 ${(r * Math.cos(0.9)).toFixed(2)} ${(r * Math.sin(0.9)).toFixed(2)}`}
          transform={`rotate(${deg})`}
          fill="none"
          stroke="#222"
          strokeWidth={1.2}
          strokeDasharray="1.2 1"
        />
      ))}
    </g>
  );
}

/** 바로 위에서 본 양철 팽이 */
export function SpinningTop({ elementsRef }: { elementsRef: RefObject<TopElements> }) {
  return (
    <g>
      <g
        ref={(node) => {
          elementsRef.current.body = node;
        }}
      >
        <ellipse
          ref={(node) => {
            elementsRef.current.shadow = node;
          }}
          rx={DISC_RADIUS + 2}
          ry={DISC_RADIUS}
          fill="url(#pg-top-shadow)"
        />
        {/* 노란 골진 원뿔 몸통(단위 삼각형을 drawTop이 늘린다)과 쇠 심 */}
        <g
          ref={(node) => {
            elementsRef.current.cone = node;
          }}
        >
          <polygon points="0,0 1,-1 1,1" fill="url(#pg-cone)" />
          <g stroke="#b8860b" strokeOpacity={0.5} vectorEffect="non-scaling-stroke">
            {[0.3, 0.45, 0.6, 0.75, 0.9].map((x) => (
              <line key={x} x1={x} y1={-x} x2={x} y2={x} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        </g>
        <circle r={2.6} fill="url(#pg-steel)" />
        {/* 양철 테두리 원판과 스티커 */}
        <g
          ref={(node) => {
            elementsRef.current.disc = node;
          }}
        >
          {/* 테두리 두께: 어두운 테를 살짝 어긋나게 깔아 금속이 두꺼워 보이게 한다 */}
          <circle cx={1.2} cy={1.4} r={DISC_RADIUS} fill="#6b6f74" />
          <circle r={DISC_RADIUS} fill="url(#pg-tin)" />
          {RINGS.map(([radius, color]) => (
            <circle key={radius} r={radius} fill={color} />
          ))}
          <g
            ref={(node) => {
              elementsRef.current.patternSpin = node;
            }}
          >
            <Marks />
          </g>
          {/* 빠를 때: 표식이 번져 띠로만 보인다 */}
          <g
            ref={(node) => {
              elementsRef.current.blur = node;
            }}
            opacity={0}
          >
            <circle r={DISC_RADIUS - RIM_WIDTH} fill="none" stroke="#c9c2b4" strokeWidth={3.4} />
          </g>
          <circle r={DISC_RADIUS - 1} fill="url(#pg-disc-shine)" />
        </g>
        {/* 가운데 플라스틱 손잡이 */}
        <g
          ref={(node) => {
            elementsRef.current.knob = node;
          }}
        >
          <circle cx={0.8} cy={1} r={KNOB_RADIUS} fill="#3f6d1e" />
          <circle r={KNOB_RADIUS} fill="url(#pg-knob)" />
          <circle r={3} fill="#2f5516" fillOpacity={0.6} />
        </g>
      </g>
    </g>
  );
}

/** 판·팽이 그라데이션 */
export function TopDefinitions() {
  return (
    <defs>
      <radialGradient id="pg-top-shadow">
        <stop offset="55%" stopColor="#000" stopOpacity={0.32} />
        <stop offset="100%" stopColor="#000" stopOpacity={0} />
      </radialGradient>
      {/* 양철: 빛은 왼쪽 위에서 온다 */}
      <linearGradient id="pg-tin" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#f4f6f8" />
        <stop offset="45%" stopColor="#b9c0c7" />
        <stop offset="60%" stopColor="#e8ecef" />
        <stop offset="100%" stopColor="#8d949b" />
      </linearGradient>
      <radialGradient id="pg-disc-shine" cx="35%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.35} />
        <stop offset="50%" stopColor="#fff" stopOpacity={0} />
        <stop offset="100%" stopColor="#000" stopOpacity={0.12} />
      </radialGradient>
      <radialGradient id="pg-knob" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#c6f08a" />
        <stop offset="60%" stopColor="#7cc742" />
        <stop offset="100%" stopColor="#4a8a24" />
      </radialGradient>
      {/* 몸통: 기운 축을 따라(단위 삼각형의 x) 밝은 노랑에서 그늘진 노랑으로 */}
      <linearGradient id="pg-cone" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#f7d64a" />
        <stop offset="50%" stopColor="#f0b818" />
        <stop offset="100%" stopColor="#b8820a" />
      </linearGradient>
      <radialGradient id="pg-steel" cx="35%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#eef1f4" />
        <stop offset="100%" stopColor="#3e444a" />
      </radialGradient>
      <radialGradient id="pg-wood" cx="38%" cy="34%" r="78%">
        <stop offset="0%" stopColor="#f3d9a8" />
        <stop offset="70%" stopColor="#d9a86a" />
        <stop offset="100%" stopColor="#b8824a" />
      </radialGradient>
      {/* 판 테두리(두께): 왼쪽 위는 빛을 받고 오른쪽 아래는 그늘진다 */}
      <linearGradient id="pg-rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#c48d52" />
        <stop offset="100%" stopColor="#6e4521" />
      </linearGradient>
    </defs>
  );
}
