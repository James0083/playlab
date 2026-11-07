import type { CSSProperties, RefObject } from 'react';
import { createHudElements, HudTop, WarningPill, type HudElements } from './Hud.tsx';
import { MAX_INTENSITY, SPILL_PENALTY } from './rules.ts';

// 버블티 쉐이커 컵(SVG). 좌표는 viewBox(200×300) 기준이고 빛은 왼쪽 위에서 온다.
// 흔드는 동안 바뀌는 값(컵 흔들림, 섞인 색, 펄 튐, 게이지)은 drawCup이 매 프레임 직접 갱신한다.

/** 매 프레임 직접 갱신하는 요소. React 상태로 다루면 센서 이벤트마다(초당 60번) 다시 렌더링한다 */
export interface CupElements extends HudElements {
  shaker: SVGGElement | null;
  mixLayer: SVGRectElement | null;
  pearls: (SVGCircleElement | null)[];
}

export function createCupElements(): CupElements {
  return { ...createHudElements(), shaker: null, mixLayer: null, pearls: [] };
}

export interface CupFrame {
  /** 지금 흔드는 세기(포락선). 컵 흔들림과 펄 튐의 크기 */
  intensity: number;
  /** 섞인 정도(0~1) */
  mix: number;
  /** 애니메이션 시각(ms) */
  timeMs: number;
  /** 움직임 배율. 동작 줄이기 설정이면 0으로 넘겨 컵을 흔들지 않는다 */
  motionScale: number;
}

/** 가장 세게 흔들 때 컵이 기우는 각도(도)와 좌우로 움직이는 거리 */
const MAX_TILT_DEGREES = 10;
const MAX_SWAY = 8;
/** 가장 세게 흔들 때 펄이 튀어 오르는 높이 */
const MAX_PEARL_BOUNCE = 70;
/** 흔들림 주기(ms). 짧을수록 빨리 떨린다 */
const SWAY_PERIOD_MS = 140;
const BOUNCE_PERIOD_MS = 260;

/** 한 프레임을 그린다: 컵 흔들림, 섞인 색, 펄. 게이지·경고는 drawHud가 그린다 */
export function drawCup(
  elements: CupElements,
  { intensity, mix, timeMs, motionScale }: CupFrame,
): void {
  const strength = Math.min(intensity / MAX_INTENSITY, 1) * motionScale;
  const wave = Math.sin((timeMs / SWAY_PERIOD_MS) * Math.PI * 2);
  elements.shaker?.setAttribute(
    'transform',
    `translate(${wave * MAX_SWAY * strength} 0) rotate(${wave * MAX_TILT_DEGREES * strength} 100 170)`,
  );
  elements.mixLayer?.setAttribute('opacity', String(mix));
  elements.pearls.forEach((pearl, i) => {
    // 펄마다 박자를 어긋나게 해 한꺼번에 뛰지 않게 한다
    const phase = (timeMs / BOUNCE_PERIOD_MS + i * 0.37) * Math.PI * 2;
    const bounce = Math.abs(Math.sin(phase)) * MAX_PEARL_BOUNCE * strength;
    pearl?.setAttribute('transform', `translate(0 ${-bounce})`);
  });
}

/** 컵 바닥의 펄 위치 */
const PEARLS = [
  { x: 70, y: 262 },
  { x: 86, y: 266 },
  { x: 102, y: 268 },
  { x: 118, y: 266 },
  { x: 133, y: 261 },
  { x: 78, y: 250 },
  { x: 94, y: 254 },
  { x: 110, y: 255 },
  { x: 126, y: 250 },
  { x: 102, y: 242 },
  { x: 86, y: 240 },
  { x: 118, y: 239 },
];
const PEARL_RADIUS = 7;

/** 차 윗면 높이. 넘칠 때마다 SPILL_LEVEL_DROP만큼 내려간다(최대 MAX_LEVEL_DROP) */
const TEA_TOP = 92;
const SPILL_LEVEL_DROP = 6;
const MAX_LEVEL_DROP = 48;

/** 넘칠 때 컵 입구에서 튀는 방울: 출발 위치와 날아가는 방향 */
const DROPLETS = [
  { x: 52, dx: -34, dy: -26 },
  { x: 62, dx: -22, dy: -40 },
  { x: 140, dx: 22, dy: -40 },
  { x: 150, dx: 34, dy: -24 },
  { x: 100, dx: 4, dy: -46 },
];

/** 쉐이커 컵 옆면. 위가 넓고 아래가 좁다 */
const CUP_PATH = 'M40 64 L160 64 L146 282 Q100 292 54 282 Z';

interface CupProps {
  elementsRef: RefObject<CupElements>;
  spills: number;
  /** 끝나는 연출 중이면 true: 빨대가 꽂히고 컵이 통통 튄다 */
  isFinished: boolean;
}

export function Cup({ elementsRef, spills, isFinished }: CupProps) {
  const teaTop = TEA_TOP + Math.min(spills * SPILL_LEVEL_DROP, MAX_LEVEL_DROP);

  return (
    <span className="bt-cup-wrap">
      <HudTop elementsRef={elementsRef} />
      <svg className="bt-cup" viewBox="0 0 200 300" aria-hidden="true">
        <CupDefinitions />
        <ellipse cx={100} cy={292} rx={64} ry={7} fill="url(#bt-floor-shadow)" />
        <g
          ref={(node) => {
            elementsRef.current.shaker = node;
          }}
        >
          <g className={isFinished ? 'bt-shaker bt-shaker-done' : 'bt-shaker'}>
            {isFinished && <Straw />}
            <g clipPath="url(#bt-cup-inside)">
              <rect x={30} y={teaTop} width={140} height={230} fill="url(#bt-tea)" />
              {/* 섞이기 전: 위쪽에 우유가 떠 있다 */}
              <rect x={30} y={teaTop} width={140} height={60} fill="url(#bt-milk)" />
              {/* 섞인 밀크티 색. 섞인 정도만큼 진해진다 */}
              <rect
                ref={(node) => {
                  elementsRef.current.mixLayer = node;
                }}
                x={30}
                y={teaTop}
                width={140}
                height={230}
                fill="url(#bt-milk-tea)"
                opacity={0}
              />
              {PEARLS.map(({ x, y }, i) => (
                <circle
                  key={i}
                  ref={(node) => {
                    elementsRef.current.pearls[i] = node;
                  }}
                  cx={x}
                  cy={y}
                  r={PEARL_RADIUS}
                  fill="url(#bt-pearl)"
                />
              ))}
            </g>
            <path d={CUP_PATH} fill="url(#bt-plastic)" stroke="#9aa6b2" strokeWidth={2} />
            {/* 플라스틱 반사광 */}
            <path d="M52 78 L62 262" stroke="#fff" strokeOpacity={0.55} strokeWidth={6} />
            <Lid />
          </g>
        </g>
        {spills > 0 && (
          <g key={spills} className="bt-droplets">
            {/* 넘칠 때마다 잃은 점수를 컵 입구에 띄운다 */}
            <text className="bt-penalty" x={100} y={44} textAnchor="middle">
              −{SPILL_PENALTY}
            </text>
            {DROPLETS.map(({ x, dx, dy }, i) => (
              <circle
                key={i}
                className="bt-droplet"
                cx={x}
                cy={60}
                r={4}
                style={{ '--dx': `${dx}px`, '--dy': `${dy}px` } as CSSProperties}
              />
            ))}
          </g>
        )}
      </svg>
      <WarningPill elementsRef={elementsRef} />
    </span>
  );
}

/** 쉐이커 뚜껑: 볼록한 돔 + 테두리 */
function Lid() {
  return (
    <g>
      <path d="M34 64 Q100 18 166 64 Z" fill="url(#bt-plastic)" stroke="#9aa6b2" strokeWidth={2} />
      <rect x={32} y={60} width={136} height={10} rx={4} fill="#d7dee5" stroke="#9aa6b2" />
    </g>
  );
}

/** 빨대 윗끝과 길이. 윗끝이 뚜껑 위로 조금만 나와 게이지 글자를 가리지 않게 한다 */
const STRAW_TOP = 12;
const STRAW_LENGTH = 208;

/** 끝나는 연출: 굵은 버블티 빨대가 뚜껑을 뚫고 꽂힌다 */
function Straw() {
  return (
    <g className="bt-straw">
      <rect
        x={112}
        y={STRAW_TOP}
        width={14}
        height={STRAW_LENGTH}
        rx={4}
        fill="#e2574c"
        transform="rotate(8 119 95)"
      />
      <rect
        x={114}
        y={STRAW_TOP}
        width={4}
        height={STRAW_LENGTH}
        fill="#fff"
        opacity={0.35}
        transform="rotate(8 119 95)"
      />
    </g>
  );
}

function CupDefinitions() {
  return (
    <defs>
      <clipPath id="bt-cup-inside">
        <path d={CUP_PATH} />
      </clipPath>
      <radialGradient id="bt-floor-shadow">
        <stop offset="0%" stopColor="#000" stopOpacity={0.3} />
        <stop offset="100%" stopColor="#000" stopOpacity={0} />
      </radialGradient>
      {/* 투명 플라스틱: 가장자리만 살짝 보인다 */}
      <linearGradient id="bt-plastic" x1="0" x2="1">
        <stop offset="0%" stopColor="#fff" stopOpacity={0.45} />
        <stop offset="25%" stopColor="#fff" stopOpacity={0.08} />
        <stop offset="80%" stopColor="#fff" stopOpacity={0.05} />
        <stop offset="100%" stopColor="#fff" stopOpacity={0.35} />
      </linearGradient>
      <linearGradient id="bt-tea" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#a86b3c" />
        <stop offset="100%" stopColor="#6e3f1d" />
      </linearGradient>
      <linearGradient id="bt-milk" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#fbf4e6" />
        <stop offset="70%" stopColor="#fbf4e6" stopOpacity={0.8} />
        <stop offset="100%" stopColor="#fbf4e6" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="bt-milk-tea" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stopColor="#e3bf94" />
        <stop offset="100%" stopColor="#c08d5c" />
      </linearGradient>
      <radialGradient id="bt-pearl" cx="35%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#6b4a3a" />
        <stop offset="100%" stopColor="#1c110b" />
      </radialGradient>
    </defs>
  );
}
