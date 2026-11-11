import { adviceFor, type TopResult } from './advice.ts';
import type { FallReason } from './rules.ts';

/**
 * 플레이 방법. 폰 센서(motion), 마우스·터치(pointer), 키보드(keys).
 * 같은 점수로 겨루기 어려워 랭킹을 따로 둔다
 */
export type InputMode = 'motion' | 'pointer' | 'keys';

const RANKING_LABELS: Record<InputMode, string> = {
  motion: '폰 랭킹에 기록돼요',
  pointer: '터치·마우스 랭킹에 기록돼요',
  keys: '키보드 랭킹에 기록돼요',
};

const REASON_LABELS: Record<FallReason, string> = {
  stopped: '회전이 멈춤',
  out: '판 밖으로',
};

/** 점수와 함께 저장하는 기록(랭킹 검토용) */
export function metadataOf(result: TopResult, inputMode: InputMode) {
  return {
    inputMode,
    startRpm: Math.round(result.startRpm),
    survivedMs: Math.round(result.survivedMs),
    reason: result.reason,
  };
}

/** 결과 화면 기록: 처음 회전 속도, 버틴 시간, 쓰러진 이유, 다음 판 팁, 어느 랭킹인지 */
export function ResultStats({ result, inputMode }: { result: TopResult; inputMode: InputMode }) {
  const items = [
    { label: '처음 회전', value: `${Math.round(result.startRpm)} RPM` },
    { label: '버틴 시간', value: `${(result.survivedMs / 1_000).toFixed(1)}초` },
    { label: '쓰러진 이유', value: REASON_LABELS[result.reason] },
  ];
  return (
    <>
      <ul className="mg-stats" aria-label="팽이 기록">
        {items.map(({ label, value }) => (
          <li key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <p className="pg-advice">{adviceFor(result)}</p>
      <p className="mg-muted">{RANKING_LABELS[inputMode]}</p>
    </>
  );
}
