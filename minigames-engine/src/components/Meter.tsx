import type { Ref } from 'react';

/** 바늘 게이지의 색 띠: from(0~1)부터 다음 띠 전까지 이 색 */
export interface MeterBand {
  from: number;
  color: string;
}

interface MeterProps {
  label: string;
  /** 값 글자. 게임이 매 프레임 textContent로 직접 갱신한다 */
  valueRef?: Ref<HTMLSpanElement>;
  defaultValue?: string;
  unit?: string;
  /** 채움 게이지: 게임이 `transform: scaleX(0~1)`로 갱신한다 */
  fillRef?: Ref<HTMLSpanElement>;
  /** 바늘 게이지: 게임이 `transform: translateX(0~100%)`로 갱신한다. bands로 구간 색을 깐다 */
  markerRef?: Ref<HTMLSpanElement>;
  bands?: readonly MeterBand[];
}

/** 색 띠를 왼쪽부터 이어 붙인 그라데이션 */
function bandGradient(bands: readonly MeterBand[]): string {
  const stops = bands.map(({ from, color }, i) => {
    const to = bands[i + 1]?.from ?? 1;
    return `${color} ${(from * 100).toFixed(1)}% ${(to * 100).toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

/**
 * 플레이 중 게이지 한 줄: 이름 · 막대 · 값. 모든 게임이 같은 모양을 쓴다(2026-11-12).
 * 매 프레임 바뀌는 값은 React 상태 대신 ref로 받아 게임이 직접 갱신한다(초당 60번 다시 렌더링하지 않게).
 * 플레이 영역이 <button>일 수 있어 span만 쓴다.
 */
export function Meter({
  label,
  valueRef,
  defaultValue = '',
  unit,
  fillRef,
  markerRef,
  bands,
}: MeterProps) {
  const trackClass = markerRef ? 'mg-meter-track mg-meter-track-bands' : 'mg-meter-track';
  return (
    <span className="mg-meter">
      <span className="mg-meter-label">{label}</span>
      <span className={trackClass} style={bands ? { background: bandGradient(bands) } : undefined}>
        {fillRef && <span ref={fillRef} className="mg-meter-fill" />}
        {markerRef && <span ref={markerRef} className="mg-meter-marker" />}
      </span>
      <span className="mg-meter-value">
        <span ref={valueRef}>{defaultValue}</span>
        {unit && <span className="mg-meter-unit">{unit}</span>}
      </span>
    </span>
  );
}
