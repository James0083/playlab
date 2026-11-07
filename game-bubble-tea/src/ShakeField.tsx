import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { InputMode } from './ResultStats.tsx';
import { intensityFromPointer } from './rules.ts';

/** 키보드로 흔들 때: ←→를 번갈아 한 번 누를 때마다 컵을 이만큼(px) 움직인 것으로 본다 */
const KEY_STEP_PX = 400;
const SHAKE_KEYS = new Set(['ArrowLeft', 'ArrowRight']);

interface ShakeFieldProps {
  inputMode: InputMode;
  /** 마우스·터치·키보드로 흔들 때마다 부른다. 시각은 performance.now 기준. 폰 센서 입력은 게임 화면이 직접 받는다 */
  onShake: (nowMs: number, intensity: number) => void;
  /** 컵 그림 */
  children: ReactNode;
}

/**
 * 플레이 영역. 폰 흔들기면 안내와 컵만 보여주고,
 * 문질러 흔들기면 컵을 누른 채 문지르거나 ←→를 번갈아 눌러 흔든다.
 */
export function ShakeField({ inputMode, onShake, children }: ShakeFieldProps) {
  // 직전 포인터 위치와 직전에 누른 키. 이동 속도·번갈아 누른 간격으로 세기를 잰다
  const pointer = useRef<{ x: number; y: number; atMs: number } | null>(null);
  const lastKey = useRef<{ key: string; atMs: number } | null>(null);

  if (inputMode === 'motion') {
    return (
      <div className="bt-field">
        <p className="bt-hint">폰을 흔들어 섞어요</p>
        {children}
      </div>
    );
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    // 손가락이 컵 밖으로 나가도 계속 흔들 수 있게 한다
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { x: event.clientX, y: event.clientY, atMs: performance.now() };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const previous = pointer.current;
    if (!previous) return;
    const nowMs = performance.now();
    const distancePx = Math.hypot(event.clientX - previous.x, event.clientY - previous.y);
    pointer.current = { x: event.clientX, y: event.clientY, atMs: nowMs };
    onShake(nowMs, intensityFromPointer({ distancePx, durationMs: nowMs - previous.atMs }));
  };

  const handlePointerUp = () => {
    pointer.current = null;
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
    onShake(nowMs, intensityFromPointer({ distancePx: KEY_STEP_PX, durationMs }));
  };

  return (
    <button
      type="button"
      className="bt-field bt-field-pointer"
      aria-label="컵 흔들기: 누른 채 좌우로 문지르거나 왼쪽·오른쪽 화살표를 번갈아 누르세요"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
      // 플레이가 시작되면 바로 키보드로 흔들 수 있게 한다
      autoFocus
    >
      <span className="bt-hint">컵을 누른 채 좌우로 문질러요 · ←→ 번갈아 누르기</span>
      {children}
    </button>
  );
}
