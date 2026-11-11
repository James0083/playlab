import { keyTurns, pointerTurns, ROTATE_KEYS } from '@minigames/engine';
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { InputMode } from './ResultStats.tsx';

/** 그릇 그림(viewBox 240) 기준으로 가운데에서 이보다 가까운 곳은 돈 각도를 재지 않는다 */
const MIN_RADIUS_IN_VIEWBOX = 28;
const VIEWBOX_SIZE = 240;

/** 돌린 입력의 출처. 키보드는 박자만 맞추면 쉬워 랭킹을 따로 둔다 */
export type StirSource = 'pointer' | 'keys';

interface StirFieldProps {
  inputMode: InputMode;
  /** 스크린리더에 읽어 줄 상태 변화(비빔 25%마다, 뭉침, 방향 바꾸기). 플레이 영역은 버튼이라 밖에 둔다 */
  announcement: string;
  /** 마우스·터치·키보드로 돌릴 때마다 부른다. 시각은 performance.now 기준, 양수 = 시계 방향 */
  onTurn: (turn: { nowMs: number; turns: number; source: StirSource }) => void;
  /** 그릇 그림 */
  children: ReactNode;
}

const HINTS: Record<InputMode, string> = {
  motion: '폰을 원 그리듯 돌려 비벼요',
  pointer: '그릇 위에 원을 그려요 · ↑→↓← 차례로 누르기',
  keys: '↑→↓← 차례로 눌러 돌려요 · 반대로 누르면 방향 바꾸기',
};

/** 그릇 그림의 화면상 가운데와 크기 배율(viewBox → px) */
function bowlGeometry(field: HTMLElement): { x: number; y: number; scale: number } | null {
  const svg = field.querySelector('svg');
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  // SVG는 가로세로 비율을 유지하며 가운데에 그려진다
  const size = Math.min(rect.width, rect.height);
  if (size <= 0) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    scale: size / VIEWBOX_SIZE,
  };
}

/**
 * 플레이 영역. 폰 돌리기 모드에서도 원 그리기·키 입력을 받는다
 * (센서는 있지만 돌릴 수 없는 기기라면 게임 화면이 원 그리기로 바꾼다).
 */
export function StirField({ inputMode, announcement, onTurn, children }: StirFieldProps) {
  // 따라가는 손가락(첫 손가락)과 직전 위치(그릇 가운데 기준), 직전에 누른 키
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const lastKey = useRef<string | null>(null);

  const relativePoint = (event: PointerEvent<HTMLButtonElement>) => {
    const bowl = bowlGeometry(event.currentTarget);
    if (!bowl) return null;
    return {
      x: event.clientX - bowl.x,
      y: event.clientY - bowl.y,
      minRadius: MIN_RADIUS_IN_VIEWBOX * bowl.scale,
    };
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    // 두 번째 손가락은 무시한다
    if (!event.isPrimary || pointer.current) return;
    try {
      // 손가락이 영역 밖으로 나가도 계속 돌릴 수 있게 한다
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 캡처하지 못해도 영역 안에서는 돌릴 수 있다 */
    }
    const point = relativePoint(event);
    if (point) pointer.current = { id: event.pointerId, x: point.x, y: point.y };
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const previous = pointer.current;
    if (!previous || event.pointerId !== previous.id) return;
    // 창 밖에서 마우스를 떼어 pointerup을 놓쳤으면 누르지 않고 움직이는 것은 돌리기가 아니다
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      pointer.current = null;
      return;
    }
    const point = relativePoint(event);
    if (!point) return;
    pointer.current = { ...previous, x: point.x, y: point.y };
    const turns = pointerTurns(previous, point, point.minRadius);
    if (turns !== 0) onTurn({ nowMs: performance.now(), turns, source: 'pointer' });
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current?.id === event.pointerId) pointer.current = null;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!ROTATE_KEYS.has(event.key) || event.repeat) return;
    event.preventDefault();
    const turns = keyTurns(lastKey.current, event.key);
    lastKey.current = event.key;
    if (turns !== 0) onTurn({ nowMs: performance.now(), turns, source: 'keys' });
  };

  return (
    <>
      <button
        type="button"
        className="jj-field jj-field-playing"
        aria-label={`짜장면 비비기: ${HINTS[inputMode]}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onKeyDown={handleKeyDown}
        // 플레이가 시작되면 바로 키보드로 돌릴 수 있게 한다
        autoFocus
      >
        <span className={inputMode === 'motion' ? 'jj-hint' : 'jj-hint jj-hint-strong'}>
          {HINTS[inputMode]}
        </span>
        {children}
      </button>
      <p className="jj-sr-only" role="status">
        {announcement}
      </p>
    </>
  );
}
