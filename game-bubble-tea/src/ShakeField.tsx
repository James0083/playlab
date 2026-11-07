import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { InputMode } from './ResultStats.tsx';
import { intensityFromPointer } from './rules.ts';

/**
 * 키보드로 흔들 때: ←→를 번갈아 한 번 누를 때마다 영역 폭의 이 비율만큼 움직인 것으로 본다.
 * 0.16초 간격(초당 약 6번)으로 누르면 목표 세기 12가 된다.
 */
const KEY_STEP_RATIO = 0.48;
const SHAKE_KEYS = new Set(['ArrowLeft', 'ArrowRight']);

/** 흔든 입력의 출처. 키보드는 박자만 맞추면 쉬워 랭킹을 따로 둔다 */
export type ShakeSource = 'pointer' | 'keys';

interface ShakeFieldProps {
  inputMode: InputMode;
  /** 스크린리더에 읽어 줄 상태 변화(섞임 25%마다, 넘침). 플레이 영역은 버튼이라 밖에 따로 둔다 */
  announcement: string;
  /** 마우스·터치·키보드로 흔들 때마다 부른다. 시각은 performance.now 기준 */
  onShake: (shake: { nowMs: number; intensity: number; source: ShakeSource }) => void;
  /** 컵 그림 */
  children: ReactNode;
}

const HINTS: Record<InputMode, string> = {
  motion: '폰을 흔들어 섞어요',
  pointer: '컵을 누른 채 좌우로 문질러요 · ←→ 번갈아 누르기',
  keys: '←→를 번갈아 눌러 섞어요',
};

/**
 * 플레이 영역. 폰 흔들기 모드에서도 문지르기·키 입력을 받는다
 * (센서는 있지만 흔들 수 없는 기기라면 게임 화면이 문지르기로 바꾼다).
 */
export function ShakeField({ inputMode, announcement, onShake, children }: ShakeFieldProps) {
  // 따라가는 손가락(첫 손가락)과 직전 위치, 직전에 누른 키
  const pointer = useRef<{ id: number; x: number; y: number; atMs: number } | null>(null);
  const lastKey = useRef<{ key: string; atMs: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    // 두 번째 손가락은 무시한다. 두 손가락 사이 거리를 움직인 거리로 재면 가만히 있어도 세게 흔든 것이 된다
    if (!event.isPrimary || pointer.current) return;
    try {
      // 손가락이 영역 밖으로 나가도 계속 흔들 수 있게 한다
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 캡처하지 못해도 영역 안에서는 흔들 수 있다 */
    }
    pointer.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      atMs: performance.now(),
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const previous = pointer.current;
    if (!previous || event.pointerId !== previous.id) return;
    // 창 밖에서 마우스를 떼어 pointerup을 놓쳤으면 누르지 않고 움직이는 것은 흔들기가 아니다
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      pointer.current = null;
      return;
    }
    const nowMs = performance.now();
    const widthPx = event.currentTarget.getBoundingClientRect().width;
    const distancePx = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);
    pointer.current = { ...previous, x: event.clientX, y: event.clientY, atMs: nowMs };
    if (widthPx <= 0) return;
    const intensity = intensityFromPointer({
      distanceRatio: distancePx / widthPx,
      durationMs: nowMs - previous.atMs,
    });
    onShake({ nowMs, intensity, source: 'pointer' });
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current?.id === event.pointerId) pointer.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!SHAKE_KEYS.has(event.key) || event.repeat) return;
    event.preventDefault();
    const nowMs = performance.now();
    const previous = lastKey.current;
    lastKey.current = { key: event.key, atMs: nowMs };
    // 같은 키를 거듭 누르는 것은 흔든 것이 아니다. 좌우를 번갈아 눌러야 한다
    if (!previous || previous.key === event.key) return;
    const durationMs = nowMs - previous.atMs;
    const intensity = intensityFromPointer({ distanceRatio: KEY_STEP_RATIO, durationMs });
    onShake({ nowMs, intensity, source: 'keys' });
  };

  return (
    <>
      <button
        type="button"
        className="bt-field bt-field-playing"
        aria-label={`컵 흔들기: ${HINTS[inputMode]}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onKeyDown={handleKeyDown}
        // 플레이가 시작되면 바로 키보드로 흔들 수 있게 한다
        autoFocus
      >
        <span className={inputMode === 'motion' ? 'bt-hint' : 'bt-hint bt-hint-strong'}>
          {HINTS[inputMode]}
        </span>
        {children}
      </button>
      <p className="bt-sr-only" role="status">
        {announcement}
      </p>
    </>
  );
}
