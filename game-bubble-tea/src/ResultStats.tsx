import type { ShakeResult } from './rules.ts';

/** 흔든 방법. 폰 센서(motion) 또는 마우스·터치·키보드(pointer) */
export type InputMode = 'motion' | 'pointer';

const INPUT_LABELS: Record<InputMode, string> = {
  motion: '폰 흔들기',
  pointer: '문질러 흔들기',
};

/** 결과 화면 기록: 섞인 정도, 고르기, 넘친 횟수와 랭킹 구분(입력 방식) */
export function ResultStats({ result, inputMode }: { result: ShakeResult; inputMode: InputMode }) {
  const items = [
    { label: '섞임', value: `${result.mixPercent}%` },
    { label: '고르기', value: `${result.evennessPercent}%` },
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
      {/* 입력 방식마다 랭킹이 따로라 어느 랭킹인지 알려준다 */}
      <p className="mg-muted">{INPUT_LABELS[inputMode]} 랭킹</p>
    </>
  );
}
