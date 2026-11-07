// 버블티 흔들기 규칙. React 없이 테스트할 수 있는 순수 함수로 둔다(서버 재판정에서도 그대로 쓴다).
//
// 흔드는 세기(intensity, m/s² 단위)를 시간에 따라 쌓아 섞인 정도를 잰다.
// 1초마다 적정 세기를 지켰는지 세고, 너무 세게 흔들면 넘친다(감점).
// 수치는 플랜에 없어 정한 임시 값이다. 실기기 플레이테스트 후 조정한다.
// 2026-11-07 리뷰 반영: 넘침을 샘플 하나가 아니라 부드럽게 만든 세기(포락선)로 판정해
// 센서 빈도와 관계없이 같은 손동작이면 같은 결과가 나오게 했다.

export const DURATION_MS = 10_000;

/** 지구 중력(m/s²). 중력을 분리하지 못하는 기기에서만 쓴다 */
const GRAVITY = 9.81;
/** 이보다 약한 움직임은 손떨림·센서 잡음으로 보고 섞기로 치지 않는다 */
export const NOISE_FLOOR = 1.5;
/** 세기 상한. 기기마다 센서 범위가 달라, 상한을 둬야 센서가 큰 기기가 유리해지지 않는다 */
export const MAX_INTENSITY = 30;

/**
 * 경고·넘침은 세기를 이 시간 상수(ms)로 부드럽게 만든 값(포락선)으로 판정한다.
 * 흔들기는 왕복할 때마다 세기가 0과 최고점을 오가므로 샘플 하나로 판정하면
 * 흔들 때마다 넘치고, 센서 빈도가 높은 기기일수록 더 자주 넘쳤다.
 */
const ENVELOPE_TAU_MS = 300;
/** 포락선이 이 값 이상이면 "살살!" 경고 */
export const WARNING_ENVELOPE = 16;
/** 포락선이 이 값 이상이면 넘친다 */
export const SPILL_ENVELOPE = 20;
/** 넘친 뒤 이 시간(ms) 동안은 다시 넘친 것으로 세지 않는다. 10초에 최대 10번 */
const SPILL_COOLDOWN_MS = 1_000;
/**
 * 샘플 사이 간격은 이만큼까지만 인정한다. 이벤트가 끊겼다 이어져도(탭 전환, 손을 뗐다 다시 댐)
 * 그 사이를 흔든 것으로 치지 않는다.
 */
const MAX_SAMPLE_GAP_MS = 250;
/** 100% 섞이는 데 필요한 흔들기 양(세기 × 초). 평균 세기 12로 8초 흔들면 다 섞인다 */
export const MIX_TARGET = 96;

/** 1초 구간 수 */
export const SECONDS = DURATION_MS / 1_000;
/** 1초에 쌓기를 기대하는 흔들기 양. 8초면 다 섞이는 속도 */
export const STEADY_TARGET = MIX_TARGET / 8;
/** 1초 구간이 "적정"으로 인정되는 범위(목표의 배수). 첫 1초는 반응 시간을 감안해 더 낮게 인정한다 */
const STEADY_MIN_RATIO = 0.75;
const FIRST_SECOND_MIN_RATIO = 0.6;
const STEADY_MAX_RATIO = 1.5;

/** 점수 구성: 섞임 100 + 적정 세기 1초당 3(최대 30) + 넘치지 않음 20, 넘칠 때마다 −10 */
const MIX_POINTS = 100;
const STEADY_POINTS_PER_SECOND = 3;
const NO_SPILL_POINTS = 20;
export const SPILL_PENALTY = 10;
/** 이론상 최고 점수. Supabase games.max_score와 같아야 한다 */
export const MAX_SCORE = MIX_POINTS + STEADY_POINTS_PER_SECOND * SECONDS + NO_SPILL_POINTS;

/**
 * 문지르기 속도(플레이 영역 폭/초)를 세기로 바꾸는 배율.
 * 픽셀 대신 폭 기준이라 360px 폰과 넓은 데스크톱에서 같은 동작이 같은 세기가 된다.
 * 영역 폭의 절반을 초당 3번 왕복(폭 3개/초)하면 목표 세기 12가 된다.
 */
const POINTER_WIDTHS_PER_SECOND_TO_INTENSITY = 4;

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
  /** 1초 구간마다 쌓인 흔들기 양 */
  buckets: number[];
  /** 부드럽게 만든 세기. 경고·넘침 판정과 화면 표시가 같은 값을 쓴다 */
  envelope: number;
  /** 넘친 시각들(ms) */
  spillTimesMs: number[];
  /** 마지막으로 반영한 샘플 시각. 아직 없으면 null */
  lastAtMs: number | null;
}

export function startShake(): ShakeState {
  return {
    mix: 0,
    buckets: Array.from({ length: SECONDS }, () => 0),
    envelope: 0,
    spillTimesMs: [],
    lastAtMs: null,
  };
}

type Vector = { x: number; y: number; z: number };

/**
 * 센서 값에서 흔드는 세기. 중력을 뺀 가속도의 크기를 쓴다(흔드는 방향과 관계없이 같은 값).
 * 중력을 분리하지 못하는 기기는 |중력 포함 가속도| − 중력으로 대신한다(좌우로 흔들면 작게 나온다).
 */
export function intensityFromMotion({
  acceleration,
  linearAcceleration,
}: {
  acceleration: Vector;
  linearAcceleration: Vector | null;
}): number {
  const raw = linearAcceleration
    ? Math.hypot(linearAcceleration.x, linearAcceleration.y, linearAcceleration.z)
    : Math.abs(Math.hypot(acceleration.x, acceleration.y, acceleration.z) - GRAVITY);
  return Math.min(raw, MAX_INTENSITY);
}

/**
 * 문지르기·키보드로 컵을 움직인 양에서 흔드는 세기.
 * @param distanceRatio 움직인 거리 ÷ 플레이 영역 폭
 */
export function intensityFromPointer({
  distanceRatio,
  durationMs,
}: {
  distanceRatio: number;
  durationMs: number;
}): number {
  if (durationMs <= 0) return 0;
  const widthsPerSecond = (distanceRatio / durationMs) * 1_000;
  return Math.min(widthsPerSecond * POINTER_WIDTHS_PER_SECOND_TO_INTENSITY, MAX_INTENSITY);
}

/** 플레이 시간 밖이거나, 이미 반영한 샘플보다 시각이 같거나 이른 샘플(반복 제출)인지 */
function isOutOfOrder(state: ShakeState, atMs: number): boolean {
  if (atMs < 0 || atMs >= DURATION_MS) return true;
  return state.lastAtMs !== null && atMs <= state.lastAtMs;
}

/** 포락선이 넘침 기준을 넘었고, 직전 넘침에서 쿨다운이 지났으면 새로 넘친다 */
function startsSpill(state: ShakeState, { envelope, atMs }: { envelope: number; atMs: number }) {
  const lastSpill = state.spillTimesMs.at(-1);
  const isCooledDown = lastSpill === undefined || atMs - lastSpill >= SPILL_COOLDOWN_MS;
  return envelope >= SPILL_ENVELOPE && isCooledDown;
}

/** 샘플 하나를 반영한 새 상태. 플레이 시간 밖이거나 시간이 거꾸로 가는 샘플은 무시한다 */
export function applyShake(state: ShakeState, sample: ShakeSample): ShakeState {
  const { atMs } = sample;
  if (isOutOfOrder(state, atMs)) return state;

  const intensity = Math.min(Math.max(sample.intensity, 0), MAX_INTENSITY);
  const gapMs = state.lastAtMs === null ? 0 : Math.min(atMs - state.lastAtMs, MAX_SAMPLE_GAP_MS);
  const amount = intensity < NOISE_FLOOR ? 0 : (intensity * gapMs) / 1_000;
  // 샘플 간격만큼 시간이 흐른 비율로 따라가므로 센서 빈도가 달라도 같은 곡선이 된다
  const follow = 1 - Math.exp(-gapMs / ENVELOPE_TAU_MS);
  const envelope = state.envelope + (intensity - state.envelope) * follow;
  const second = Math.floor(atMs / 1_000);

  return {
    mix: state.mix + amount,
    buckets: state.buckets.map((value, i) => (i === second ? value + amount : value)),
    envelope,
    spillTimesMs: startsSpill(state, { envelope, atMs })
      ? [...state.spillTimesMs, atMs]
      : state.spillTimesMs,
    lastAtMs: atMs,
  };
}

/**
 * atMs 시각의 포락선. 마지막 샘플 뒤로 입력이 없으면(손을 멈춤) 세기 0이 이어진 것처럼 줄어든다.
 * 화면의 세기 게이지와 경고가 쓴다.
 */
export function envelopeAt(state: ShakeState, atMs: number): number {
  if (state.lastAtMs === null) return 0;
  const idleMs = Math.max(atMs - state.lastAtMs, 0);
  return state.envelope * Math.exp(-idleMs / ENVELOPE_TAU_MS);
}

/** 섞인 정도(0~1) */
export function mixRatio(state: ShakeState): number {
  return Math.min(state.mix / MIX_TARGET, 1);
}

/** 1초 구간 평가. 화면의 점 10개와 결과 그래프가 같은 기준을 쓴다 */
export type SecondRating = 'steady' | 'weak' | 'strong' | 'spill';

/** second 번째 1초 구간의 평가. 그 1초 안에 넘쳤으면 'spill' */
export function rateSecond(state: ShakeState, second: number): SecondRating {
  if (state.spillTimesMs.some((atMs) => Math.floor(atMs / 1_000) === second)) return 'spill';
  const amount = state.buckets[second] ?? 0;
  const minRatio = second === 0 ? FIRST_SECOND_MIN_RATIO : STEADY_MIN_RATIO;
  if (amount < STEADY_TARGET * minRatio) return 'weak';
  if (amount > STEADY_TARGET * STEADY_MAX_RATIO) return 'strong';
  return 'steady';
}

export interface ShakeResult {
  score: number;
  /** 섞인 정도(0~100) */
  mixPercent: number;
  /** 적정 세기를 지킨 1초 구간 수(0~10) */
  steadySeconds: number;
  spills: number;
  /** 1초 구간별 평가(결과 그래프·다음 판 팁) */
  ratings: SecondRating[];
  /** 1초 구간별 흔들기 양 */
  buckets: number[];
}

/**
 * 최종 점수 = 섞임 + 적정 세기 보너스 + 넘치지 않음 보너스 − 넘침 감점 (0 아래로는 내려가지 않음).
 * 넘치지 않음 보너스는 다 섞었을 때만 준다(아예 흔들지 않아 보너스만 받지 못하게).
 */
export function finalResult(state: ShakeState): ShakeResult {
  const mixed = mixRatio(state);
  const ratings = Array.from({ length: SECONDS }, (_, second) => rateSecond(state, second));
  const steadySeconds = ratings.filter((rating) => rating === 'steady').length;
  const spills = state.spillTimesMs.length;
  const total =
    MIX_POINTS * mixed +
    STEADY_POINTS_PER_SECOND * steadySeconds +
    (mixed >= 1 && spills === 0 ? NO_SPILL_POINTS : 0) -
    SPILL_PENALTY * spills;
  return {
    score: Math.max(Math.round(total), 0),
    mixPercent: Math.floor(mixed * 100),
    steadySeconds,
    spills,
    ratings,
    buckets: [...state.buckets],
  };
}
