import { POINTS, scheduleBeats, type Judgement } from './rules.ts';

// 탭 한 번의 점수: 판정 기본 점수 × 콤보 배율. 연속 MISS는 감점한다.

export interface ScoreState {
  /** 지금 이어지는 연속 성공 수(GOOD 이상) */
  combo: number;
  maxCombo: number;
  /** 지금 이어지는 연속 MISS 수 */
  missStreak: number;
  /** 마지막으로 맞힌 박자 번호. 박자를 건너뛰면 콤보가 끊긴다 */
  lastHitBeat: number | null;
  counts: Record<Judgement, number>;
}

export function initialScoreState(): ScoreState {
  return {
    combo: 0,
    maxCombo: 0,
    missStreak: 0,
    lastHitBeat: null,
    counts: { GREAT: 0, PERFECT: 0, GOOD: 0, MISS: 0 },
  };
}

/** 콤보 배율이 오르는 지점 */
const COMBO_FOR_DOUBLE = 10;
const COMBO_FOR_TRIPLE = 30;

export function comboMultiplier(combo: number): number {
  if (combo >= COMBO_FOR_TRIPLE) return 3;
  if (combo >= COMBO_FOR_DOUBLE) return 2;
  return 1;
}

/** 연속 MISS 감점. 첫 MISS는 봐주고, 두 번째부터 MISS마다 이만큼 깎는다(연타 방지) */
const MISS_STREAK_PENALTY = 1;

/**
 * 탭 하나를 반영한 새 상태와 점수 변화량.
 * - GOOD 이상: 콤보 +1(직전에 맞힌 박자 바로 다음이 아니면 1부터 다시), 점수 = 기본 점수 × 콤보 배율
 * - MISS: 콤보 0, 연속 두 번째 MISS부터 감점
 */
export function scoreTap(
  state: ScoreState,
  { judgement, beatIndex }: { judgement: Judgement; beatIndex: number },
): { state: ScoreState; delta: number } {
  const counts = { ...state.counts, [judgement]: state.counts[judgement] + 1 };

  if (judgement === 'MISS') {
    const missStreak = state.missStreak + 1;
    const delta = missStreak >= 2 ? -MISS_STREAK_PENALTY : 0;
    return { state: { ...state, counts, combo: 0, missStreak }, delta };
  }

  const isConsecutive = state.lastHitBeat !== null && beatIndex === state.lastHitBeat + 1;
  const combo = isConsecutive ? state.combo + 1 : 1;
  return {
    state: {
      counts,
      combo,
      maxCombo: Math.max(state.maxCombo, combo),
      missStreak: 0,
      lastHitBeat: beatIndex,
    },
    delta: POINTS[judgement] * comboMultiplier(combo),
  };
}

/**
 * 이론상 최고 점수(모든 박자를 GREAT로, 콤보를 끊지 않고). Supabase games.max_score와 같아야 한다.
 * 시간·BPM·점수·콤보 규칙을 바꾸면 마이그레이션의 max_score도 바꾼다.
 */
export const MAX_SCORE = scheduleBeats().reduce(
  (acc, _, beatIndex) => {
    const { state, delta } = scoreTap(acc.state, { judgement: 'GREAT', beatIndex });
    return { state, total: acc.total + delta };
  },
  { state: initialScoreState(), total: 0 },
).total;
