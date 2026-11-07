import type { ShakeResult } from './rules.ts';

// 결과 화면의 "다음 판에 고칠 점" 한 줄. 점수에 가장 크게 영향을 준 것부터 고른다.

/** 처음·끝 몇 초를 보고 "처음이 약했다/끝까지 흔들어라"를 고른다 */
const EDGE_SECONDS = 2;

/** 다음 판에 고칠 점 한 줄. 점수에 가장 크게 영향을 준 것부터 고른다 */
export function adviceFor(result: ShakeResult): string {
  const { ratings } = result;
  const firstSpill = ratings.indexOf('spill');
  if (firstSpill >= 0) return `${firstSpill + 1}초에 넘쳤어요. 세기 바늘이 노란 칸에 오면 살살!`;
  if (result.mixPercent < 100) return '조금 더 힘차게 흔들어 보세요.';
  if (ratings.slice(0, EDGE_SECONDS).includes('weak'))
    return '처음이 약했어요. 시작하자마자 흔들어요.';
  if (ratings.slice(-EDGE_SECONDS).includes('weak')) return '끝까지 쉬지 말고 흔들어요.';
  if (ratings.includes('strong')) return '조금만 살살, 일정한 세기로 흔들어요.';
  if (ratings.includes('weak')) return '중간에 약해진 순간이 있어요. 일정하게 흔들어요.';
  return '완벽해요! 친구에게 도전장을 보내 보세요.';
}
