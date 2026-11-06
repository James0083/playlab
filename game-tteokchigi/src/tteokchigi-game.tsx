import { Countdown, GameShell, ScoreResult, useGameSession, useHaptics } from '@minigames/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DURATION_MS,
  judge,
  nearestBeatIndex,
  pestleHeight,
  POINTS,
  scheduleBeats,
  type Judgement,
} from './rules';

const SLUG = 'tteokchigi';
const TITLE = '떡치기';
const PESTLE_TRAVEL_PX = 180;

export function TteokchigiGame() {
  const session = useGameSession({ durationMs: DURATION_MS });
  const { vibrate } = useHaptics();
  const beats = useMemo(() => scheduleBeats(), []);
  const pestle = useRef<HTMLDivElement>(null);
  const usedBeats = useRef(new Set<number>());
  const [judgement, setJudgement] = useState<Judgement | null>(null);
  const { phase, startedAt } = session;

  // 애니메이션과 판정이 같은 시계를 쓰도록 rAF로 위치를 계산한다.
  // TODO: 사운드를 붙일 때 시계를 AudioContext.currentTime으로 교체한다.
  useEffect(() => {
    if (phase !== 'playing' || startedAt === null) return;
    usedBeats.current.clear();
    setJudgement(null);
    let frame = requestAnimationFrame(function tick() {
      const height = pestleHeight(beats, performance.now() - startedAt);
      if (pestle.current)
        pestle.current.style.transform = `translateY(${-height * PESTLE_TRAVEL_PX}px)`;
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [phase, startedAt, beats]);

  const onTap = () => {
    if (startedAt === null) return;
    const elapsed = performance.now() - startedAt;
    const index = nearestBeatIndex(beats, elapsed);
    // 한 박자에 한 번만 인정해 연타로 점수를 쌓지 못하게 한다.
    const result = usedBeats.current.has(index) ? 'MISS' : judge(elapsed - beats[index]!);
    if (result !== 'MISS') usedBeats.current.add(index);
    session.addScore(POINTS[result]);
    setJudgement(result);
    vibrate(result === 'PERFECT' ? 40 : result === 'GOOD' ? 20 : [10, 30, 10]);
  };

  return (
    <GameShell
      title={TITLE}
      score={phase === 'playing' ? session.score : undefined}
      remainingMs={phase === 'playing' ? session.remainingMs : undefined}
    >
      {phase === 'idle' && (
        <>
          <p className="mg-muted">절굿공이가 맨 위에 닿는 순간 탭하세요.</p>
          <button type="button" className="mg-button" onClick={session.start}>
            시작
          </button>
        </>
      )}
      {phase === 'countdown' && <Countdown />}
      {phase === 'playing' && (
        <button type="button" className="tt-field" aria-label="떡 치기" onPointerDown={onTap}>
          <span className="tt-judgement" role="status">
            {judgement}
          </span>
          <div ref={pestle} className="tt-pestle" />
          <div className="tt-mochi" />
        </button>
      )}
      {phase === 'result' && (
        <ScoreResult slug={SLUG} title={TITLE} score={session.score} onRestart={session.reset} />
      )}
    </GameShell>
  );
}
