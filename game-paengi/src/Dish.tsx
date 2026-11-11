import { Meter } from '@minigames/engine';
import type { RefObject } from 'react';
import { CENTER, DISH_RADIUS, POSITION_SCALE, VIEWBOX } from './geometry.ts';
import {
  MAX_RPM,
  rpmOf,
  SPIN_MS,
  wobbleOf,
  type BalanceState,
  type Direction,
  type SpinState,
} from './rules.ts';
import {
  createTopElements,
  drawTop,
  SpinningTop,
  TopDefinitions,
  type TopElements,
} from './Top.tsx';

// 바로 위에서 내려다본 둥근 나무 판과 팽이(SVG). 크기는 geometry.ts, 팽이 그림은 Top.tsx에 있다.
// 입체감은 판 테두리의 두께·빛 방향, 팽이의 기울기(세차운동)·그림자로 낸다.
// 매 프레임 바뀌는 값은 drawDish가 직접 갱신한다.

export interface DishElements extends TopElements {
  /** 팽이 전체를 판 위 위치로 옮기는 그룹 */
  top: SVGGElement | null;
  rpmFill: HTMLSpanElement | null;
  rpmText: HTMLSpanElement | null;
  timeText: HTMLSpanElement | null;
  edgeWarning: HTMLSpanElement | null;
}

export function createDishElements(): DishElements {
  return {
    ...createTopElements(),
    top: null,
    rpmFill: null,
    rpmText: null,
    timeText: null,
    edgeWarning: null,
  };
}

/**
 * 무늬가 도는 빠르기 배율. 실제 회전(최고 1,800 RPM = 초당 30바퀴)을 그대로 그리면 화면 주사율보다 빨라
 * 거꾸로 돌거나 멈춰 보인다. 눈에 보이는 빠르기로 줄이고, 빠를 때는 표식을 번진 띠로 덮는다
 */
const VISUAL_SPIN_SCALE = 0.08;
/** 이 회전 속도 아래부터 표식이 보이기 시작하고, BLUR_FULL_RPM 이상이면 완전히 번져 띠로만 보인다 */
const BLUR_START_RPM = 450;
const BLUR_FULL_RPM = 1_200;
/** 흔들림이 가장 셀 때 축이 기우는 각도(도)와 세차운동 빠르기(초당 바퀴) */
const MAX_LEAN_DEGREES = 24;
const PRECESSION_HZ = 1.1;
/** 쓰러졌을 때 눕는 각도(도)와 눕는 데 걸리는 시간(ms) */
const FALLEN_LEAN_DEGREES = 82;
export const FALL_ANIMATION_MS = 600;
/** 이 거리(위치)부터 가장자리 경고를 보여준다 */
const EDGE_WARNING_AT = 0.7;

/** 동작 줄이기 설정이면 세차운동(기울어짐)을 그리지 않는다. 위치·회전 게이지는 그대로 움직인다 */
export function readMotionScale(): number {
  const isReduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return isReduced ? 0 : 1;
}

export interface DishFrame {
  /** 판 위 위치(가운데 0, 가장자리 1) */
  position: { x: number; y: number };
  rpm: number;
  /** 무늬 각도(도). 게임이 회전 속도로 쌓아 넘긴다 */
  spinDegrees: number;
  /** 흔들림이 미는 방향(라디안). 세차운동의 기준 방향 */
  wobbleAngle: number;
  /** 애니메이션 시각(ms) */
  timeMs: number;
  /** 쓰러진 시각(ms). 쓰러지기 전에는 null */
  fallenAtMs: number | null;
  /** 움직임 배율(readMotionScale) */
  motionScale: number;
  /** 시간 표시(예: "돌리기 3.2초", "12.3초 버팀") */
  timeText: string;
  /** 균형 단계(가장자리 경고를 보여줄지) */
  isBalancing: boolean;
}

/** 무늬 각도를 회전 속도만큼 늘린다(그리기용). 시계 방향 회전 */
export function advanceSpin(degrees: number, { rpm, dtMs }: { rpm: number; dtMs: number }) {
  return (degrees + rpm * 6 * (dtMs / 1_000) * VISUAL_SPIN_SCALE) % 360;
}

/** 글자가 바뀐 경우에만 고친다(매 프레임 같은 글자를 다시 쓰지 않게) */
function setText(element: HTMLElement | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

/** 회전 게이지와 시간 */
function drawHud(elements: DishElements, { rpm, timeText }: DishFrame): void {
  if (elements.rpmFill) elements.rpmFill.style.transform = `scaleX(${Math.min(rpm / MAX_RPM, 1)})`;
  setText(elements.rpmText, String(Math.max(Math.round(rpm), 0)));
  setText(elements.timeText, timeText);
}

/** 단계별 시간 표시: 돌리기 남은 시간 / 자리 잡기 / 버틴 시간 */
export function timeTextOf(
  stage: Stage,
  { stageMs, survivedMs }: { stageMs: number; survivedMs: number },
) {
  if (stage === 'spin') return `돌리기 ${(Math.max(SPIN_MS - stageMs, 0) / 1_000).toFixed(1)}초`;
  if (stage === 'settle') return '준비!';
  return `${(survivedMs / 1_000).toFixed(1)}초 버팀`;
}

const CENTER_POSITION = { x: 0, y: 0 };

/** 지금 그릴 팽이 상태: 돌리기·자리 잡기에는 가운데에서 돌린 만큼, 균형·쓰러짐에는 균형 계산 결과 */
export function viewOf(
  stage: Stage,
  { balance, spin }: { balance: BalanceState | null; spin: SpinState },
) {
  const isBalancing = stage === 'balance' || stage === 'fallen';
  if (!isBalancing || !balance) {
    return { rpm: rpmOf(spin), position: CENTER_POSITION, wobbleAngle: 0 };
  }
  return { rpm: balance.rpm, position: balance.position, wobbleAngle: balance.wobbleAngle };
}

/** 회전 속도에 따라 표식이 번진 정도(0 = 또렷, 1 = 띠로만 보임) */
function blurOf(rpm: number): number {
  return Math.min(Math.max((rpm - BLUR_START_RPM) / (BLUR_FULL_RPM - BLUR_START_RPM), 0), 1);
}

/** 세차운동: 기운 방향은 회전과 같은 쪽으로 돌고, 느릴수록 크게 기운다 */
function precessionAt(frame: DishFrame, timeMs: number) {
  // 흔들림(쓰러지기 직전 1.5)에 비례해 기운다: 최고 회전 0.17 → 4°, 절반 0.33 → 8°, 직전 → 24°
  const strength = frame.rpm > 0 ? Math.min(wobbleOf(frame.rpm) / 1.5, 1) : 1;
  return {
    direction: frame.wobbleAngle + (timeMs / 1_000) * PRECESSION_HZ * Math.PI * 2,
    degrees: strength * MAX_LEAN_DEGREES * frame.motionScale,
  };
}

/** 지금 기울기. 쓰러지는 중이면 쓰러진 순간의 방향으로 점점 눕는다 */
function leanOf(frame: DishFrame): { leanDegrees: number; leanDirection: number } {
  if (frame.fallenAtMs === null) {
    const { direction, degrees } = precessionAt(frame, frame.timeMs);
    return { leanDegrees: degrees, leanDirection: direction };
  }
  const start = precessionAt(frame, frame.fallenAtMs);
  const progress = Math.min((frame.timeMs - frame.fallenAtMs) / FALL_ANIMATION_MS, 1);
  const eased = frame.motionScale === 0 ? 1 : 1 - (1 - progress) ** 3;
  return {
    leanDegrees: start.degrees + (FALLEN_LEAN_DEGREES - start.degrees) * eased,
    leanDirection: start.direction,
  };
}

export function drawDish(elements: DishElements, frame: DishFrame): void {
  const { position } = frame;
  const x = CENTER + position.x * POSITION_SCALE;
  const y = CENTER + position.y * POSITION_SCALE;
  elements.top?.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
  drawTop(elements, {
    ...leanOf(frame),
    spinDegrees: frame.spinDegrees,
    blur: frame.fallenAtMs === null ? blurOf(frame.rpm) : 0,
  });
  drawHud(elements, frame);
  const distance = Math.hypot(position.x, position.y);
  elements.edgeWarning?.classList.toggle(
    'pg-edge-visible',
    frame.isBalancing && distance >= EDGE_WARNING_AT,
  );
}

/** 지금 단계: 돌리기(원 그리기 안내) / 자리 잡기 / 균형 / 쓰러짐 */
export type Stage = 'spin' | 'settle' | 'balance' | 'fallen';

interface DishProps {
  elementsRef: RefObject<DishElements>;
  stage: Stage;
  /** 돌리기 방향이 정해졌으면 그 방향(점선 위 화살표) */
  direction: Direction | null;
}

export function Dish({ elementsRef, stage, direction }: DishProps) {
  return (
    <span className="pg-dish-wrap">
      <span className="pg-hud" aria-hidden="true">
        <Meter
          label="회전"
          defaultValue="0"
          unit="RPM"
          fillRef={(node) => {
            elementsRef.current.rpmFill = node;
          }}
          valueRef={(node) => {
            elementsRef.current.rpmText = node;
          }}
        />
        <span
          ref={(node) => {
            elementsRef.current.timeText = node;
          }}
          className="pg-time"
        />
      </span>
      <svg className="pg-dish" viewBox={VIEWBOX} aria-hidden="true">
        <TopDefinitions />
        <Board />
        {stage === 'spin' && <SpinGuide direction={direction} />}
        <g
          ref={(node) => {
            elementsRef.current.top = node;
          }}
          transform={`translate(${CENTER} ${CENTER})`}
        >
          <SpinningTop elementsRef={elementsRef} />
        </g>
      </svg>
      <span
        ref={(node) => {
          elementsRef.current.edgeWarning = node;
        }}
        className="pg-edge"
        aria-hidden="true"
      >
        가장자리예요! 반대로 기울여요
      </span>
    </span>
  );
}

/** 둥근 나무 판: 바닥 그림자, 두꺼운 테두리, 나뭇결, 가운데 표적. 빛은 왼쪽 위에서 온다 */
function Board() {
  const grain = [22, 40, 58, 76, 92];
  return (
    <g>
      <circle cx={CENTER + 4} cy={CENTER + 6} r={DISH_RADIUS + 8} fill="#000" opacity={0.14} />
      {/* 테두리(두께): 그라데이션으로 왼쪽 위가 밝고 오른쪽 아래가 어둡다 */}
      <circle cx={CENTER} cy={CENTER} r={DISH_RADIUS + 8} fill="url(#pg-rim)" />
      <circle cx={CENTER} cy={CENTER} r={DISH_RADIUS} fill="url(#pg-wood)" />
      <g fill="none" stroke="#8a5a2e" strokeOpacity={0.16}>
        {grain.map((r) => (
          <circle key={r} cx={CENTER + 3} cy={CENTER - 2} r={r} />
        ))}
      </g>
      {/* 윗면 안쪽 가장자리의 그늘(오목한 판)과 왼쪽 위 반사광 */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={DISH_RADIUS - 1.5}
        fill="none"
        stroke="#000"
        strokeOpacity={0.12}
        strokeWidth={3}
      />
      <path
        d={`M${CENTER - DISH_RADIUS * 0.72} ${CENTER - DISH_RADIUS * 0.66} A${DISH_RADIUS - 4} ${DISH_RADIUS - 4} 0 0 1 ${CENTER + DISH_RADIUS * 0.1} ${CENTER - DISH_RADIUS * 0.97}`}
        fill="none"
        stroke="#fff"
        strokeOpacity={0.35}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* 가운데 표적: 여기에 팽이를 두면 가장 오래 돈다 */}
      <circle cx={CENTER} cy={CENTER} r={28} fill="#6b4423" fillOpacity={0.1} />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={56}
        fill="none"
        stroke="#6b4423"
        strokeOpacity={0.28}
        strokeDasharray="4 6"
      />
    </g>
  );
}

/** 돌리기 단계: 팽이 둘레에 그릴 점선 원. 방향이 정해지면 아래쪽에 화살표로 보여준다 */
function SpinGuide({ direction }: { direction: Direction | null }) {
  const radius = 64;
  const bottom = CENTER + radius;
  // 시계 방향으로 돌면 아래쪽에서는 왼쪽으로 지나간다
  const arrow =
    direction === 1
      ? `M${CENTER + 6} ${bottom - 7} L${CENTER - 6} ${bottom} L${CENTER + 6} ${bottom + 7}`
      : `M${CENTER - 6} ${bottom - 7} L${CENTER + 6} ${bottom} L${CENTER - 6} ${bottom + 7}`;
  return (
    <g>
      <circle
        className="pg-guide"
        cx={CENTER}
        cy={CENTER}
        r={radius}
        fill="none"
        stroke="#fff"
        strokeWidth={3}
        strokeDasharray="6 8"
      />
      {direction !== null && (
        <path
          d={arrow}
          fill="none"
          stroke="#fff"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </g>
  );
}
