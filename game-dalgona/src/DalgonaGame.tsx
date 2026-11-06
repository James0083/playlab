import {
  Countdown,
  GameShell,
  goHome,
  readStorage,
  ScoreResult,
  unlockAudio,
  useGameSession,
  useHaptics,
  writeStorage,
} from '@minigames/engine';
import { useRef, useState, type PointerEvent } from 'react';
import {
  Board,
  drawTrace,
  endTrail,
  extendTrail,
  toBoardPoint,
  type BoardElements,
} from './Board.tsx';
import {
  finalScore,
  isBroken,
  isComplete,
  nextShapeIndex,
  parseUnlockedCount,
  precisionOf,
  TIME_LIMIT_MS,
  unlockAfterClear,
} from './rules.ts';
import { ShapePicker } from './ShapePicker.tsx';
import { getShape, SHAPES, type Point } from './shapes.ts';
import { playBreak, playComplete, playCrack } from './sounds.ts';
import { startTrace, traceMove, type TraceState } from './trace.ts';

const SLUG = 'dalgona';
const TITLE = '달고나 뽑기';
const UNLOCK_KEY = 'dalgona:unlocked';
const CRACK_VIBRATION = [30, 40, 30];
const BREAK_VIBRATION = 200;

type Outcome = 'complete' | 'broken' | 'timeout';

const HEADLINES: Record<Outcome, string> = {
  complete: '완성!',
  broken: '깨졌어요!',
  timeout: '시간 초과!',
};

/** 포인터 이벤트 사이에 브라우저가 묶어 둔 중간 위치까지 모두 꺼낸다(빠른 드래그도 촘촘히 검사) */
function pointerSamples(event: PointerEvent<SVGSVGElement>): MouseEvent[] {
  const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
  return coalesced.length > 0 ? coalesced : [event.nativeEvent];
}

export function DalgonaGame() {
  const session = useGameSession({ durationMs: TIME_LIMIT_MS });
  const { vibrate } = useHaptics();
  const [unlockedCount, setUnlockedCount] = useState(() =>
    parseUnlockedCount(readStorage(UNLOCK_KEY), SHAPES.length),
  );
  const [shapeIndex, setShapeIndex] = useState(0);
  const [crackPoints, setCrackPoints] = useState<Point[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [precision, setPrecision] = useState(1);
  // 긁는 동안 매 이벤트 바뀌는 값은 ref에 둔다(화면은 drawTrace가 직접 갱신)
  const trace = useRef<TraceState | null>(null);
  const needle = useRef<Point | null>(null);
  const boardElements = useRef<BoardElements>({
    trail: { layer: null, current: null, last: null },
    needle: null,
    progress: null,
  });
  const shape = getShape(shapeIndex);
  const { phase } = session;

  const handleSelect = (index: number) => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    setShapeIndex(index);
    setCrackPoints([]);
    setOutcome(null);
    trace.current = startTrace(getShape(index));
    needle.current = null;
    session.start();
  };

  const finish = (result: Outcome, finished: TraceState) => {
    if (result === 'complete') {
      session.addScore(finalScore(shape, finished));
      const next = unlockAfterClear(unlockedCount, shapeIndex, SHAPES.length);
      setUnlockedCount(next);
      writeStorage(UNLOCK_KEY, String(next));
      playComplete();
    } else {
      vibrate(BREAK_VIBRATION);
      playBreak();
    }
    setPrecision(precisionOf(finished));
    setOutcome(result);
    session.end();
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (phase !== 'playing') return;
    // 손가락이 판 밖으로 나가도 계속 이벤트를 받는다
    event.currentTarget.setPointerCapture(event.pointerId);
    needle.current = toBoardPoint(event.currentTarget, event.nativeEvent);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const before = trace.current;
    let from = needle.current;
    if (phase !== 'playing' || !before || !from) return;

    let after = before;
    for (const sample of pointerSamples(event)) {
      const to = toBoardPoint(event.currentTarget, sample);
      after = traceMove(after, shape, { from, to });
      extendTrail(boardElements.current.trail, shape, { from, to });
      from = to;
    }
    trace.current = after;
    needle.current = from;
    drawTrace(boardElements.current, { trace: after, needle: from });

    if (after.cracks > before.cracks) {
      setCrackPoints(after.crackPoints);
      vibrate(CRACK_VIBRATION);
      playCrack();
    }
    if (isBroken(after)) finish('broken', after);
    else if (isComplete(after)) finish('complete', after);
  };

  const handlePointerUp = () => {
    needle.current = null;
    endTrail(boardElements.current.trail); // 손을 떼면 긁은 자국도 끊긴다
    if (trace.current) drawTrace(boardElements.current, { trace: trace.current, needle: null });
  };

  const nextIndex = nextShapeIndex({
    isComplete: outcome === 'complete',
    index: shapeIndex,
    total: SHAPES.length,
  });

  // 모양 선택 화면에서는 홈으로, 그 외(카운트다운·플레이·결과)에서는 모양 선택으로 돌아간다
  const handleBack = phase === 'idle' ? goHome : session.reset;

  return (
    <GameShell
      title={TITLE}
      remainingMs={phase === 'playing' ? session.remainingMs : undefined}
      onBack={handleBack}
    >
      {phase === 'idle' && (
        <ShapePicker shapes={SHAPES} unlockedCount={unlockedCount} onSelect={handleSelect} />
      )}
      {phase === 'countdown' && <Countdown />}
      {phase === 'playing' && (
        <Board
          shape={shape}
          crackPoints={crackPoints}
          elementsRef={boardElements}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
      {phase === 'result' && (
        <ScoreResult
          slug={SLUG}
          title={`${TITLE} ${shape.name}`}
          score={session.score}
          headline={HEADLINES[outcome ?? 'timeout']}
          metadata={{ shape: shape.id, cracks: crackPoints.length, precision }}
          onRestart={() => handleSelect(nextIndex)}
          restartLabel={
            nextIndex === shapeIndex ? '다시 하기' : `다음: ${getShape(nextIndex).name}`
          }
          secondaryAction={{ label: '모양 고르기', onClick: session.reset }}
        />
      )}
    </GameShell>
  );
}
