import {
  MAX_RPM,
  rpmOf,
  scoreOf,
  type BalanceState,
  type FallReason,
  type SpinState,
} from './rules.ts';

// 결과 화면의 "다음 판에 고칠 점" 한 줄. 점수에 가장 크게 영향을 준 것부터 고른다.

export interface TopResult {
  score: number;
  /** 돌리기로 얻은 회전 속도 */
  startRpm: number;
  /** 돌리다 반대로 가서 깎인 바퀴 수 */
  reversedTurns: number;
  /** 균형 단계에서 버틴 시간(ms) */
  survivedMs: number;
  reason: FallReason;
}

/** 쓰러진 판의 기록 */
export function topResultOf(balance: BalanceState, spin: SpinState): TopResult {
  return {
    score: scoreOf(balance),
    startRpm: rpmOf(spin),
    reversedTurns: spin.reversedTurns,
    survivedMs: balance.elapsedMs,
    reason: balance.fallen ?? 'stopped',
  };
}

/** 돌리기가 이보다 느리면 돌리기부터 고치라고 한다 */
const SLOW_SPIN_RATIO = 0.6;
/** 반대로 이만큼(바퀴) 넘게 돌렸으면 한 방향으로 돌리라고 한다 */
const NOTABLE_REVERSE_TURNS = 1;
/** 이보다 느리게 돌렸으면 "더 빨리 돌리면 더 오래" */
const FAST_SPIN_RATIO = 0.9;

export function adviceFor(result: TopResult): string {
  const { startRpm, reversedTurns, reason } = result;
  if (startRpm < MAX_RPM * SLOW_SPIN_RATIO) {
    return reversedTurns >= NOTABLE_REVERSE_TURNS
      ? '돌리다 반대로 가서 느려졌어요. 한 방향으로만 돌려요.'
      : '처음 5초에 더 빨리 돌려요. 회전이 빠를수록 오래 버텨요.';
  }
  if (reason === 'out') return '팽이가 미끄러지면 반대쪽으로 기울여 가운데로 돌려놓아요.';
  if (startRpm < MAX_RPM * FAST_SPIN_RATIO) return '조금만 더 빨리 돌리면 더 오래 버텨요.';
  return '완벽해요! 친구에게 도전장을 보내 보세요.';
}

/** 결과 화면 맨 위 한 줄 */
export function headlineOf(result: TopResult): string {
  if (result.score >= 200) return '팽이 장인!';
  if (result.reason === 'stopped') return '끝까지 돌았어요!';
  return '판 밖으로 나갔어요';
}
