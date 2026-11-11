import type { MotionSample } from '../hooks/useDeviceMotion.ts';

// 원을 그리며 돌린 양(바퀴, 1 = 360°)을 입력마다 잰다. 양수 = 화면에서 볼 때 시계 방향.
// 짜장면 비비기에서 만들어 팽이 돌리기와 함께 쓰려고 엔진으로 옮겼다(2026-11-11).
// 마우스·터치(pointerTurns), 키보드 ↑→↓←(keyTurns), 폰 센서(motionTurns).

/**
 * 센서 측정 사이 간격은 이만큼까지만 인정한다. 이벤트가 끊겼다 이어져도(탭 전환)
 * 그 사이를 돌린 것으로 치지 않는다
 */
const MAX_SAMPLE_GAP_MS = 250;

/** 각도 차이를 −π~π로 맞춘다(한 바퀴를 넘어 도는 경계에서 튀지 않게) */
function wrapAngle(radians: number): number {
  return Math.atan2(Math.sin(radians), Math.cos(radians));
}

/**
 * 연속한 두 측정 사이 각도가 이보다 크게 바뀌면 원을 그린 것이 아니라고 본다.
 * 앞뒤로 흔들면 방향이 반 바퀴씩 뒤집히는데, 이를 회전으로 세지 않게 한다
 */
const MAX_ANGLE_STEP = Math.PI / 2;

type Point = { x: number; y: number };

/**
 * 마우스·터치로 그릇 위에 원을 그릴 때 두 위치 사이에 돈 바퀴 수.
 * 좌표는 그릇 가운데 기준이고 화면 좌표처럼 아래가 +y다(그래서 각도가 늘면 시계 방향).
 * 가운데에 너무 가까우면 작은 손떨림에도 각도가 크게 바뀌므로 세지 않는다
 */
export function pointerTurns(previous: Point, current: Point, minRadius: number): number {
  if (Math.hypot(previous.x, previous.y) < minRadius) return 0;
  if (Math.hypot(current.x, current.y) < minRadius) return 0;
  const delta = wrapAngle(Math.atan2(current.y, current.x) - Math.atan2(previous.y, previous.x));
  return Math.abs(delta) > MAX_ANGLE_STEP ? 0 : delta / (2 * Math.PI);
}

/** 키보드로 돌릴 때 시계 방향 순서. 다음 키를 누르면 1/4바퀴 */
const KEY_CYCLE = ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'] as const;
export const ROTATE_KEYS: ReadonlySet<string> = new Set(KEY_CYCLE);

/** 앞서 누른 키에서 이번 키로 돈 바퀴 수. 시계 방향 다음 키면 +1/4, 반대면 −1/4, 그 외 0 */
export function keyTurns(previousKey: string | null, key: string): number {
  const from = KEY_CYCLE.indexOf(previousKey as (typeof KEY_CYCLE)[number]);
  const to = KEY_CYCLE.indexOf(key as (typeof KEY_CYCLE)[number]);
  if (from < 0 || to < 0) return 0;
  const step = (to - from + KEY_CYCLE.length) % KEY_CYCLE.length;
  if (step === 1) return 0.25;
  if (step === KEY_CYCLE.length - 1) return -0.25;
  return 0; // 같은 키, 맞은편 키는 어느 방향인지 알 수 없다
}

/**
 * 폰을 원 그리며 돌릴 때: 화면 평면의 가속도가 이보다 작으면 방향을 믿을 수 없어 쓰지 않는다(m/s²).
 * 지름 10cm 원을 초당 1.5바퀴 그리면 약 4.4
 */
const CIRCLE_MIN_ACCELERATION = 2;
/** 폰을 손목으로 돌릴 때: 이보다 느린 회전(도/초)은 손떨림으로 본다 */
const SPIN_MIN_DEGREES_PER_SECOND = 30;

type Vector = { x: number; y: number; z: number };

/** 센서 측정 하나 */
export interface MotionReading {
  /** 측정 시각(ms) */
  atMs: number;
  /** 중력을 뺀 가속도(m/s²). 자이로가 없는 기기는 null */
  linearAcceleration: Vector | null;
  /** 화면에 수직인 축 둘레 회전 속도(도/초, 화면에서 볼 때 반시계가 양수). 없으면 null */
  spinRate: number | null;
}

/** 폰 회전량을 재려고 기억해 두는 직전 측정 */
export interface MotionTracker {
  lastAtMs: number | null;
  /** 직전 측정의 화면 평면 가속도 방향(라디안). 너무 약했으면 null */
  lastAngle: number | null;
}

/** 엔진 센서 샘플(useDeviceMotion)을 회전 측정값으로 바꾼다 */
export function motionReadingOf(sample: MotionSample): MotionReading {
  return {
    atMs: sample.timestamp,
    linearAcceleration: sample.linearAcceleration,
    spinRate: sample.rotationRate?.alpha ?? null,
  };
}

export function startMotionTracker(): MotionTracker {
  return { lastAtMs: null, lastAngle: null };
}

/**
 * 센서 측정 하나에서 직전 측정 뒤로 돈 바퀴 수(양수 = 시계 방향).
 * 두 가지로 재서 더 큰 쪽을 쓴다(플랜: "두 센서 중 더 큰 입력값 채택").
 * - 원 그리기: 폰을 원을 그리며 움직이면 가속도가 원의 가운데를 향한 채 함께 돈다. 그 방향이 돈 각도
 * - 손목 돌리기: 자이로의 화면 수직축 회전 속도 × 시간
 */
export function motionTurns(
  tracker: MotionTracker,
  reading: MotionReading,
): { tracker: MotionTracker; turns: number } {
  const gapMs =
    tracker.lastAtMs === null
      ? 0
      : Math.min(Math.max(reading.atMs - tracker.lastAtMs, 0), MAX_SAMPLE_GAP_MS);

  let spinTurns = 0;
  const rate = reading.spinRate;
  if (rate !== null && Math.abs(rate) >= SPIN_MIN_DEGREES_PER_SECOND) {
    // 자이로는 반시계가 양수라 부호를 뒤집는다
    spinTurns = (-rate / 360) * (gapMs / 1_000);
  }

  let circleTurns = 0;
  let angle: number | null = null;
  const linear = reading.linearAcceleration;
  if (linear && Math.hypot(linear.x, linear.y) >= CIRCLE_MIN_ACCELERATION) {
    angle = Math.atan2(linear.y, linear.x);
    if (tracker.lastAngle !== null) {
      const delta = wrapAngle(angle - tracker.lastAngle);
      // 기기 좌표는 위가 +y라 각도가 줄면 시계 방향이다
      if (Math.abs(delta) <= MAX_ANGLE_STEP) circleTurns = -delta / (2 * Math.PI);
    }
  }

  return {
    tracker: { lastAtMs: reading.atMs, lastAngle: angle },
    turns: Math.abs(circleTurns) >= Math.abs(spinTurns) ? circleTurns : spinTurns,
  };
}
