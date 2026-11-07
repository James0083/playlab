import { bpmAt, BPM_STEP_MS, nearestBeatIndex, GREAT_MS } from './rules.ts';

/** 떡을 칠 때 외치는 소리. 떡메가 내려오는 동안 한 글자씩 드러난다. */
export const CALL = '요-이';

export interface CallState {
  /** 말풍선에 보일 글자. 빈 문자열이면 말풍선을 숨긴다 */
  text: string;
  /** GREAT 구간 안이면 true. 말풍선을 강조해 "지금!"을 알린다 */
  isPeak: boolean;
}

const HIDDEN: CallState = { text: '', isPeak: false };

/**
 * 지금 시각의 말풍선 상태.
 * 떡메가 꼭대기에서 내려오기 시작하면 "요" → "요-" → "요-이"로 늘어나고,
 * 떡을 치는 순간 전후 GREAT 구간에서는 "요-이!"가 된다. 떡메를 들어 올리는 동안은 숨긴다.
 */
export function callAt(beats: readonly number[], elapsedMs: number): CallState {
  const index = nearestBeatIndex(beats, elapsedMs);
  const beat = beats[index];
  if (beat === undefined) return HIDDEN;

  if (Math.abs(elapsedMs - beat) <= GREAT_MS) return { text: `${CALL}!`, isPeak: true };
  if (elapsedMs > beat) return HIDDEN;

  // 가장 가까운 박자보다 앞이면 내려오는 중이다. 꼭대기(이전 박자와의 중간)에서 출발한다.
  const top = ((beats[index - 1] ?? 0) + beat) / 2;
  const progress = Math.max((elapsedMs - top) / (beat - top), 0);
  const shown = Math.max(Math.ceil(progress * CALL.length), 1);
  return { text: CALL.slice(0, shown), isPeak: false };
}

/** BPM이 오른 직후 알림을 보여주는 시간(ms) */
const SPEED_UP_NOTICE_MS = 1_200;

/** BPM이 막 올랐으면 알림 문구, 아니면 null. 시작 직후(첫 구간)는 알리지 않는다. */
export function speedUpNoticeAt(elapsedMs: number): string | null {
  if (elapsedMs < BPM_STEP_MS) return null;
  if (elapsedMs % BPM_STEP_MS >= SPEED_UP_NOTICE_MS) return null;
  return `빨라져요! ♩=${bpmAt(elapsedMs)}`;
}
