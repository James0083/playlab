import type { RefObject } from 'react';

// 제기차기 장면(SVG): 마당 바닥 위에서 발등으로 제기를 찬다. 발등 높이가 높이 0이다.
// 매 프레임 바뀌는 부분(제기·발·그림자)은 state가 아니라 ref로 직접 갱신한다(CONVENTIONS.md §5).

/** 장면 크기. 화면에서는 폭에 맞춰 줄어든다 */
const VIEW = { width: 240, height: 340 };
/** 발등(차는 곳) 위치. 제기 높이 0이 이 y에 놓인다 */
const FOOT = { x: 120, y: 236 };
/** 제기 몸체가 땅에 닿을 때의 그림자 y */
const SHADOW_Y = 296;
/** 찬 뒤 발이 올라갔다 내려오는 시간(ms) */
export const KICK_ANIMATION_MS = 180;
/** 발이 올라가는 최대 각도(도) */
const KICK_DEGREES = -22;

export function createSceneElements(): SceneElements {
  return { jegi: null, foot: null, shadow: null, ring: null };
}

export interface SceneElements {
  jegi: SVGGElement | null;
  foot: SVGGElement | null;
  shadow: SVGEllipseElement | null;
  ring: SVGCircleElement | null;
}

interface SceneFrame {
  /** 제기 높이(발등 = 0, 위가 양수) */
  height: number;
  /** 지금 시각(ms). 제기가 살랑이는 데 쓴다 */
  timeMs: number;
  /** 마지막으로 찬 뒤 지난 시간(ms). 아직 안 찼으면 null */
  sinceKickMs: number | null;
  /** 제기가 발등에 가까울수록 1에 가까운 값(차는 시각 안내용 링 강조). 0~1 */
  nearness: number;
  /** 동작 줄이기 설정이면 살랑임·발 움직임을 끈다 */
  isMotionReduced: boolean;
}

/** 찬 직후 발이 올라간 정도(0~1). 가장 높이 올라갔다가 내려온다. 아직 안 찼거나 끝났으면 0 */
function kickAmountOf(sinceKickMs: number | null): number {
  if (sinceKickMs === null || sinceKickMs >= KICK_ANIMATION_MS) return 0;
  return Math.sin((Math.PI * sinceKickMs) / KICK_ANIMATION_MS);
}

/** 발등 위 제기 높이를 화면 y로 바꿔 장면의 그룹·그림자를 갱신한다 */
export function drawScene(elements: SceneElements, frame: SceneFrame): void {
  const { height, timeMs, sinceKickMs, nearness, isMotionReduced } = frame;
  const y = FOOT.y - height - 14;
  const wobble = isMotionReduced ? 0 : Math.sin(timeMs / 90) * 5;
  elements.jegi?.setAttribute('transform', `translate(${FOOT.x} ${y}) rotate(${wobble})`);

  // 높이 올라갈수록 그림자는 작고 옅다
  const lift = Math.min(1, Math.max(0, (height + 46) / 200));
  elements.shadow?.setAttribute('rx', String(24 - 12 * lift));
  elements.shadow?.setAttribute('opacity', String(0.32 - 0.18 * lift));

  const kickAmount = isMotionReduced ? 0 : kickAmountOf(sinceKickMs);
  elements.foot?.setAttribute('transform', `rotate(${KICK_DEGREES * kickAmount} 92 270)`);

  elements.ring?.setAttribute('opacity', String(0.25 + 0.6 * nearness));
  elements.ring?.setAttribute('stroke-width', String(2 + 3 * nearness));
}

interface SceneProps {
  /** 그리는 쪽(drawScene)이 읽는 요소 모음. 마운트되면 여기에 채워진다 */
  elementsRef: RefObject<SceneElements>;
}

export function Scene({ elementsRef }: SceneProps) {
  return (
    <svg
      className="jg-scene"
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
    >
      {/* 마당 바닥 */}
      <ellipse
        cx={FOOT.x}
        cy={SHADOW_Y}
        rx="24"
        ry="5"
        fill="#000"
        opacity=".3"
        ref={(node) => {
          elementsRef.current.shadow = node;
        }}
      />
      {/* 차는 곳 안내 링: 제기가 가까워지면 진해진다 */}
      <circle
        cx={FOOT.x}
        cy={FOOT.y - 14}
        r="22"
        fill="none"
        stroke="#e2574c"
        strokeDasharray="4 4"
        opacity=".25"
        ref={(node) => {
          elementsRef.current.ring = node;
        }}
      />
      {/* 서 있는 다리와 차는 발. 발은 발목(92, 270)을 축으로 올라간다 */}
      <rect x="70" y="262" width="34" height="78" rx="12" fill="#3d5a99" />
      <rect x="70" y="262" width="34" height="10" fill="#2f4678" />
      <g
        ref={(node) => {
          elementsRef.current.foot = node;
        }}
      >
        <path d="M82 262 L106 262 L124 244 L128 238 L116 232 L96 240 L82 248 Z" fill="#3d5a99" />
        <path
          d="M88 252 C96 240 114 232 130 234 C140 236 140 244 130 246 C116 250 104 256 96 262 Z"
          fill="#fbf7ee"
          stroke="#c9bfa8"
          strokeWidth="1.5"
        />
        <path
          d="M100 246 C110 240 120 238 130 238"
          stroke="#c9bfa8"
          strokeWidth="1.2"
          fill="none"
        />
      </g>
      {/* 제기: 엽전(네모 구멍) 하나에 종이 술. 몸체가 아래, 술이 위로 퍼진다 */}
      <g
        ref={(node) => {
          elementsRef.current.jegi = node;
        }}
        transform={`translate(${FOOT.x} ${FOOT.y - 14})`}
      >
        <g strokeLinecap="round" strokeWidth="5">
          <line x1="-4" y1="-4" x2="-16" y2="-30" stroke="#e2574c" />
          <line x1="-2" y1="-4" x2="-7" y2="-36" stroke="#f0c32a" />
          <line x1="0" y1="-4" x2="0" y2="-38" stroke="#4aa3df" />
          <line x1="2" y1="-4" x2="7" y2="-36" stroke="#7cc742" />
          <line x1="4" y1="-4" x2="16" y2="-30" stroke="#e2574c" />
        </g>
        <ellipse cx="0" cy="0" rx="14" ry="6" fill="#b8892f" />
        <ellipse cx="0" cy="-1.5" rx="14" ry="6" fill="#e0b24a" />
        <rect x="-3" y="-4" width="6" height="5" rx="1" fill="#8a6220" />
      </g>
    </svg>
  );
}
