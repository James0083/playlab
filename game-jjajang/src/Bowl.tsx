import type { RefObject } from 'react';
import { ClumpPill, createHudElements, HudTop, type HudElements } from './Hud.tsx';
import { SWITCH_POINTS } from './rules.ts';

// 위에서 내려다본 짜장면 그릇(SVG). 좌표는 viewBox(240×240) 기준이고 가운데가 (120, 120)이다.
// 돌리는 동안 바뀌는 값(면 회전, 소스 배어듦, 뭉침, 젓가락)은 drawBowl이 매 프레임 직접 갱신한다.

/** 매 프레임 직접 갱신하는 요소. React 상태로 다루면 입력마다(초당 60번) 다시 렌더링한다 */
export interface BowlElements extends HudElements {
  noodles: SVGGElement | null;
  sauceCoat: SVGGElement | null;
  sauce: SVGGElement | null;
  chopsticks: SVGGElement | null;
}

export function createBowlElements(): BowlElements {
  return { ...createHudElements(), noodles: null, sauceCoat: null, sauce: null, chopsticks: null };
}

export interface BowlFrame {
  /** 지금까지 돌린 각도(바퀴, 시계 방향이 양수). 면과 젓가락이 이만큼 돈다 */
  angleTurns: number;
  /** 비빈 정도(0~1) */
  mix: number;
  /** 지금 구간의 비벼지는 비율(1 = 잘 비벼짐, 0.25 = 많이 뭉침) */
  efficiency: number;
  /** 움직임 배율. 동작 줄이기 설정이면 0으로 넘겨 면을 돌리지 않는다(젓가락은 돈다) */
  motionScale: number;
}

const CENTER = 120;
/** 면은 젓가락보다 덜 돈다(젓가락이 면 사이를 지나가며 끌고 간다) */
const NOODLE_DRAG = 0.35;
/** 가장 많이 뭉쳤을 때 면이 오그라드는 비율 */
const MAX_CLUMP_SHRINK = 0.18;

/** 한 프레임을 그린다: 면 회전·뭉침, 소스 배어듦, 젓가락. 게이지는 drawHud가 그린다 */
export function drawBowl(
  elements: BowlElements,
  { angleTurns, mix, efficiency, motionScale }: BowlFrame,
): void {
  const degrees = angleTurns * 360;
  const shrink = 1 - MAX_CLUMP_SHRINK * ((1 - efficiency) / 0.75);
  elements.noodles?.setAttribute(
    'transform',
    `rotate(${degrees * NOODLE_DRAG * motionScale} ${CENTER} ${CENTER}) ` +
      `translate(${CENTER} ${CENTER}) scale(${shrink}) translate(${-CENTER} ${-CENTER})`,
  );
  elements.sauceCoat?.setAttribute('opacity', String(mix));
  // 가운데 소스 덩어리는 비빌수록 퍼지며 옅어진다
  const spread = 1 + mix * 0.6;
  elements.sauce?.setAttribute('opacity', String(Math.max(1 - mix * 1.15, 0)));
  elements.sauce?.setAttribute(
    'transform',
    `translate(${CENTER} ${CENTER}) scale(${spread}) translate(${-CENTER} ${-CENTER})`,
  );
  elements.chopsticks?.setAttribute('transform', `rotate(${degrees} ${CENTER} ${CENTER})`);
}

/**
 * 면 가닥: 가운데를 도는 호. [반지름, 시작 각도(도), 길이(도)]
 * 반지름과 시작 각도를 고르게 흩어 어느 방향으로 돌아도 면이 도는 것이 보이게 한다
 */
const STRANDS: readonly [number, number, number][] = [
  [26, 10, 200],
  [32, 190, 160],
  [38, 80, 220],
  [44, 260, 170],
  [50, 140, 210],
  [56, 330, 180],
  [62, 40, 230],
  [68, 220, 190],
  [74, 110, 200],
  [80, 290, 170],
  [86, 170, 220],
  [47, 20, 120],
  [65, 300, 130],
  [83, 60, 140],
];

/** 가운데를 돌며 조금씩 출렁이는 면 한 가닥(경로) */
function strandPath([radius, startDegrees, lengthDegrees]: readonly [number, number, number]) {
  const steps = 12;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const angle = ((startDegrees + (lengthDegrees * i) / steps) * Math.PI) / 180;
    // 면이 곧은 원이 아니라 살짝 구불구불하게
    const wobble = radius + Math.sin(i * 1.7 + radius) * 3;
    return `${(CENTER + wobble * Math.cos(angle)).toFixed(1)} ${(CENTER + wobble * Math.sin(angle)).toFixed(1)}`;
  });
  return `M${points.join(' L')}`;
}
const STRAND_PATHS = STRANDS.map(strandPath);

/** 짜장 소스 위 건더기(양파·고기): [x, y, 크기] */
const CHUNKS: readonly [number, number, number][] = [
  [108, 110, 7],
  [130, 104, 6],
  [124, 128, 8],
  [104, 132, 5],
  [140, 122, 5],
  [116, 96, 5],
];

/** 오이채: [x, y, 각도] */
const CUCUMBERS: readonly [number, number, number][] = [
  [112, 84, -20],
  [122, 82, 10],
  [132, 86, 35],
];

interface BowlProps {
  elementsRef: RefObject<BowlElements>;
  /** 보너스를 받은 방향 바꾸기 횟수. 늘 때마다 그릇 위에 "+5"를 띄운다 */
  bonusSwitches: number;
  /** 끝나는 연출 중이면 true: 젓가락으로 면을 들어 올린다 */
  isFinished: boolean;
}

export function Bowl({ elementsRef, bonusSwitches, isFinished }: BowlProps) {
  return (
    <span className="jj-bowl-wrap">
      <HudTop elementsRef={elementsRef} />
      <svg className="jj-bowl" viewBox="0 0 240 240" aria-hidden="true">
        <BowlDefinitions />
        <circle cx={CENTER + 4} cy={CENTER + 8} r={112} fill="url(#jj-shadow)" />
        <g className={isFinished ? 'jj-dish jj-dish-done' : 'jj-dish'}>
          <circle cx={CENTER} cy={CENTER} r={110} fill="url(#jj-ceramic)" stroke="#c9ccd1" />
          <circle cx={CENTER} cy={CENTER} r={98} fill="none" stroke="#3d6fb6" strokeWidth={3} />
          <circle cx={CENTER} cy={CENTER} r={93} fill="#efe3c8" />
          <g clipPath="url(#jj-inside)">
            <g
              ref={(node) => {
                elementsRef.current.noodles = node;
              }}
            >
              <circle cx={CENTER} cy={CENTER} r={90} fill="#f1d58e" />
              <g fill="none" strokeLinecap="round">
                {STRAND_PATHS.map((d, i) => (
                  <path key={i} d={d} stroke="#d9b45f" strokeWidth={8} />
                ))}
                {STRAND_PATHS.map((d, i) => (
                  <path key={i} d={d} stroke="#f8e3a6" strokeWidth={5} />
                ))}
              </g>
              {/* 소스가 밴 면. 비빈 정도만큼 진해진다 */}
              <g
                ref={(node) => {
                  elementsRef.current.sauceCoat = node;
                }}
                opacity={0}
              >
                <circle cx={CENTER} cy={CENTER} r={90} fill="#4a2b14" />
                <g fill="none" strokeLinecap="round">
                  {STRAND_PATHS.map((d, i) => (
                    <path key={i} d={d} stroke="#6b4021" strokeWidth={5} />
                  ))}
                </g>
              </g>
              {/* 가운데 소스 덩어리와 오이채. 면과 함께 돌고, 비빌수록 퍼지며 사라진다 */}
              <g
                ref={(node) => {
                  elementsRef.current.sauce = node;
                }}
              >
                <path
                  d="M120 78 C150 78 164 98 160 122 C156 148 134 160 114 156 C90 152 78 134 82 112 C86 90 98 78 120 78 Z"
                  fill="url(#jj-sauce)"
                />
                {CHUNKS.map(([x, y, size], i) => (
                  <rect
                    key={i}
                    x={x - size / 2}
                    y={y - size / 2}
                    width={size}
                    height={size}
                    rx={2}
                    fill={i % 2 === 0 ? '#2c170a' : '#c9a36a'}
                    opacity={0.85}
                  />
                ))}
                {CUCUMBERS.map(([x, y, angle], i) => (
                  <rect
                    key={i}
                    x={x - 2}
                    y={y - 14}
                    width={4}
                    height={28}
                    rx={2}
                    fill="#7cb342"
                    transform={`rotate(${angle} ${x} ${y})`}
                  />
                ))}
              </g>
            </g>
          </g>
          <g
            ref={(node) => {
              elementsRef.current.chopsticks = node;
            }}
          >
            <Chopsticks isLifting={isFinished} />
          </g>
        </g>
        {bonusSwitches > 0 && (
          // key가 바뀌면 다시 그려져 애니메이션이 처음부터 돈다
          <text key={bonusSwitches} className="jj-bonus" x={CENTER} y={34} textAnchor="middle">
            +{SWITCH_POINTS}
          </text>
        )}
      </svg>
      <ClumpPill elementsRef={elementsRef} />
    </span>
  );
}

/** 젓가락 한 벌: 끝이 그릇 안(가운데에서 50 떨어진 곳)에 있고 바깥으로 뻗는다 */
function Chopsticks({ isLifting }: { isLifting: boolean }) {
  return (
    <g className={isLifting ? 'jj-chopsticks jj-chopsticks-lift' : 'jj-chopsticks'}>
      {/* 끝나는 연출: 젓가락에 들린 면 */}
      {isLifting && (
        <g fill="none" stroke="#6b4021" strokeWidth={4} strokeLinecap="round">
          <path d="M170 116 C176 140 166 150 172 170" />
          <path d="M174 118 C182 138 172 154 180 172" />
          <path d="M178 116 C186 134 180 150 186 166" />
        </g>
      )}
      <rect
        x={168}
        y={108}
        width={84}
        height={5}
        rx={2.5}
        fill="#b07a45"
        transform="rotate(-4 168 110)"
      />
      <rect
        x={168}
        y={120}
        width={84}
        height={5}
        rx={2.5}
        fill="#9a6a3a"
        transform="rotate(4 168 122)"
      />
    </g>
  );
}

function BowlDefinitions() {
  return (
    <defs>
      <clipPath id="jj-inside">
        <circle cx={CENTER} cy={CENTER} r={92} />
      </clipPath>
      <radialGradient id="jj-shadow">
        <stop offset="80%" stopColor="#000" stopOpacity={0.25} />
        <stop offset="100%" stopColor="#000" stopOpacity={0} />
      </radialGradient>
      {/* 흰 사기 그릇: 빛은 왼쪽 위에서 온다 */}
      <radialGradient id="jj-ceramic" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#dfe3e8" />
      </radialGradient>
      <radialGradient id="jj-sauce" cx="40%" cy="35%" r="70%">
        <stop offset="0%" stopColor="#5a3418" />
        <stop offset="100%" stopColor="#2a1608" />
      </radialGradient>
    </defs>
  );
}
