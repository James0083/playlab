import {
  GameShell,
  goHome,
  readStorage,
  unlockAudio,
  useGameSession,
  useHaptics,
  writeStorage,
} from '@minigames/engine';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
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
import type { FinaleKind } from './Finale.tsx';
import { DalgonaResult, type Outcome } from './ResultDetails.tsx';
import { ShapePicker } from './ShapePicker.tsx';
import { getShape, SHAPES, type Point } from './shapes.ts';
import { playBreak, playComplete, playCrack } from './sounds.ts';
import { liftNeedle, startTrace, traceMove, type TraceState } from './trace.ts';

const SLUG = 'dalgona';
const TITLE = '달고나 뽑기';
const UNLOCK_KEY = 'dalgona:unlocked';
const CRACK_VIBRATION = [30, 40, 30];
const BREAK_VIBRATION = 200;
/** 판이 끝난 뒤 결과 화면으로 넘어가기 전 연출 시간(ms). 모양이 떠오르거나 과자가 갈라지는 장면 */
const FINALE_MS: Record<FinaleKind, number> = { complete: 1_200, broken: 1_000 };

/** 포인터 이벤트 사이에 브라우저가 묶어 둔 중간 위치까지 모두 꺼낸다(빠른 드래그도 촘촘히 검사) */
function pointerSamples(event: PointerEvent<SVGSVGElement>): MouseEvent[] {
  const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? [];
  return coalesced.length > 0 ? coalesced : [event.nativeEvent];
}

/** 결과 화면에 "다음: (모양)"으로 보여줄 모양. 같은 모양을 다시 하면 null */
function shapeAfter(index: number, nextIndex: number) {
  return nextIndex === index ? null : getShape(nextIndex);
}

export function DalgonaGame() {
  // 카운트다운 없이 판을 보여주고, 바늘을 처음 댈 때부터 시간을 잰다(반응 속도를 겨루는 게임이 아니다).
  // 엔진의 countdown 단계를 '준비' 상태로 쓴다
  const session = useGameSession({ durationMs: TIME_LIMIT_MS, countdownMs: null });
  const { vibrate } = useHaptics();
  const [unlockedCount, setUnlockedCount] = useState(() =>
    parseUnlockedCount(readStorage(UNLOCK_KEY), SHAPES.length),
  );
  const [shapeIndex, setShapeIndex] = useState(0);
  const [crackPoints, setCrackPoints] = useState<Point[]>([]);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [precision, setPrecision] = useState(1);
  /** 끝나는 연출 중이면 그 종류. 연출 중에는 입력을 받지 않는다 */
  const [finale, setFinale] = useState<FinaleKind | null>(null);
  // 긁는 동안 매 이벤트 바뀌는 값은 ref에 둔다(화면은 drawTrace가 직접 갱신)
  const trace = useRef<TraceState | null>(null);
  const needle = useRef<Point | null>(null);
  const boardElements = useRef<BoardElements>({
    trail: { layer: null, current: null, last: null },
    needle: null,
    progress: null,
  });
  const shape = getShape(shapeIndex);
  const { phase, end } = session;
  const isReady = phase === 'countdown';
  /** 판을 보여주는 단계(준비 또는 플레이) */
  const showsBoard = isReady || phase === 'playing';
  /** 끝나는 연출 중이 아니면 긁을 수 있다 */
  const canScrape = showsBoard && finale === null;

  // 연출이 끝나면 결과 화면으로 넘어간다
  useEffect(() => {
    if (finale === null) return;
    const id = setTimeout(end, FINALE_MS[finale]);
    return () => clearTimeout(id);
  }, [finale, end]);

  const handleSelect = (index: number) => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    setShapeIndex(index);
    setCrackPoints([]);
    setOutcome(null);
    setFinale(null);
    trace.current = startTrace(getShape(index));
    needle.current = null;
    // 이전 판에서 긁던 도중 끝났으면 자국 상태가 남아 있다. 새 판의 첫 획이 보이지 않는 문제를 막는다
    endTrail(boardElements.current.trail);
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
    endTrail(boardElements.current.trail);
    setFinale(result === 'complete' ? 'complete' : 'broken');
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!canScrape) return;
    if (isReady) session.begin(); // 첫 터치에서 시간이 가기 시작한다
    // 손가락이 판 밖으로 나가도 계속 이벤트를 받는다
    event.currentTarget.setPointerCapture(event.pointerId);
    needle.current = toBoardPoint(event.currentTarget, event.nativeEvent);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const before = trace.current;
    let from = needle.current;
    if (!canScrape || !before || !from) return;

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
    if (!trace.current) return;
    trace.current = liftNeedle(trace.current); // 다음에 댄 곳을 지금 자리와 잇지 않는다
    drawTrace(boardElements.current, { trace: trace.current, needle: null });
  };

  const nextIndex = nextShapeIndex({
    isComplete: outcome === 'complete',
    index: shapeIndex,
    total: SHAPES.length,
  });
  const nextShape = shapeAfter(shapeIndex, nextIndex);

  const backToPicker = () => {
    setFinale(null);
    session.reset();
  };
  // 모양 선택 화면에서는 홈으로, 그 외(준비·플레이·결과)에서는 모양 선택으로 돌아간다
  const handleBack = phase === 'idle' ? goHome : backToPicker;

  return (
    <GameShell
      title={TITLE}
      remainingMs={showsBoard ? session.remainingMs : undefined}
      onBack={handleBack}
    >
      {phase === 'idle' && (
        <ShapePicker
          slug={SLUG}
          shapes={SHAPES}
          unlockedCount={unlockedCount}
          onSelect={handleSelect}
        />
      )}
      {showsBoard && (
        <Board
          shape={shape}
          crackPoints={crackPoints}
          finale={finale}
          overlay={isReady ? <p className="dg-ready">선에 바늘을 대면 시작해요</p> : null}
          elementsRef={boardElements}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
      )}
      {phase === 'result' && (
        <DalgonaResult
          slug={SLUG}
          title={TITLE}
          score={session.score}
          shape={shape}
          nextShape={nextShape}
          outcome={outcome ?? 'timeout'}
          precision={precision}
          cracks={crackPoints.length}
          onRestart={() => handleSelect(nextIndex)}
          onPickShape={backToPicker}
        />
      )}
    </GameShell>
  );
}
