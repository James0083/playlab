import { MAX_BONUS_SWITCHES, SWITCH_MIN_TURNS, type StirResult } from './rules.ts';

// 결과 화면의 "다음 판에 고칠 점" 한 줄. 점수에 가장 크게 영향을 준 것부터 고른다.

/** 이만큼(바퀴) 넘게 헛돌았으면 뭉침이 점수를 깎은 가장 큰 원인으로 본다 */
const NOTABLE_CLUMP_TURNS = 1;
/** 다 비빈 시각이 이보다 늦으면 시간 보너스를 더 받을 수 있다고 알려 준다(ms) */
const SLOW_MIX_MS = 8_500;

/** 다음 판에 고칠 점 한 줄 */
export function adviceFor(result: StirResult): string {
  const { mixPercent, switches, clumpedTurns, strokes, mixedAtMs } = result;
  if (mixPercent < 100 && clumpedTurns >= NOTABLE_CLUMP_TURNS)
    return '한쪽으로 너무 오래 돌려 면이 뭉쳤어요. 2바퀴 안에 반대로!';
  if (mixPercent < 100) return '조금 더 빨리 휘저어 보세요.';
  if (switches < MAX_BONUS_SWITCHES) {
    const shortStrokes = strokes.filter(({ turns }) => turns < SWITCH_MIN_TURNS).length;
    return shortStrokes > switches
      ? '한쪽으로 1바퀴는 채우고 바꿔야 방향 바꾸기로 쳐요.'
      : `방향을 ${MAX_BONUS_SWITCHES}번 바꾸면 보너스를 다 받아요.`;
  }
  if (clumpedTurns > 0) return '2바퀴 넘기 전에 바꾸면 더 빨리 비벼져요.';
  if (mixedAtMs !== null && mixedAtMs > SLOW_MIX_MS)
    return '조금 더 빨리 돌리면 시간 보너스가 커져요.';
  return '완벽해요! 친구에게 도전장을 보내 보세요.';
}
