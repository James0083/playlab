import { keyTurns, pointerTurns, ROTATE_KEYS } from '@minigames/engine';
import { useRef, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import type { Stage } from './Dish.tsx';
import { CENTER, DISH_RADIUS } from './geometry.ts';
import type { InputMode } from './ResultStats.tsx';
import { TILT_KEYS, tiltFromKeys, tiltFromPointer } from './rules.ts';

/** 그림(viewBox 240) 기준으로 판 가운데에서 이보다 가까운 곳은 돈 각도를 재지 않는다(팽이 위) */
const MIN_RADIUS_IN_VIEWBOX = 40;

/** 입력의 출처. 키보드는 따로 랭킹을 둔다 */
export type FieldSource = 'pointer' | 'keys';

type Vector = { x: number; y: number };

interface PlayFieldProps {
  stage: Stage;
  inputMode: InputMode;
  /** 스크린리더에 읽어 줄 상태 변화. 플레이 영역은 버튼이라 밖에 둔다 */
  announcement: string;
  /** 돌리기 단계: 원을 그린 만큼(바퀴, 양수 = 시계). 시각은 performance.now 기준 */
  onTurn: (turn: { nowMs: number; turns: number; source: FieldSource }) => void;
  /** 균형 단계: 판 기울기. 손을 떼거나 키를 놓으면 0 */
  onTilt: (tilt: { tilt: Vector; source: FieldSource }) => void;
  children: ReactNode;
}

const HINTS: Record<Stage, Record<InputMode, string>> = {
  spin: {
    motion: '폰을 원 그리듯 한 방향으로 돌려요',
    pointer: '점선을 따라 한 방향으로 원을 그려요 · ↑→↓← 차례로',
    keys: '↑→↓← 차례로 눌러 한 방향으로 돌려요',
  },
  settle: {
    motion: '폰을 편하게 들어요. 기울이면 팽이가 미끄러져요',
    pointer: '누른 곳 쪽으로 판이 기울어요',
    keys: '방향키를 누르고 있으면 그쪽으로 기울어요',
  },
  balance: {
    motion: '폰을 기울여 팽이를 가운데에',
    pointer: '팽이 반대쪽을 눌러 가운데로',
    keys: '방향키로 기울여 가운데로',
  },
  fallen: { motion: '', pointer: '', keys: '' },
};

/** 화면 좌표를 그림 좌표(판 가운데 기준)로 바꾼다 */
function floorPoint(
  field: HTMLElement,
  { clientX, clientY }: { clientX: number; clientY: number },
) {
  const svg = field.querySelector('svg');
  const matrix = svg?.getScreenCTM()?.inverse();
  if (!svg || !matrix) return null;
  const point = new DOMPoint(clientX, clientY).matrixTransform(matrix);
  return { x: point.x - CENTER, y: point.y - CENTER };
}

export function PlayField({
  stage,
  inputMode,
  announcement,
  onTurn,
  onTilt,
  children,
}: PlayFieldProps) {
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null);
  const lastKey = useRef<string | null>(null);
  const pressedKeys = useRef(new Set<string>());

  const relative = (event: PointerEvent<HTMLButtonElement>) =>
    floorPoint(event.currentTarget, event);

  const tiltToward = (point: { x: number; y: number }) => {
    if (stage !== 'balance' && stage !== 'settle') return;
    onTilt({ tilt: tiltFromPointer(point, DISH_RADIUS), source: 'pointer' });
  };

  /** 손을 뗐다: 기울이기를 멈춘다 */
  const release = () => {
    pointer.current = null;
    if (stage !== 'spin') onTilt({ tilt: { x: 0, y: 0 }, source: 'pointer' });
  };

  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    if (pointer.current?.id === event.pointerId) release();
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || pointer.current) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* 캡처하지 못해도 영역 안에서는 움직일 수 있다 */
    }
    const point = relative(event);
    if (!point) return;
    pointer.current = { id: event.pointerId, x: point.x, y: point.y };
    tiltToward(point);
  };

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const previous = pointer.current;
    if (!previous || event.pointerId !== previous.id) return;
    // 창 밖에서 마우스를 떼어 pointerup을 놓쳤으면 누르지 않고 움직이는 것은 입력이 아니다
    if (event.pointerType === 'mouse' && event.buttons === 0) {
      release();
      return;
    }
    const point = relative(event);
    if (!point) return;
    pointer.current = { ...previous, x: point.x, y: point.y };
    if (stage === 'spin') {
      const turns = pointerTurns(previous, point, MIN_RADIUS_IN_VIEWBOX);
      if (turns !== 0) onTurn({ nowMs: performance.now(), turns, source: 'pointer' });
    } else {
      tiltToward(point);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!TILT_KEYS.has(event.key)) return;
    event.preventDefault();
    if (stage === 'spin') {
      if (event.repeat || !ROTATE_KEYS.has(event.key)) return;
      const turns = keyTurns(lastKey.current, event.key);
      lastKey.current = event.key;
      if (turns !== 0) onTurn({ nowMs: performance.now(), turns, source: 'keys' });
      return;
    }
    pressedKeys.current.add(event.key);
    onTilt({ tilt: tiltFromKeys(pressedKeys.current), source: 'keys' });
  };

  const handleKeyUp = (event: KeyboardEvent) => {
    if (!pressedKeys.current.delete(event.key) || stage === 'spin') return;
    onTilt({ tilt: tiltFromKeys(pressedKeys.current), source: 'keys' });
  };

  return (
    <>
      <button
        type="button"
        className="pg-field pg-field-playing"
        aria-label={`팽이 돌리기: ${HINTS[stage][inputMode]}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onLostPointerCapture={handlePointerEnd}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        // 플레이가 시작되면 바로 키보드로 돌릴 수 있게 한다
        autoFocus
      >
        {/* 쓰러진 뒤에는 안내가 없다. 자리는 남겨 그림이 밀리지 않게 한다 */}
        <span className={inputMode === 'motion' ? 'pg-hint' : 'pg-hint pg-hint-strong'}>
          {HINTS[stage][inputMode] || ' '}
        </span>
        {children}
      </button>
      <p className="pg-sr-only" role="status">
        {announcement}
      </p>
    </>
  );
}
