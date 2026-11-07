// 버블티 흔들기 규칙. React 없이 테스트할 수 있는 순수 함수로 둔다(서버 재판정에서도 그대로 쓴다).
//
// 흔드는 세기(intensity, m/s² 단위)를 시간에 따라 쌓아 섞인 정도를 잰다.
// 너무 세게 흔들면 넘치고(감점), 10초 내내 고르게 흔들수록 보너스를 받는다.
// 수치는 플랜에 없어 정한 임시 값이다. 실기기 플레이테스트 후 조정한다.

export const DURATION_MS = 10_000;

/** 지구 중력(m/s²). 가만히 들고 있으면 중력 포함 가속도의 크기가 이 값이다 */
const GRAVITY = 9.81;
/** 이보다 약한 움직임은 손떨림·센서 잡음으로 보고 섞기로 치지 않는다 */
export const NOISE_FLOOR = 1.5;
/** 세기 상한. 기기마다 센서 범위가 달라, 상한을 둬야 센서가 큰 기기가 유리해지지 않는다 */
export const MAX_INTENSITY = 30;
/** 이 세기부터 "살살!" 경고를 보여준다 */
export const WARNING_INTENSITY = 20;
/** 이 세기 이상이면 넘친다 */
export const SPILL_INTENSITY = 25;
/** 넘친 뒤 이 세기 아래로 내려와야 다음 넘침을 센다. 한 번 세게 흔든 것이 여러 번 넘친 것으로 세지지 않게 한다 */
const CALM_INTENSITY = 18;
/**
 * 샘플 사이 간격은 이만큼까지만 인정한다. 이벤트가 끊겼다 이어져도(탭 전환, 손을 뗐다 다시 댐)
 * 그 사이를 흔든 것으로 치지 않는다. 키보드로 번갈아 누르는 간격(약 0.2초)은 들어오게 잡았다.
 */
const MAX_SAMPLE_GAP_MS = 250;
/** 100% 섞이는 데 필요한 흔들기 양(세기 × 초). 평균 세기 12로 8초 흔들면 다 섞인다 */
export const MIX_TARGET = 96;

/** 고르게 흔들었는지 볼 때 나누는 구간 길이 */
const BUCKET_MS = 1_000;
const BUCKET_COUNT = DURATION_MS / BUCKET_MS;

/** 점수 구성: 섞인 정도 100 + 고르기 보너스 30 + 넘치지 않음 보너스 20, 넘칠 때마다 −10 */
const MIX_POINTS = 100;
const EVENNESS_POINTS = 30;
const NO_SPILL_POINTS = 20;
const SPILL_PENALTY = 10;
/** 이론상 최고 점수. Supabase games.max_score와 같아야 한다 */
export const MAX_SCORE = MIX_POINTS + EVENNESS_POINTS + NO_SPILL_POINTS;

/** 마우스·손가락 속도(px/ms)를 세기로 바꾸는 배율. 2px/ms(힘차게 문지르기)가 평균 목표 세기 12가 된다 */
const POINTER_SPEED_TO_INTENSITY = 6;

/** 흔들기 한 번의 기록 */
export interface ShakeSample {
  /** 플레이 시작부터의 시각(ms) */
  atMs: number;
  /** 흔드는 세기(m/s² 기준) */
  intensity: number;
}

export interface ShakeState {
  /** 쌓인 흔들기 양(세기 × 초) */
  mix: number;
  /** 1초 구간마다 쌓인 흔들기 양. 고르게 흔들었는지 볼 때 쓴다 */
  buckets: number[];
  spills: number;
  /** 지금 넘치는 중인지(세기가 CALM_INTENSITY 아래로 내려오기 전) */
  isSpilling: boolean;
  /** 마지막으로 반영한 샘플 시각. 아직 없으면 null */
  lastAtMs: number | null;
}

export function startShake(): ShakeState {
  return {
    mix: 0,
    buckets: Array.from({ length: BUCKET_COUNT }, () => 0),
    spills: 0,
    isSpilling: false,
    lastAtMs: null,
  };
}

/** 중력 포함 가속도(m/s²)에서 흔드는 세기. 가만히 있으면 0, 상한은 MAX_INTENSITY */
export function intensityFromAcceleration({ x, y, z }: { x: number; y: number; z: number }) {
  return Math.min(Math.abs(Math.hypot(x, y, z) - GRAVITY), MAX_INTENSITY);
}

/** 마우스·손가락·키보드로 컵을 움직인 거리와 시간에서 흔드는 세기 */
export function intensityFromPointer({
  distancePx,
  durationMs,
}: {
  distancePx: number;
  durationMs: number;
}): number {
  if (durationMs <= 0) return 0;
  return Math.min((distancePx / durationMs) * POINTER_SPEED_TO_INTENSITY, MAX_INTENSITY);
}

/** 플레이 시간 밖이거나, 이미 반영한 샘플보다 시각이 같거나 이른 샘플(반복 제출)인지 */
function isOutOfOrder(state: ShakeState, atMs: number): boolean {
  if (atMs < 0 || atMs >= DURATION_MS) return true;
  return state.lastAtMs !== null && atMs <= state.lastAtMs;
}

/** 이 세기로 넘침이 새로 시작되는지와 넘치는 중인지 */
function spillAfter(state: ShakeState, intensity: number) {
  const startsSpill = intensity >= SPILL_INTENSITY && !state.isSpilling;
  const isSpilling = startsSpill || (state.isSpilling && intensity >= CALM_INTENSITY);
  return { startsSpill, isSpilling };
}

/** 샘플 하나를 반영한 새 상태. 플레이 시간 밖이거나 시간이 거꾸로 가는 샘플은 무시한다 */
export function applyShake(state: ShakeState, sample: ShakeSample): ShakeState {
  const { atMs } = sample;
  if (isOutOfOrder(state, atMs)) return state;

  const intensity = Math.min(Math.max(sample.intensity, 0), MAX_INTENSITY);
  const gapMs = state.lastAtMs === null ? 0 : Math.min(atMs - state.lastAtMs, MAX_SAMPLE_GAP_MS);
  const amount = intensity < NOISE_FLOOR ? 0 : (intensity * gapMs) / 1_000;
  const bucket = Math.floor(atMs / BUCKET_MS);
  const { startsSpill, isSpilling } = spillAfter(state, intensity);

  return {
    mix: state.mix + amount,
    buckets: state.buckets.map((value, i) => (i === bucket ? value + amount : value)),
    spills: state.spills + (startsSpill ? 1 : 0),
    isSpilling,
    lastAtMs: atMs,
  };
}

/** 섞인 정도(0~1) */
export function mixRatio(state: ShakeState): number {
  return Math.min(state.mix / MIX_TARGET, 1);
}

/** 1초 구간들에 흔들기 양이 얼마나 고르게 퍼졌는지(0~1). 변동계수(표준편차 ÷ 평균)가 0이면 1 */
export function evennessOf(state: ShakeState): number {
  const mean = state.buckets.reduce((sum, value) => sum + value, 0) / state.buckets.length;
  if (mean === 0) return 0;
  const variance =
    state.buckets.reduce((sum, value) => sum + (value - mean) ** 2, 0) / state.buckets.length;
  return Math.min(Math.max(1 - Math.sqrt(variance) / mean, 0), 1);
}

export interface ShakeResult {
  score: number;
  /** 섞인 정도(0~100) */
  mixPercent: number;
  /** 고르기(0~100) */
  evennessPercent: number;
  spills: number;
}

/**
 * 최종 점수 = 섞인 정도 + 고르기 보너스 + 넘치지 않음 보너스 − 넘침 감점 (0 아래로는 내려가지 않음).
 * 아주 살살 고르게 흔들거나 아예 흔들지 않아 보너스만 받지 못하도록,
 * 고르기 보너스는 섞인 정도만큼만 주고 넘치지 않음 보너스는 다 섞었을 때만 준다.
 */
export function finalResult(state: ShakeState): ShakeResult {
  const mixed = mixRatio(state);
  const evenness = evennessOf(state);
  const isFullyMixed = mixed >= 1;
  const total =
    MIX_POINTS * mixed +
    EVENNESS_POINTS * evenness * mixed +
    (isFullyMixed && state.spills === 0 ? NO_SPILL_POINTS : 0) -
    SPILL_PENALTY * state.spills;
  return {
    score: Math.max(Math.round(total), 0),
    mixPercent: Math.floor(mixed * 100),
    evennessPercent: Math.round(evenness * 100),
    spills: state.spills,
  };
}
