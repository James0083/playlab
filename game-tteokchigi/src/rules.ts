export const DURATION_MS = 60_000;
/** 플랜에 시작 BPM이 없어 임시로 정한 값. 플레이테스트 후 조정한다. */
export const BASE_BPM = 60;
const BPM_STEP = 5;
/** 이 간격(ms)마다 BPM이 BPM_STEP씩 오른다 */
export const BPM_STEP_MS = 10_000;
/** 떡을 치는 순간(박자) 전후 이 범위(ms) 안에 탭하면 PERFECT */
export const PERFECT_MS = 100;
const GOOD_MS = 200;

export type Judgement = 'PERFECT' | 'GOOD' | 'MISS';

export const POINTS: Record<Judgement, number> = { PERFECT: 2, GOOD: 1, MISS: 0 };

export function judge(deltaMs: number): Judgement {
  const distance = Math.abs(deltaMs);
  if (distance <= PERFECT_MS) return 'PERFECT';
  if (distance <= GOOD_MS) return 'GOOD';
  return 'MISS';
}

export function bpmAt(elapsedMs: number): number {
  return BASE_BPM + BPM_STEP * Math.floor(elapsedMs / BPM_STEP_MS);
}

/** 플레이 시작 기준 박자 시각(ms). 떡메가 떡을 치는 순간이다. */
export function scheduleBeats(durationMs: number = DURATION_MS): number[] {
  const beats: number[] = [];
  let t = 60_000 / bpmAt(0);
  while (t < durationMs) {
    beats.push(t);
    t += 60_000 / bpmAt(t);
  }
  return beats;
}

/**
 * 이론상 최고 점수(모든 박자 PERFECT). Supabase games.max_score와 같아야 한다.
 * 시간·BPM·점수 규칙을 바꾸면 마이그레이션의 max_score도 바꾼다.
 */
export const MAX_SCORE = scheduleBeats().length * POINTS.PERFECT;

export function nearestBeatIndex(beats: readonly number[], elapsedMs: number): number {
  let best = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < beats.length; i++) {
    const distance = Math.abs(beats[i]! - elapsedMs);
    if (distance >= bestDistance) break; // 정렬되어 있으므로 멀어지기 시작하면 끝
    best = i;
    bestDistance = distance;
  }
  return best;
}

/** 탭 없이 떡을 칠 박자가 이만큼 연속으로 지나가면 게임을 끝낸다(자리를 비운 것으로 본다) */
export const MAX_IDLE_BEATS = 3;

/**
 * 마지막 탭(없으면 시작) 이후 아무 시도 없이 지나간 박자 수.
 * 박자의 GOOD 판정 구간이 끝나야 "지나간" 것으로 세고,
 * 마지막 탭이 그 박자의 판정 구간 안이었다면 시도한 것으로 본다.
 */
export function idleBeatsAt(
  beats: readonly number[],
  { elapsedMs, lastTapMs }: { elapsedMs: number; lastTapMs: number | null },
): number {
  const lastTry = lastTapMs ?? -Infinity;
  return beats.filter((beat) => beat - GOOD_MS > lastTry && beat + GOOD_MS < elapsedMs).length;
}

/** 탭한 뒤 떡메가 떡에 닿은 자세로 머무는 시간(ms). 탭할 때 항상 내리치는 모습이 보이게 한다 */
export const STRIKE_HOLD_MS = 120;

/**
 * 떡메 높이(0 = 떡에 닿음, 1 = 가장 높이 든 상태).
 * 박자 시각에 떡을 치고(0), 박자 사이 중간에 가장 높이 올라간다(1).
 * 마지막 탭 후 STRIKE_HOLD_MS 동안은 박자와 관계없이 떡에 닿아 있다.
 */
export function malletHeight(
  beats: readonly number[],
  { elapsedMs, lastStrikeMs }: { elapsedMs: number; lastStrikeMs: number | null },
): number {
  if (lastStrikeMs !== null && elapsedMs - lastStrikeMs < STRIKE_HOLD_MS) return 0;
  const index = nearestBeatIndex(beats, elapsedMs);
  const beat = beats[index];
  if (beat === undefined) return 0;
  const neighbour = elapsedMs < beat ? (beats[index - 1] ?? 0) : (beats[index + 1] ?? beat + 1000);
  const halfPeriod = Math.abs(beat - neighbour) / 2;
  const phase = Math.min(Math.abs(elapsedMs - beat) / halfPeriod, 1);
  // 꼭대기에서는 잠깐 멈춘 듯 느리고, 내려올수록 빨라져 떡을 칠 때 가장 빠르다(실제 떡메처럼).
  // 반대로 하면 떡메가 박자보다 먼저 바닥에 닿은 것처럼 보여 탭이 일찍 들어온다.
  return 1 - (1 - phase) ** 2;
}
