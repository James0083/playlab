import { Meter } from '@minigames/engine';
import type { RefObject } from 'react';
import {
  CLUMP_FROM_TURNS,
  MAX_BONUS_SWITCHES,
  SWITCH_MIN_TURNS,
  type Direction,
  type StrokeZone,
} from './rules.ts';

// 플레이 중 안내: 비빔 게이지, 한 방향 게이지(지금 방향으로 돌린 바퀴), 방향 바꾸기 칸, 뭉침 경고.
// 플레이 영역이 <button>일 수 있어 블록 요소(p, div) 대신 span만 쓴다.

/** 매 프레임 직접 갱신하는 안내 요소 */
export interface HudElements {
  mixFill: HTMLSpanElement | null;
  mixText: HTMLSpanElement | null;
  strokeMarker: HTMLSpanElement | null;
  strokeText: HTMLSpanElement | null;
  pips: (HTMLSpanElement | null)[];
  clump: HTMLSpanElement | null;
}

export function createHudElements(): HudElements {
  return {
    mixFill: null,
    mixText: null,
    strokeMarker: null,
    strokeText: null,
    pips: [],
    clump: null,
  };
}

export interface HudFrame {
  /** 비빈 정도(0~1) */
  mix: number;
  /** 지금 방향과 그 방향으로 돌린 바퀴. 아직 안 돌렸으면 null */
  stroke: { direction: Direction; turns: number } | null;
  zone: StrokeZone;
  /** 인정된 방향 바꾸기 횟수 */
  switches: number;
}

/** 한 방향 게이지 끝(바퀴). 뭉치는 구간이 보일 만큼 */
const STROKE_GAUGE_TURNS = 3;
/** 한쪽 게이지 색 띠: 짧음(회색) → 바꾸기 좋음(초록) → 뭉침(빨강). 경계는 규칙 값 */
const STROKE_BANDS = [
  { from: 0, color: 'var(--mg-border)' },
  { from: SWITCH_MIN_TURNS / STROKE_GAUGE_TURNS, color: 'var(--jj-good)' },
  { from: CLUMP_FROM_TURNS / STROKE_GAUGE_TURNS, color: 'var(--mg-danger)' },
];
const DIRECTION_ICONS: Record<Direction, string> = { 1: '↻', [-1]: '↺' };

/** 글자가 바뀐 경우에만 고친다(매 프레임 같은 글자를 다시 쓰지 않게) */
function setText(element: HTMLElement | null, text: string): void {
  if (element && element.textContent !== text) element.textContent = text;
}

export function drawHud(elements: HudElements, { mix, stroke, zone, switches }: HudFrame): void {
  setText(elements.mixText, `${Math.floor(mix * 100)}%`);
  if (elements.mixFill) elements.mixFill.style.transform = `scaleX(${mix})`;
  const turns = stroke?.turns ?? 0;
  if (elements.strokeMarker) {
    const position = Math.min(turns / STROKE_GAUGE_TURNS, 1) * 100;
    elements.strokeMarker.style.transform = `translateX(${position}%)`;
  }
  setText(
    elements.strokeText,
    stroke ? `${DIRECTION_ICONS[stroke.direction]} ${turns.toFixed(1)}` : '–',
  );
  elements.pips.forEach((pip, i) => {
    const className = i < switches ? 'jj-pip jj-pip-on' : 'jj-pip';
    if (pip && pip.className !== className) pip.className = className;
  });
  elements.clump?.classList.toggle('jj-clump-visible', zone === 'clump');
}

/** 그릇 위쪽 안내: 비빔 게이지, 한 방향 게이지, 방향 바꾸기 칸 */
export function HudTop({ elementsRef }: { elementsRef: RefObject<HudElements> }) {
  return (
    <span className="jj-hud" aria-hidden="true">
      <Meter
        label="비빔"
        defaultValue="0%"
        fillRef={(node) => {
          elementsRef.current.mixFill = node;
        }}
        valueRef={(node) => {
          elementsRef.current.mixText = node;
        }}
      />
      <Meter
        label="한쪽"
        defaultValue="–"
        bands={STROKE_BANDS}
        markerRef={(node) => {
          elementsRef.current.strokeMarker = node;
        }}
        valueRef={(node) => {
          elementsRef.current.strokeText = node;
        }}
      />
      <span className="jj-pips">
        <span className="jj-pips-label">방향 바꾸기</span>
        {Array.from({ length: MAX_BONUS_SWITCHES }, (_, i) => (
          <span
            key={i}
            ref={(node) => {
              elementsRef.current.pips[i] = node;
            }}
            className="jj-pip"
          />
        ))}
      </span>
    </span>
  );
}

/** 그릇 아래 뭉침 경고. 자리를 미리 잡아 두어 나타날 때 그릇이 밀리지 않는다 */
export function ClumpPill({ elementsRef }: { elementsRef: RefObject<HudElements> }) {
  return (
    <span
      ref={(node) => {
        elementsRef.current.clump = node;
      }}
      className="jj-clump"
      aria-hidden="true"
    >
      면이 뭉쳐요! 반대로 돌려요
    </span>
  );
}
