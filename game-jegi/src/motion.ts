// 제기의 높이. 화면 그리기용 순수 함수라 규칙(rules.ts)과 같은 시계를 쓰되 판정에는 관여하지 않는다.
import { kickTimeMs, MIN_PERIOD_MS, periodMs, START_PERIOD_MS } from './rules.ts';

/** 첫 킥 전에 제기가 떨어지기 시작하는 높이(화면 단위, 발등 = 0) */
export const DROP_HEIGHT = 190;
/** 가장 짧은 주기와 가장 긴 주기에서 제기가 올라가는 높이. 오래 떠 있을수록 높이 오른다 */
const PEAK_MIN = 70;
const PEAK_MAX = 150;
/** 놓친 뒤 제기가 땅에 닿는 높이(발등 기준, 음수 = 발등보다 아래) */
export const GROUND_HEIGHT = -46;
/** 놓친 뒤 떨어지는 가속도(화면 단위/초²) */
const FALL_ACCELERATION = 1_400;

/** 주기가 길수록 높이 올라간다 */
export function peakOf(period: number): number {
  const ratio = (period - MIN_PERIOD_MS) / (START_PERIOD_MS - MIN_PERIOD_MS);
  return PEAK_MIN + (PEAK_MAX - PEAK_MIN) * Math.min(1, Math.max(0, ratio));
}

/**
 * 다음에 찰 킥(index)을 기다리는 동안 제기의 높이(발등 = 0).
 * 첫 킥은 위에서 가속하며 떨어지고, 이후는 직전 킥에서 올라갔다 내려오는 포물선이다.
 */
export function heightAt({ elapsedMs, index }: { elapsedMs: number; index: number }): number {
  const endMs = kickTimeMs(index);
  if (index === 0) {
    const progress = Math.min(1, Math.max(0, elapsedMs / endMs));
    return DROP_HEIGHT * (1 - progress * progress);
  }
  const startMs = kickTimeMs(index - 1);
  const progress = Math.min(1, Math.max(0, (elapsedMs - startMs) / (endMs - startMs)));
  return 4 * progress * (1 - progress) * peakOf(periodMs(index - 1));
}

/** 놓친 순간(fromHeight)부터 elapsedMs가 지났을 때 땅으로 떨어지는 제기의 높이 */
export function fallingHeight({
  fromHeight,
  sinceMs,
}: {
  fromHeight: number;
  sinceMs: number;
}): number {
  const seconds = sinceMs / 1_000;
  return Math.max(GROUND_HEIGHT, fromHeight - 0.5 * FALL_ACCELERATION * seconds * seconds);
}
