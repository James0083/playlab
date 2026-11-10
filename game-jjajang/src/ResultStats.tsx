import { adviceFor } from './advice.ts';
import {
  CLUMP_FROM_TURNS,
  MAX_BONUS_SWITCHES,
  strokeZone,
  SWITCH_MIN_TURNS,
  type StirResult,
  type Stroke,
} from './rules.ts';

/**
 * 비빈 방법. 폰 센서(motion), 마우스·터치로 원 그리기(pointer), 키보드(keys).
 * 같은 점수로 겨루기 어려워 랭킹을 따로 둔다
 */
export type InputMode = 'motion' | 'pointer' | 'keys';

const RANKING_LABELS: Record<InputMode, string> = {
  motion: '폰 돌리기 랭킹에 기록돼요',
  pointer: '원 그리기 랭킹에 기록돼요',
  keys: '키보드 랭킹에 기록돼요',
};

/** 그래프 막대 높이의 최대치(바퀴). 뭉친 구간이 보일 만큼 */
const GRAPH_MAX_TURNS = 3;
/** 그래프에 보여줄 최대 구간 수(마지막 구간들). 아주 짧게 자주 바꾸면 막대가 너무 가늘어진다 */
const GRAPH_MAX_STROKES = 16;

const DIRECTION_LABELS = { 1: '시계', [-1]: '반시계' } as const;

/** 구간 그래프의 스크린리더용 요약 */
function summarize(strokes: readonly Stroke[]): string {
  if (strokes.length === 0) return '돌린 구간이 없어요';
  const parts = strokes.map(
    ({ direction, turns }) => `${DIRECTION_LABELS[direction]} ${turns.toFixed(1)}바퀴`,
  );
  return `한쪽으로 돌린 구간: ${parts.join(', ')}`;
}

function formatSeconds(ms: number | null): string {
  return ms === null ? '못 했어요' : `${(ms / 1_000).toFixed(1)}초`;
}

/** 결과 화면 기록: 비빔·방향 바꾸기·다 비빈 시각, 구간 그래프, 다음 판 팁, 어느 랭킹인지 */
export function ResultStats({ result, inputMode }: { result: StirResult; inputMode: InputMode }) {
  const items = [
    { label: '비빔', value: `${result.mixPercent}%` },
    {
      label: '방향 바꾸기',
      value: `${Math.min(result.switches, MAX_BONUS_SWITCHES)}/${MAX_BONUS_SWITCHES}번`,
    },
    { label: '다 비빈 시각', value: formatSeconds(result.mixedAtMs) },
  ];
  const strokes = result.strokes.slice(-GRAPH_MAX_STROKES);
  return (
    <>
      <ul className="mg-stats" aria-label="비비기 기록">
        {items.map(({ label, value }) => (
          <li key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      {strokes.length > 0 && (
        <div className="jj-graph" role="img" aria-label={summarize(strokes)}>
          {/* 초록 띠: 방향을 바꾸기 좋은 길이(1~2바퀴) */}
          <span
            className="jj-graph-band"
            style={{
              bottom: `calc(18px + (100% - 18px) * ${SWITCH_MIN_TURNS / GRAPH_MAX_TURNS})`,
              height: `calc((100% - 18px) * ${(CLUMP_FROM_TURNS - SWITCH_MIN_TURNS) / GRAPH_MAX_TURNS})`,
            }}
          />
          {strokes.map(({ direction, turns }, i) => (
            <span key={i} className="jj-graph-column">
              <span
                className={`jj-graph-bar jj-zone-${strokeZone(turns)}`}
                style={{ transform: `scaleY(${Math.min(turns / GRAPH_MAX_TURNS, 1)})` }}
              />
              <span className="jj-graph-direction">{direction === 1 ? '↻' : '↺'}</span>
            </span>
          ))}
        </div>
      )}
      <p className="jj-advice">{adviceFor(result)}</p>
      <p className="mg-muted">{RANKING_LABELS[inputMode]}</p>
    </>
  );
}
