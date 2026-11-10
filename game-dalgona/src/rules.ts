import { SHAPES, type Shape } from './shapes.ts';
import { COVER_RADIUS, type TraceState } from './trace.ts';

/** 제한 시간. 플랜에 없어 정한 값(플레이테스트 후 조정) */
export const TIME_LIMIT_MS = 60_000;
/** 금이 이만큼 가면 깨진다 */
export const MAX_CRACKS = 3;
/**
 * 체크포인트를 모두 긁어야 완성. 예전 97%는 끝까지 긁기 전에 완성되는 문제가 있었다.
 * 점선의 점은 손이 실제로 가까이 지나간 것만 인정한다(trace.ts). 점선이 모두 흐려지면 완성된다.
 */
export const COMPLETE_RATIO = 1;
/** 금 하나당 점수 감점 비율 */
const CRACK_PENALTY = 0.15;

/** 긁은 비율(0~1) */
export function progressOf(trace: TraceState): number {
  return trace.visited.length === 0 ? 0 : trace.visitedCount / trace.visited.length;
}

export const isComplete = (trace: TraceState) => progressOf(trace) >= COMPLETE_RATIO;
export const isBroken = (trace: TraceState) => trace.cracks >= MAX_CRACKS;

/**
 * 선을 얼마나 정확히 따라 그렸는지(0~1). 점선의 점을 처음 그릴 때의 평균 이탈 거리가 0이면 1,
 * 그린 것으로 인정되는 가장 먼 거리(COVER_RADIUS)면 0.
 */
export function precisionOf(trace: TraceState): number {
  if (trace.sampleCount === 0) return 1;
  const averageOffset = trace.deviationTotal / trace.sampleCount;
  return Math.min(Math.max(1 - averageOffset / COVER_RADIUS, 0), 1);
}

/** 정확도가 0이어도 완성했다면 받는 기준 점수의 비율. 나머지는 정확도만큼 받는다 */
const COMPLETION_SHARE = 0.2;

/**
 * 완성했을 때 점수 = 기준 점수 × 정확도 보정 × 균열 감점.
 * 2026-11-10: 따라 그리기의 정확도가 게임의 핵심이 되어 정확도 비중을 50%에서 80%로 올렸다.
 */
export function finalScore(shape: Shape, trace: TraceState): number {
  const precisionFactor = COMPLETION_SHARE + (1 - COMPLETION_SHARE) * precisionOf(trace);
  const crackFactor = 1 - CRACK_PENALTY * trace.cracks;
  return Math.round(shape.baseScore * precisionFactor * crackFactor);
}

/** 이론상 최고 점수(가장 어려운 우산을 완벽하게). Supabase games.max_score와 같아야 한다 */
export const MAX_SCORE = Math.max(...SHAPES.map((shape) => shape.baseScore));

/** 저장된 해금 수를 읽는다. 없거나 이상한 값이면 첫 모양만 연다 */
export function parseUnlockedCount(stored: string | null, total: number): number {
  const count = Number(stored);
  if (!Number.isInteger(count) || count < 1) return 1;
  return Math.min(count, total);
}

/** clearedIndex 번째 모양을 완성했을 때 새 해금 수. 다음 모양이 열린다 */
export function unlockAfterClear(unlocked: number, clearedIndex: number, total: number): number {
  return Math.min(Math.max(unlocked, clearedIndex + 2), total);
}

/** 결과 화면 주 버튼으로 시작할 모양. 완성했고 다음 모양이 있으면 다음 모양, 아니면 같은 모양을 다시 한다 */
export function nextShapeIndex({
  isComplete,
  index,
  total,
}: {
  isComplete: boolean;
  index: number;
  total: number;
}): number {
  return isComplete && index + 1 < total ? index + 1 : index;
}

/** 받침이 있으면 '을', 없으면 '를'. 예: 집을, 세모를 */
function objectParticle(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const isHangul = code >= 0 && code < 11_172;
  return isHangul && code % 28 !== 0 ? '을' : '를';
}

/** 잠긴 모양을 눌렀을 때 안내 문구. previous는 지금 열린 마지막 모양 */
export function unlockHint(previous: Shape): string {
  return `${previous.name}${objectParticle(previous.name)} 완성하면 열려요`;
}
