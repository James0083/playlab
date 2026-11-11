// 제기차기 판정·점수 규칙. React 없이 테스트할 수 있는 순수 함수로 둔다.
// 서버 재판정(Supabase Edge Function)에서도 이 파일을 그대로 불러 쓴다.
//
// 흐름: 제기가 떨어져 발등 높이에 닿는 순간(차는 시각)에 탭한다. 탭하면 제기가 위로 올라갔다
// 내려와 다음 차는 시각에 다시 발등에 닿는다. 올라갔다 내려오는 시간(주기)은 찰 때마다 짧아진다.
// 제때 못 차거나(너무 일찍·늦음) 헛차면 즉시 끝난다. 시계는 플레이가 시작된 순간이 0이다.

/** 첫 번째로 차는 시각(ms). 제기가 위에서 떨어지는 시간이라 이후 주기보다 길다 */
export const FIRST_KICK_MS = 1_600;
/** 첫 주기(ms): 첫 번째 킥에서 두 번째 킥까지. 플랜에 값이 없어 임시로 정했다. 플레이테스트 후 조정한다 */
export const START_PERIOD_MS = 1_100;
/** 킥마다 주기가 줄어드는 양(ms) */
export const PERIOD_STEP_MS = 20;
/** 가장 짧은 주기(ms). 사람이 안정적으로 칠 수 있는 한계로 보고 고정한다 */
export const MIN_PERIOD_MS = 480;
/** PERFECT로 보는 범위: 차는 시각 ±ms */
export const PERFECT_WINDOW_MS = 50;
/** 성공(GOOD)으로 보는 범위: 차는 시각 ±ms. 주기보다 충분히 작아 이웃한 킥의 범위가 겹치지 않는다 */
export const GOOD_WINDOW_MS = 130;
/** 이만큼 차면 "완주!"로 끝낸다. 이론상 최고 점수를 정하기 위한 상한 */
export const MAX_KICKS = 100;
/** 점수 배율이 한 단계 오르는 킥 수 */
export const COMBO_STEP = 10;

export type Judgement = 'PERFECT' | 'GOOD';
export type MissReason = 'early' | 'late';
/** 끝난 이유: 일찍 참, 놓침, 완주 */
export type EndReason = MissReason | 'cleared';

/** 판정별 기본 점수 */
const BASE_POINTS: Record<Judgement, number> = { PERFECT: 2, GOOD: 1 };

/** index번째(0부터) 킥에서 다음 킥까지의 주기(ms) */
export function periodMs(index: number): number {
  return Math.max(MIN_PERIOD_MS, START_PERIOD_MS - PERIOD_STEP_MS * index);
}

/** index번째(0부터) 킥을 차야 하는 시각(ms) */
export function kickTimeMs(index: number): number {
  let timeMs = FIRST_KICK_MS;
  for (let step = 0; step < index; step++) timeMs += periodMs(step);
  return timeMs;
}

/** 킥 index의 점수 배율. 10킥마다 1씩 올라 최대 10배(MAX_KICKS 기준) */
export function multiplierOf(index: number): number {
  return 1 + Math.floor(index / COMBO_STEP);
}

/** 킥 하나의 점수 */
export function scoreKick(judgement: Judgement, index: number): number {
  return BASE_POINTS[judgement] * multiplierOf(index);
}

/** 이론상 최고 점수(모든 킥 PERFECT). Supabase games.max_score와 같아야 한다 */
export const MAX_SCORE = Array.from({ length: MAX_KICKS }, (_, index) =>
  scoreKick('PERFECT', index),
).reduce((sum, points) => sum + points, 0);

export type TapOutcome =
  | { kind: 'hit'; judgement: Judgement; points: number; offsetMs: number }
  | { kind: 'miss'; reason: 'early' };

/**
 * 탭 하나를 다음 킥(index)과 비교한다.
 * 범위 안이면 성공, 너무 일찍 눌렀으면 헛찬 것으로 끝난다. 한 킥에 한 번만 인정하므로
 * 연타하면 두 번째 탭은 다음 킥보다 일찍 눌린 것이 되어 끝난다.
 * @param tapMs 플레이 시작부터 탭까지 걸린 시간
 */
export function judgeTap({ tapMs, index }: { tapMs: number; index: number }): TapOutcome {
  const offsetMs = tapMs - kickTimeMs(index);
  const distanceMs = Math.abs(offsetMs);
  if (distanceMs > GOOD_WINDOW_MS) return { kind: 'miss', reason: 'early' };
  const judgement: Judgement = distanceMs <= PERFECT_WINDOW_MS ? 'PERFECT' : 'GOOD';
  return { kind: 'hit', judgement, points: scoreKick(judgement, index), offsetMs };
}

/**
 * 탭이 없는 채로 킥(index)의 범위가 지났는지. 지났으면 제기를 놓친 것이다.
 * (범위를 넘어 늦게 누른 탭도 judgeTap이 아닌 이 검사가 먼저 끝낸다)
 */
export function isMissed({ elapsedMs, index }: { elapsedMs: number; index: number }): boolean {
  return elapsedMs > kickTimeMs(index) + GOOD_WINDOW_MS;
}

/** 한 판의 진행 상태 */
export interface RoundState {
  /** 다음에 차야 하는 킥 번호(= 지금까지 찬 횟수) */
  kicks: number;
  score: number;
  perfects: number;
  /** 실패하면 즉시 끝나므로 연속 킥 수 = 찬 횟수다 */
  isOver: boolean;
  reason: EndReason | null;
}

export function startRound(): RoundState {
  return { kicks: 0, score: 0, perfects: 0, isOver: false, reason: null };
}

/** 탭을 반영한 새 상태. 이미 끝났으면 그대로 */
export function applyTap(state: RoundState, tapMs: number): RoundState {
  if (state.isOver) return state;
  // 범위를 넘겨 늦게 도착한 탭(프레임 지연으로 놓침 검사보다 먼저 들어온 경우)은 놓친 것이다
  if (isMissed({ elapsedMs: tapMs, index: state.kicks })) return finish(state, 'late');
  const outcome = judgeTap({ tapMs, index: state.kicks });
  if (outcome.kind === 'miss') return finish(state, outcome.reason);
  const kicks = state.kicks + 1;
  const next = {
    ...state,
    kicks,
    score: state.score + outcome.points,
    perfects: state.perfects + (outcome.judgement === 'PERFECT' ? 1 : 0),
  };
  return kicks >= MAX_KICKS ? finish(next, 'cleared') : next;
}

/** 시간 경과를 반영한 새 상태. 다음 킥의 범위를 지났으면 놓친 것으로 끝난다 */
export function applyElapsed(state: RoundState, elapsedMs: number): RoundState {
  if (state.isOver || !isMissed({ elapsedMs, index: state.kicks })) return state;
  return finish(state, 'late');
}

function finish(state: RoundState, reason: EndReason): RoundState {
  return { ...state, isOver: true, reason };
}

/** 지금의 연속 킥 수에 따른 배율(화면 표시용) */
export function currentMultiplier(state: RoundState): number {
  return multiplierOf(state.kicks);
}
