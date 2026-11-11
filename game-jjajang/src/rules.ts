// 짜장면 비비기 규칙. React 없이 테스트할 수 있는 순수 함수로 둔다(서버 재판정에서도 그대로 쓴다).
//
// 그릇을 원을 그리며 휘저은 양(바퀴)을 쌓아 비빈 정도를 잰다.
// 한 방향으로만 오래 돌리면 면이 뭉쳐 덜 비벼지고(뭉침), 1바퀴 이상 돌린 뒤 방향을 바꾸면 보너스를 준다.
// 그래서 "1~2바퀴 돌리고 반대로"가 가장 좋은 리듬이다.
// 각도는 바퀴(1 = 360°) 단위로 다룬다. 양수 = 화면에서 볼 때 시계 방향.
// 수치는 플랜에 없어 정한 임시 값이다. 실기기 플레이테스트 후 조정한다.

export const DURATION_MS = 10_000;

/** 1초에 이 바퀴 수까지만 인정한다. 이보다 빠른 입력(센서 튐, 매크로)은 이 속도로 깎는다 */
export const MAX_TURNS_PER_SECOND = 2.5;
/**
 * 입력 사이 간격은 이만큼까지만 인정한다. 입력이 끊겼다 이어져도(손을 뗐다 다시 댐, 탭 전환)
 * 그 사이를 돌린 것으로 치지 않는다
 */
const MAX_SAMPLE_GAP_MS = 250;
/**
 * 반대로 이만큼(바퀴) 움직여야 방향을 바꾼 것으로 본다. 원을 그리는 동안 손이 살짝 떨려
 * 거꾸로 가는 순간마다 방향이 바뀌지 않게 한다. 그보다 작은 역방향 움직임은 다시 앞으로 갈 때 상쇄한다
 */
const REVERSE_TURNS = 0.1;
/**
 * 한 방향으로 이만큼(바퀴) 이상 돌려야 비빈 것으로 친다(닿으면 처음부터 소급해 인정).
 * 제자리에서 앞뒤로 짧게 흔드는 것은 비비기가 아니다
 */
export const MIN_STROKE_TURNS = 0.25;
/** 직전 방향으로 이만큼(바퀴) 이상 돌린 뒤 바꿔야 "방향 바꾸기"로 인정한다 */
export const SWITCH_MIN_TURNS = 1;
/** 한 방향으로 이만큼(바퀴) 넘게 돌리면 면이 뭉치기 시작한다 */
export const CLUMP_FROM_TURNS = 2;
/** 이만큼 돌리면 뭉침이 가장 심해진다. 그 뒤로는 돌린 양의 CLUMP_MIN_EFFICIENCY만 비벼진다 */
const CLUMP_FULL_TURNS = 4;
const CLUMP_MIN_EFFICIENCY = 0.25;
/** 100% 비비는 데 필요한 바퀴 수(뭉침으로 깎인 뒤). 초당 1.5바퀴로 10초 */
export const MIX_TARGET_TURNS = 15;

/** 점수 구성: 비빔 100 + 방향 바꾸기 1번당 5(최대 6번) + 빨리 다 비빔(남은 0.2초당 1점) */
const MIX_POINTS = 100;
export const SWITCH_POINTS = 5;
export const MAX_BONUS_SWITCHES = 6;
const SPEED_BONUS_STEP_MS = 200;
/** 가장 빨리 다 비빌 수 있는 시각. 인정 속도 상한으로 쉬지 않고 돌린 경우 */
const FASTEST_MIX_MS = (MIX_TARGET_TURNS / MAX_TURNS_PER_SECOND) * 1_000;
const MAX_SPEED_BONUS = Math.floor((DURATION_MS - FASTEST_MIX_MS) / SPEED_BONUS_STEP_MS);
/** 이론상 최고 점수. Supabase games.max_score와 같아야 한다 */
export const MAX_SCORE = MIX_POINTS + SWITCH_POINTS * MAX_BONUS_SWITCHES + MAX_SPEED_BONUS;

/** 돌린 방향. 1 = 시계, -1 = 반시계 */
export type Direction = 1 | -1;

/** 한 방향으로 이어서 돌린 구간 */
export interface Stroke {
  direction: Direction;
  /** 이 방향으로 돌린 바퀴 수 */
  turns: number;
}

export interface StirState {
  /** 비빈 양(바퀴, 뭉침으로 깎인 뒤) */
  mix: number;
  /** 뭉쳐서 헛돈 바퀴 수(돌렸지만 비빔으로 치지 않은 양) */
  clumpedTurns: number;
  /** 지금 돌리는 구간. 아직 돌리지 않았으면 null */
  stroke: Stroke | null;
  /** 지금 방향과 반대로 움직였지만 아직 방향을 바꾼 것으로 보지 않은 양(바퀴) */
  backTurns: number;
  /** 끝난 구간들(비빈 것으로 인정된 것만). 결과 화면 기록용 */
  strokes: Stroke[];
  /** 인정된 방향 바꾸기 횟수(보너스 상한과 관계없이 모두 센다) */
  switches: number;
  /** 100% 비빈 시각(ms). 아직이면 null */
  mixedAtMs: number | null;
  /** 마지막으로 반영한 입력 시각. 아직 없으면 null */
  lastAtMs: number | null;
}

export function startStir(): StirState {
  return {
    mix: 0,
    clumpedTurns: 0,
    stroke: null,
    backTurns: 0,
    strokes: [],
    switches: 0,
    mixedAtMs: null,
    lastAtMs: null,
  };
}

/** 한 방향으로 turns바퀴째 돌릴 때 비벼지는 비율(0.25~1) */
export function clumpEfficiency(turns: number): number {
  if (turns <= CLUMP_FROM_TURNS) return 1;
  const progress = Math.min((turns - CLUMP_FROM_TURNS) / (CLUMP_FULL_TURNS - CLUMP_FROM_TURNS), 1);
  return 1 - (1 - CLUMP_MIN_EFFICIENCY) * progress;
}

/** 한 구간에서 0바퀴부터 turns바퀴까지 돌렸을 때 비벼진 양(효율을 적분한 값) */
function mixedOverStroke(turns: number): number {
  const linearEnd = Math.min(turns, CLUMP_FROM_TURNS);
  const clumpEnd = Math.min(turns, CLUMP_FULL_TURNS);
  // 뭉치는 구간은 효율이 1에서 CLUMP_MIN_EFFICIENCY까지 직선으로 줄어든다(사다리꼴 넓이)
  const clumpPart =
    clumpEnd > CLUMP_FROM_TURNS
      ? ((1 + clumpEfficiency(clumpEnd)) / 2) * (clumpEnd - CLUMP_FROM_TURNS)
      : 0;
  const tailPart = Math.max(turns - CLUMP_FULL_TURNS, 0) * CLUMP_MIN_EFFICIENCY;
  return linearEnd + clumpPart + tailPart;
}

/** 구간 길이가 짧아 아직 비빈 것으로 치지 않으면 0. 길이에 닿으면 처음부터 소급해 인정한다 */
const creditedTurns = (turns: number) => (turns >= MIN_STROKE_TURNS ? turns : 0);
const creditedMix = (turns: number) => (turns >= MIN_STROKE_TURNS ? mixedOverStroke(turns) : 0);

/** 플레이 시간 밖이거나, 이미 반영한 입력보다 시각이 같거나 이른 입력(반복 제출)인지 */
function isOutOfOrder(state: StirState, atMs: number): boolean {
  if (atMs < 0 || atMs >= DURATION_MS) return true;
  return state.lastAtMs !== null && atMs <= state.lastAtMs;
}

/** 직전 입력부터 지난 시간에 허용되는 만큼으로 회전량을 깎는다 */
function limitTurns(state: StirState, { atMs, turns }: { atMs: number; turns: number }): number {
  if (state.lastAtMs === null) return 0;
  const gapMs = Math.min(atMs - state.lastAtMs, MAX_SAMPLE_GAP_MS);
  const limit = (MAX_TURNS_PER_SECOND * gapMs) / 1_000;
  return Math.min(Math.max(turns, -limit), limit);
}

/** 돌린 입력 하나(그 사이에 돌린 바퀴 수, 양수 = 시계 방향) */
export interface TurnSample {
  /** 플레이 시작부터의 시각(ms) */
  atMs: number;
  /** 직전 입력 뒤로 돌린 바퀴 수 */
  turns: number;
}

/**
 * 방향과 양(바퀴)만큼 움직였을 때 바뀌는 구간 상태와, 지금 구간이 앞으로 나아간 양.
 * 반대 방향 움직임은 REVERSE_TURNS가 쌓일 때까지 보류했다가 방향을 바꾼다
 */
function moveStroke(
  state: StirState,
  { direction, amount }: { direction: Direction; amount: number },
): Pick<StirState, 'backTurns' | 'strokes' | 'switches'> & { stroke: Stroke; forward: number } {
  const stroke = state.stroke ?? { direction, turns: 0 };
  const { strokes, switches } = state;
  if (direction === stroke.direction) {
    // 반대로 살짝 갔던 만큼은 다시 앞으로 오는 데 쓴다(제자리 흔들기로 바퀴가 늘지 않게)
    const repaid = Math.min(state.backTurns, amount);
    return {
      stroke,
      forward: amount - repaid,
      backTurns: state.backTurns - repaid,
      strokes,
      switches,
    };
  }
  const backTurns = state.backTurns + amount;
  if (backTurns < REVERSE_TURNS) return { stroke, forward: 0, backTurns, strokes, switches };
  // 방향을 바꿨다. 짧았던 구간(제자리 흔들기)은 기록하지 않는다
  return {
    stroke: { direction, turns: 0 },
    forward: backTurns,
    backTurns: 0,
    strokes: stroke.turns >= MIN_STROKE_TURNS ? [...strokes, stroke] : strokes,
    switches: stroke.turns >= SWITCH_MIN_TURNS ? switches + 1 : switches,
  };
}

/** 입력 하나를 반영한 새 상태. 플레이 시간 밖이거나 시간이 거꾸로 가는 입력은 무시한다 */
export function applyTurn(state: StirState, sample: TurnSample): StirState {
  if (isOutOfOrder(state, sample.atMs)) return state;
  const step = limitTurns(state, sample);
  if (step === 0) return { ...state, lastAtMs: sample.atMs };

  const { stroke, forward, ...moved } = moveStroke(state, {
    direction: step > 0 ? 1 : -1,
    amount: Math.abs(step),
  });
  const next: StirState = { ...state, ...moved, lastAtMs: sample.atMs };
  const turns = stroke.turns + forward;
  const mixed = creditedMix(turns) - creditedMix(stroke.turns);
  next.mix += mixed;
  next.clumpedTurns += creditedTurns(turns) - creditedTurns(stroke.turns) - mixed;
  next.stroke = { direction: stroke.direction, turns };
  if (next.mixedAtMs === null && next.mix >= MIX_TARGET_TURNS) next.mixedAtMs = sample.atMs;
  return next;
}

/** 비빈 정도(0~1) */
export function mixRatio(state: StirState): number {
  return Math.min(state.mix / MIX_TARGET_TURNS, 1);
}

/** 지금 구간의 상태: 아직 짧음(바꿔도 보너스 없음) / 바꾸기 좋음 / 뭉치는 중 */
export type StrokeZone = 'short' | 'good' | 'clump';

export function strokeZone(turns: number): StrokeZone {
  if (turns < SWITCH_MIN_TURNS) return 'short';
  if (turns <= CLUMP_FROM_TURNS) return 'good';
  return 'clump';
}

export interface StirResult {
  score: number;
  /** 비빈 정도(0~100) */
  mixPercent: number;
  /** 인정된 방향 바꾸기 횟수 */
  switches: number;
  /** 다 비빈 시각(ms). 다 못 비볐으면 null */
  mixedAtMs: number | null;
  /** 뭉쳐서 헛돈 바퀴 수(소수 첫째 자리) */
  clumpedTurns: number;
  /** 돌린 구간들(마지막 구간 포함). 결과 화면 그래프용 */
  strokes: Stroke[];
}

/** 다 비빈 뒤 남은 시간 보너스 */
function speedBonus(mixedAtMs: number | null): number {
  if (mixedAtMs === null) return 0;
  const bonus = Math.floor((DURATION_MS - mixedAtMs) / SPEED_BONUS_STEP_MS);
  return Math.min(Math.max(bonus, 0), MAX_SPEED_BONUS);
}

/** 최종 점수 = 비빔 + 방향 바꾸기 보너스 + 빨리 다 비빔 보너스 */
export function finalResult(state: StirState): StirResult {
  const mixed = mixRatio(state);
  const total =
    MIX_POINTS * mixed +
    SWITCH_POINTS * Math.min(state.switches, MAX_BONUS_SWITCHES) +
    speedBonus(state.mixedAtMs);
  const last = state.stroke && state.stroke.turns >= MIN_STROKE_TURNS ? [state.stroke] : [];
  return {
    score: Math.round(total),
    mixPercent: Math.floor(mixed * 100),
    switches: state.switches,
    mixedAtMs: state.mixedAtMs,
    clumpedTurns: Math.round(state.clumpedTurns * 10) / 10,
    strokes: [...state.strokes, ...last],
  };
}
