import { SHAPES, type Shape } from './shapes.ts';
import { CRACK_DISTANCE, type TraceState } from './trace.ts';

/** 제한 시간. 플랜에 없어 정한 값(플레이테스트 후 조정) */
export const TIME_LIMIT_MS = 60_000;
/** 금이 이만큼 가면 깨진다 */
export const MAX_CRACKS = 3;
/**
 * 체크포인트를 모두 긁어야 완성. 예전 97%는 끝까지 긁기 전에 완성되는 문제가 있었다.
 * 체크포인트는 바늘이 선 위로 실제 지나간 자리만 인정하므로(trace.ts) 흰 선이 다 이어지면 완성된다.
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

/** 선을 얼마나 정확히 따라갔는지(0~1). 평균 이탈 거리가 0이면 1, 금 갈 거리면 0 */
export function precisionOf(trace: TraceState): number {
  if (trace.sampleCount === 0) return 1;
  const averageOffset = trace.deviationTotal / trace.sampleCount;
  return Math.min(Math.max(1 - averageOffset / CRACK_DISTANCE, 0), 1);
}

/**
 * 완성했을 때 점수 = 기준 점수 × 정확도 보정 × 균열 감점.
 * 정확도가 0이어도 완성했다면 기준 점수의 절반은 받는다.
 */
export function finalScore(shape: Shape, trace: TraceState): number {
  const precisionFactor = 0.5 + 0.5 * precisionOf(trace);
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
