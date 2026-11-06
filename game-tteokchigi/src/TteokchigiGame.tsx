import {
  Countdown,
  createGameClock,
  createSoundBus,
  GameShell,
  getAudioContext,
  ScoreResult,
  unlockAudio,
  useGameSession,
  useHaptics,
  type GameClock,
} from '@minigames/engine';
import { useEffect, useMemo, useRef, useState } from 'react';
import { composeBackgroundMusic, scheduleBackgroundMusic } from './music.ts';
import { drawFrame, PlayField, type FieldElements, type TapFeedback } from './PlayField.tsx';
import {
  DURATION_MS,
  judge,
  nearestBeatIndex,
  POINTS,
  scheduleBeats,
  type Judgement,
} from './rules.ts';
import { playHitSound } from './sounds.ts';

const SLUG = 'tteokchigi';
const TITLE = '떡치기';
/** 판정별 진동 패턴(ms). MISS는 짧게 두 번 끊어 실패 느낌을 준다. */
const VIBRATION: Record<Judgement, number | number[]> = {
  PERFECT: 40,
  GOOD: 20,
  MISS: [10, 30, 10],
};

export function TteokchigiGame() {
  const session = useGameSession({ durationMs: DURATION_MS });
  const { vibrate } = useHaptics();
  const beats = useMemo(() => scheduleBeats(), []);
  const music = useMemo(() => composeBackgroundMusic(beats), [beats]);
  const fieldElements = useRef<FieldElements>({ pestle: null, call: null, speedUp: null });
  // 아래 값들은 한 판 동안만 유효하다. 플레이 effect가 만들고 정리한다.
  const clock = useRef<GameClock | null>(null);
  const soundOutput = useRef<AudioNode | null>(null);
  const usedBeats = useRef(new Set<number>());
  const [feedback, setFeedback] = useState<TapFeedback | null>(null);
  const { phase } = session;

  // 판정·애니메이션·효과음이 모두 같은 게임 시계를 쓴다.
  useEffect(() => {
    if (phase !== 'playing') return;
    const audio = getAudioContext();
    const gameClock = createGameClock(audio);
    const bus = audio && gameClock.toAudioTime(0) !== null ? createSoundBus(audio) : null;
    clock.current = gameClock;
    soundOutput.current = bus?.output ?? null;
    usedBeats.current.clear();

    if (bus) scheduleBackgroundMusic(bus.output, music, gameClock.toAudioTime);

    let frame = requestAnimationFrame(function tick() {
      drawFrame(fieldElements.current, beats, gameClock.elapsedMs());
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
      bus?.dispose();
      clock.current = null;
      soundOutput.current = null;
    };
  }, [phase, beats, music]);

  const handleStart = () => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    setFeedback(null);
    session.start();
  };

  const handleTap = () => {
    const gameClock = clock.current;
    if (!gameClock) return;
    const elapsed = gameClock.elapsedMs();
    const index = nearestBeatIndex(beats, elapsed);
    // 한 박자에 한 번만 인정해 연타로 점수를 쌓지 못하게 한다.
    const result = usedBeats.current.has(index) ? 'MISS' : judge(elapsed - beats[index]!);
    if (result !== 'MISS') usedBeats.current.add(index);

    session.addScore(POINTS[result]);
    setFeedback((previous) => ({ id: (previous?.id ?? 0) + 1, judgement: result }));
    vibrate(VIBRATION[result]);
    if (soundOutput.current) playHitSound(soundOutput.current, result);
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
          <button type="button" className="mg-button" onClick={handleStart}>
            시작
          </button>
        </>
      )}
      {phase === 'countdown' && <Countdown />}
      {phase === 'playing' && (
        <PlayField elementsRef={fieldElements} feedback={feedback} onTap={handleTap} />
      )}
      {phase === 'result' && (
        <ScoreResult slug={SLUG} title={TITLE} score={session.score} onRestart={session.reset} />
      )}
    </GameShell>
  );
}
