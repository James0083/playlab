// 판정·점수 규칙. React 없이 테스트할 수 있는 순수 함수로 둔다.
// 서버 재판정(Supabase Edge Function)에서도 이 파일을 그대로 불러 쓴다.
// TODO: 게임 규칙을 처음 구현할 때 아래 예시 규칙(제한 시간 동안 탭한 횟수)을 이 게임의 규칙으로 바꾼다.

/** 플레이 시간(ms). 무한 콤보 방식이면 useGameSession에 null을 넘긴다 */
export const DURATION_MS = 10_000;

/** 직전에 인정한 탭과 이보다 가까우면 점수로 치지 않는다. 초당 20회를 넘는 탭은 사람이 아니라 매크로로 본다 */
export const MIN_TAP_INTERVAL_MS = 50;

/** 이론상 최고 점수(가장 빠른 간격으로 끝까지 탭). Supabase games.max_score와 같아야 한다 */
export const MAX_SCORE = DURATION_MS / MIN_TAP_INTERVAL_MS;

/**
 * 탭 하나의 점수.
 * @param elapsedMs 플레이 시작부터 탭까지 걸린 시간
 * @param lastScoredMs 직전에 점수로 인정한 탭 시각. 아직 없으면 null
 */
export function scoreTap({
  elapsedMs,
  lastScoredMs,
}: {
  elapsedMs: number;
  lastScoredMs: number | null;
}): number {
  if (lastScoredMs !== null && elapsedMs - lastScoredMs < MIN_TAP_INTERVAL_MS) return 0;
  return 1;
}
