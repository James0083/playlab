import {
  backGoesHome,
  createGameClock,
  GameShell,
  getAudioContext,
  goHome,
  ScoreResult,
  StartOverlay,
  unlockAudio,
  useGameSession,
  useHaptics,
  type GameClock,
} from '@minigames/engine';
import { useEffect, useEffectEvent, useRef, useState, type KeyboardEvent } from 'react';
import { fallingHeight, heightAt } from './motion.ts';
import { headlineOf, metadataOf, ResultStats, type RoundResult } from './ResultStats.tsx';
import {
  applyElapsed,
  applyTap,
  kickTimeMs,
  MAX_KICKS,
  multiplierOf,
  startRound,
  type Judgement,
  type RoundState,
} from './rules.ts';
import { createSceneElements, drawScene, Scene } from './Scene.tsx';
import { playDrop, playKick } from './sounds.ts';

const SLUG = 'jegi';
const TITLE = '제기차기';
/** 끝나는 연출(제기가 땅에 떨어짐) 시간(ms). 끝나고 결과 화면으로 넘어간다 */
const FINALE_MS = 900;
/** 차는 시각 앞뒤로 이 시간(ms) 안에서 점선 원이 점점 진해진다 */
const NEARNESS_MS = 400;
/** 시작 화면에서 제기가 떠 있는 높이(발등 기준). 시작 카드가 위쪽에 있어 카드 밑에 둔다 */
const IDLE_HEIGHT = 60;
const KICK_VIBRATION: Record<Judgement, number> = { PERFECT: 25, GOOD: 12 };
const MISS_VIBRATION = [60, 40, 120];
/** 키보드로 칠 때 쓰는 키. 꾹 누를 때의 자동 반복은 무시한다 */
const TAP_KEYS = new Set([' ', 'Enter']);
const AWAY_NOTICE = '다른 화면으로 나가서 판을 멈췄어요. 다시 시작해 주세요.';

/** 판정 문구와 연속 표시. key가 바뀌면 문구가 다시 튄다 */
interface Shown {
  judgement: Judgement | null;
  kicks: number;
  key: number;
}
const NO_SHOWN: Shown = { judgement: null, kicks: 0, key: 0 };

function isMotionReduced(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function JegiGame() {
  const session = useGameSession({ durationMs: null });
  const { vibrate } = useHaptics();
  const [shown, setShown] = useState<Shown>(NO_SHOWN);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [notice, setNotice] = useState('');
  // 아래 값은 한 판 동안만 유효하다. 프레임마다 바뀌므로 ref에 둔다
  const clock = useRef<GameClock | null>(null);
  const round = useRef<RoundState>(startRound());
  const lastKickMs = useRef<number | null>(null);
  /** 끝난 순간(시각, 그때 제기 높이). 끝난 뒤 제기가 떨어지는 그림에 쓴다 */
  const endedAt = useRef<{ elapsedMs: number; height: number } | null>(null);
  const sceneElements = useRef(createSceneElements());
  const { phase, end } = session;

  /** 시작 화면·카운트다운에서는 제기가 발등 위에 떠 있는 장면만 보여준다 */
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'countdown') return;
    drawScene(sceneElements.current, {
      height: IDLE_HEIGHT,
      timeMs: 0,
      sinceKickMs: null,
      nearness: 0,
      isMotionReduced: true,
    });
  }, [phase]);

  /** 한 프레임: 놓침 검사, 제기·발 그리기 */
  const tick = useEffectEvent((): void => {
    const gameClock = clock.current;
    if (!gameClock) return;
    const elapsedMs = gameClock.elapsedMs();
    if (!round.current.isOver) {
      const next = applyElapsed(round.current, elapsedMs);
      if (next.isOver) finishRound(next, elapsedMs);
    }
    const ended = endedAt.current;
    const state = round.current;
    const height = ended
      ? fallingHeight({ fromHeight: ended.height, sinceMs: elapsedMs - ended.elapsedMs })
      : heightAt({ elapsedMs, index: state.kicks });
    const distanceMs = Math.abs(elapsedMs - kickTimeMs(state.kicks));
    drawScene(sceneElements.current, {
      height,
      timeMs: elapsedMs,
      sinceKickMs: lastKickMs.current === null ? null : elapsedMs - lastKickMs.current,
      nearness: ended ? 0 : Math.max(0, 1 - distanceMs / NEARNESS_MS),
      isMotionReduced: isMotionReduced(),
    });
  });

  useEffect(() => {
    if (phase !== 'playing') return;
    clock.current = createGameClock(getAudioContext());
    round.current = startRound();
    lastKickMs.current = null;
    endedAt.current = null;
    let frame = requestAnimationFrame(function draw() {
      tick();
      frame = requestAnimationFrame(draw);
    });
    return () => {
      cancelAnimationFrame(frame);
      clock.current = null;
    };
  }, [phase]);

  // 제기가 떨어지는 연출이 끝나면 결과 화면으로 넘어간다
  useEffect(() => {
    if (!isEnding || phase !== 'playing') return;
    const id = setTimeout(end, FINALE_MS);
    return () => clearTimeout(id);
  }, [isEnding, phase, end]);

  /** 판이 끝났다: 상태를 굳히고 떨어지는 연출·소리·진동을 시작한다 */
  const finishRound = (state: RoundState, elapsedMs: number) => {
    const height = heightAt({ elapsedMs, index: state.kicks });
    round.current = state;
    endedAt.current = { elapsedMs, height };
    if (state.reason === null) return;
    setResult({ kicks: state.kicks, perfects: state.perfects, reason: state.reason });
    setIsEnding(true);
    if (state.reason !== 'cleared') {
      playDrop();
      vibrate(MISS_VIBRATION);
    }
  };

  const handleTap = () => {
    const gameClock = clock.current;
    const before = round.current;
    if (!gameClock || before.isOver) return;
    const elapsedMs = gameClock.elapsedMs();
    const next = applyTap(before, elapsedMs);
    if (next.kicks > before.kicks) {
      const judgement: Judgement = next.perfects > before.perfects ? 'PERFECT' : 'GOOD';
      session.addScore(next.score - before.score);
      lastKickMs.current = elapsedMs;
      playKick(judgement);
      vibrate(KICK_VIBRATION[judgement]);
      setShown((current) => ({ judgement, kicks: next.kicks, key: current.key + 1 }));
    }
    if (next.isOver) finishRound(next, elapsedMs);
    else round.current = next;
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!TAP_KEYS.has(event.key) || event.repeat) return;
    event.preventDefault();
    handleTap();
  };

  const clearRound = () => {
    round.current = startRound();
    lastKickMs.current = null;
    endedAt.current = null;
    setShown(NO_SHOWN);
    setResult(null);
    setIsEnding(false);
  };

  const backToStart = () => {
    clearRound();
    session.reset();
  };

  // 플레이 중 다른 화면으로 나가면 그동안 칠 수 없는데 제기는 계속 움직인다. 판을 멈추고 시작 화면으로 돌린다
  const handleHidden = useEffectEvent(() => {
    setNotice(AWAY_NOTICE);
    backToStart();
  });
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'countdown') return;
    const handleVisibilityChange = () => {
      if (document.hidden) handleHidden();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [phase]);

  const handleStart = () => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    clearRound();
    setNotice('');
    session.start();
  };

  const handleBack = backGoesHome(phase) ? goHome : backToStart;
  const multiplier = multiplierOf(shown.kicks);

  return (
    <GameShell
      title={TITLE}
      onBack={handleBack}
      score={phase === 'playing' ? session.score : undefined}
    >
      {(phase === 'idle' || phase === 'countdown') && (
        <div className="jg-field">
          <Scene elementsRef={sceneElements} />
          <StartOverlay
            isCounting={phase === 'countdown'}
            notice={notice}
            align="top"
            onStart={handleStart}
          >
            <p className="mg-start-guide">
              제기가 발등의 점선 원에 닿는 순간 탭!
              <br />
              일찍 치거나 놓치면 바로 끝나요. 최대 {MAX_KICKS}번
            </p>
          </StartOverlay>
        </div>
      )}
      {phase === 'playing' && (
        <button
          type="button"
          className="jg-field jg-field-playing"
          aria-label="차기 (스페이스, 엔터)"
          onPointerDown={handleTap}
          onKeyDown={handleKeyDown}
          // 플레이가 시작되면 바로 키보드로 칠 수 있게 한다
          autoFocus
        >
          <Scene elementsRef={sceneElements} />
          <span className="jg-hud">
            <span className="jg-count">
              {shown.kicks}번 <b>×{multiplier}</b>
            </span>
            {shown.judgement && !isEnding && (
              <span key={shown.key} className={`jg-judge jg-judge-${shown.judgement}`}>
                {shown.judgement}
              </span>
            )}
          </span>
        </button>
      )}
      {phase === 'result' && result && (
        <ScoreResult
          slug={SLUG}
          title={TITLE}
          score={session.score}
          headline={headlineOf(result)}
          details={<ResultStats result={result} />}
          metadata={metadataOf(result)}
          onRestart={handleStart}
        />
      )}
    </GameShell>
  );
}
