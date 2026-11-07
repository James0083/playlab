import type { ScoreState } from './scoring.ts';

/** 결과 화면에 보여줄 판정별 개수와 최대 콤보 */
export function ResultStats({ stats }: { stats: ScoreState }) {
  const items = [
    { label: 'GREAT', value: stats.counts.GREAT },
    { label: 'PERFECT', value: stats.counts.PERFECT },
    { label: 'GOOD', value: stats.counts.GOOD },
    { label: 'MISS', value: stats.counts.MISS },
    { label: '최대 콤보', value: stats.maxCombo },
  ];
  return (
    <ul className="mg-stats" aria-label="판정 기록">
      {items.map(({ label, value }) => (
        <li key={label}>
          <strong>{value}</strong>
          <span>{label}</span>
        </li>
      ))}
    </ul>
  );
}
