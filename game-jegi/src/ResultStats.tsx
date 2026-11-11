import { MAX_KICKS, multiplierOf, type EndReason, type RoundState } from './rules.ts';

/** 끝난 판. 점수는 세션이 갖고 있어 상태에서 뺀다 */
export type RoundResult = Pick<RoundState, 'kicks' | 'perfects'> & { reason: EndReason };

const HEADLINES: Record<EndReason, string> = {
  early: '너무 일찍 찼어요!',
  late: '제기를 놓쳤어요!',
  cleared: `완주! ${MAX_KICKS}번 찼어요`,
};

/** 다음 판에 고칠 점 한 줄 */
const ADVICE: Record<EndReason, string> = {
  early: '제기가 발등의 점선 원에 닿을 때까지 기다렸다가 쳐요.',
  late: '제기가 발등 높이에 내려오는 순간 쳐요. 점선 원이 진해지는 때예요.',
  cleared: '끝까지 완벽했어요!',
};

export function headlineOf(result: RoundResult): string {
  return HEADLINES[result.reason];
}

/** 점수와 함께 저장하는 기록(랭킹 검토용) */
export function metadataOf(result: RoundResult) {
  return { kicks: result.kicks, perfects: result.perfects, reason: result.reason };
}

/** 결과 화면 기록: 찬 횟수, PERFECT 수, 마지막 배율, 다음 판 팁 */
export function ResultStats({ result }: { result: RoundResult }) {
  const items = [
    { label: '찬 횟수', value: `${result.kicks}번` },
    { label: 'PERFECT', value: `${result.perfects}번` },
    { label: '마지막 배율', value: `×${multiplierOf(Math.max(0, result.kicks - 1))}` },
  ];
  return (
    <>
      <ul className="mg-stats" aria-label="제기차기 기록">
        {items.map(({ label, value }) => (
          <li key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </li>
        ))}
      </ul>
      <p className="jg-advice">{ADVICE[result.reason]}</p>
    </>
  );
}
