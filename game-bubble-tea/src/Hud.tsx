import { Meter } from '@minigames/engine';
import type { RefObject } from 'react';
import {
  MAX_INTENSITY,
  SECONDS,
  SPILL_ENVELOPE,
  WARNING_ENVELOPE,
  type SecondRating,
} from './rules.ts';

// 플레이 중 안내: 섞임 게이지, 세기 게이지(적정 구간 표시), 1초마다 켜지는 점 10개, 넘침 경고.
// 플레이 영역이 <button>일 수 있어 블록 요소(p, div) 대신 span만 쓴다.

/** 매 프레임 직접 갱신하는 안내 요소 */
export interface HudElements {
  meterFill: HTMLSpanElement | null;
  meterText: HTMLSpanElement | null;
  intensityMarker: HTMLSpanElement | null;
  dots: (HTMLSpanElement | null)[];
  warning: HTMLSpanElement | null;
}

export function createHudElements(): HudElements {
  return { meterFill: null, meterText: null, intensityMarker: null, dots: [], warning: null };
}

export interface HudFrame {
  /** 섞인 정도(0~1) */
  mix: number;
  /** 부드럽게 만든 세기. 넘침 판정과 같은 값이다 */
  envelope: number;
  /** 끝난 1초 구간의 평가. 아직 지나지 않은 구간은 넣지 않는다 */
  ratings: readonly SecondRating[];
}

/** 세기 게이지에서 적정 구간이 시작하는 세기. 이보다 약하면 1초 구간이 '약함'이 되기 쉽다 */
const GOOD_FROM = 9;
/** 세기 게이지 색 띠: 약함(회색) → 적정(초록) → 경고(노랑) → 넘침(빨강). 경계는 규칙 값 */
const INTENSITY_BANDS = [
  { from: 0, color: 'var(--mg-border)' },
  { from: GOOD_FROM / MAX_INTENSITY, color: 'var(--bt-good)' },
  { from: WARNING_ENVELOPE / MAX_INTENSITY, color: 'var(--bt-strong)' },
  { from: SPILL_ENVELOPE / MAX_INTENSITY, color: 'var(--mg-danger)' },
];

export function drawHud(elements: HudElements, { mix, envelope, ratings }: HudFrame): void {
  const percent = `${Math.floor(mix * 100)}%`;
  if (elements.meterText && elements.meterText.textContent !== percent) {
    elements.meterText.textContent = percent;
  }
  if (elements.meterFill) elements.meterFill.style.transform = `scaleX(${mix})`;
  if (elements.intensityMarker) {
    const position = Math.min(envelope / MAX_INTENSITY, 1) * 100;
    elements.intensityMarker.style.transform = `translateX(${position}%)`;
  }
  elements.dots.forEach((dot, i) => {
    const className = `bt-dot bt-dot-${ratings[i] ?? 'pending'}`;
    if (dot && dot.className !== className) dot.className = className;
  });
  elements.warning?.classList.toggle('bt-warning-visible', envelope >= WARNING_ENVELOPE);
}

/** 컵 위쪽 안내: 섞임 게이지, 세기 게이지, 1초 점 10개 */
export function HudTop({ elementsRef }: { elementsRef: RefObject<HudElements> }) {
  return (
    <span className="bt-hud" aria-hidden="true">
      <Meter
        label="섞임"
        defaultValue="0%"
        fillRef={(node) => {
          elementsRef.current.meterFill = node;
        }}
        valueRef={(node) => {
          elementsRef.current.meterText = node;
        }}
      />
      <Meter
        label="세기"
        bands={INTENSITY_BANDS}
        markerRef={(node) => {
          elementsRef.current.intensityMarker = node;
        }}
      />
      <span className="bt-dots">
        {Array.from({ length: SECONDS }, (_, i) => (
          <span
            key={i}
            ref={(node) => {
              elementsRef.current.dots[i] = node;
            }}
            className="bt-dot bt-dot-pending"
          />
        ))}
      </span>
    </span>
  );
}

/** 컵 아래 넘침 경고. 자리를 미리 잡아 두어 나타날 때 컵이 밀리지 않는다 */
export function WarningPill({ elementsRef }: { elementsRef: RefObject<HudElements> }) {
  return (
    <span
      ref={(node) => {
        elementsRef.current.warning = node;
      }}
      className="bt-warning"
      aria-hidden="true"
    >
      살살! 넘쳐요
    </span>
  );
}
