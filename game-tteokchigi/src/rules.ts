export const DURATION_MS = 60_000;
/** 플랜에 시작 BPM이 없어 임시로 정한 값. 플레이테스트 후 조정한다. */
export const BASE_BPM = 60;
const BPM_STEP = 5;
const BPM_STEP_MS = 10_000;
const PERFECT_MS = 100;
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

/** 플레이 시작 기준 박자 시각(ms). 절굿공이가 정점에 닿는 순간이다. */
export function scheduleBeats(durationMs: number = DURATION_MS): number[] {
  const beats: number[] = [];
  let t = 60_000 / bpmAt(0);
  while (t < durationMs) {
    beats.push(t);
    t += 60_000 / bpmAt(t);
  }
  return beats;
}

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

/** 절굿공이 높이(0~1). 박자 시각에 1(정점)이 되는 포물선이다. */
export function pestleHeight(beats: readonly number[], elapsedMs: number): number {
  const index = nearestBeatIndex(beats, elapsedMs);
  const beat = beats[index];
  if (beat === undefined) return 0;
  const neighbour = elapsedMs < beat ? (beats[index - 1] ?? 0) : (beats[index + 1] ?? beat + 1000);
  const halfPeriod = Math.abs(beat - neighbour) / 2;
  const phase = Math.min(Math.abs(elapsedMs - beat) / halfPeriod, 1);
  return 1 - phase * phase;
}
