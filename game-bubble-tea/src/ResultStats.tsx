import { adviceFor } from './advice.ts';
import { SECONDS, STEADY_TARGET, type SecondRating, type ShakeResult } from './rules.ts';

/**
 * 흔든 방법. 폰 센서(motion), 마우스·터치 문지르기(pointer), 키보드(keys).
 * 같은 점수로 겨루기 어려워 랭킹을 따로 둔다
 */
export type InputMode = 'motion' | 'pointer' | 'keys';

const RANKING_LABELS: Record<InputMode, string> = {
  motion: '폰 흔들기 랭킹에 기록돼요',
  pointer: '문질러 흔들기 랭킹에 기록돼요',
  keys: '키보드 랭킹에 기록돼요',
};

const RATING_LABELS: Record<SecondRating, string> = {
  steady: '적정',
  weak: '약함',
  strong: '셈',
  spill: '넘침',
};

/** 그래프 막대 높이의 최대치(목표의 2배를 꽉 찬 높이로) */
const GRAPH_MAX = STEADY_TARGET * 2;
/** 1초 구간 그래프의 스크린리더용 요약 */
function summarize(ratings: readonly SecondRating[]): string {
  const counts = (['steady', 'weak', 'strong', 'spill'] as const)
    .map((rating) => ({ rating, count: ratings.filter((r) => r === rating).length }))
    .filter(({ count }) => count > 0)
    .map(({ rating, count }) => `${RATING_LABELS[rating]} ${count}초`);
  return `1초마다 흔든 세기: ${counts.join(', ')}`;
}

/** 결과 화면 기록: 섞임·적정 세기·넘침, 1초 구간 그래프, 다음 판 팁, 어느 랭킹인지 */
export function ResultStats({ result, inputMode }: { result: ShakeResult; inputMode: InputMode }) {
  const items = [
    { label: '섞임', value: `${result.mixPercent}%` },
    { label: '적정 세기', value: `${result.steadySeconds}/${SECONDS}초` },
    { label: '넘침', value: `${result.spills}번` },
  ];
  return (
    <>
      <ul className="mg-stats" aria-label="흔들기 기록">
        {items.map(({ label, value }) => (
          <li key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <div className="bt-graph" role="img" aria-label={summarize(result.ratings)}>
        {/* 초록 띠: 적정으로 인정되는 세기 범위(목표의 0.75~1.5배) */}
        <span className="bt-graph-band" />
        {result.buckets.map((amount, i) => (
          <span key={i} className="bt-graph-column">
            <span
              className={`bt-graph-bar bt-dot-${result.ratings[i] ?? 'weak'}`}
              style={{ transform: `scaleY(${Math.min(amount / GRAPH_MAX, 1)})` }}
            />
            <span className="bt-graph-second">{i + 1}</span>
          </span>
        ))}
      </div>
      <p className="bt-advice">{adviceFor(result)}</p>
      <p className="mg-muted">{RANKING_LABELS[inputMode]}</p>
    </>
  );
}
