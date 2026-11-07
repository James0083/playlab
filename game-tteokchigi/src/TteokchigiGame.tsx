import {
  Countdown,
  createGameClock,
  createSoundBus,
  GameShell,
  getAudioContext,
  goHome,
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
  idleBeatsAt,
  judge,
  MAX_IDLE_BEATS,
  nearestBeatIndex,
  scheduleBeats,
  type Judgement,
} from './rules.ts';
import { ResultStats } from './ResultStats.tsx';
import { Scene } from './Scene.tsx';
import { comboMultiplier, initialScoreState, scoreTap, type ScoreState } from './scoring.ts';
import { playHitSound } from './sounds.ts';

const SLUG = 'tteokchigi';
/** 시작 화면에서 떡메를 들어 올린 정도(0~1). 끝까지 들어 올려 안내 문구와 겹치지 않게 한다 */
const PREVIEW_MALLET_HEIGHT = 1;
const TITLE = '떡치기';
/** 판정별 진동 패턴(ms). MISS는 짧게 두 번 끊어 실패 느낌을 준다. */
const VIBRATION: Record<Judgement, number | number[]> = {
  GREAT: [30, 20, 40],
  PERFECT: 40,
  GOOD: 20,
  MISS: [10, 30, 10],
};

export function TteokchigiGame() {
  const session = useGameSession({ durationMs: DURATION_MS });
  const { vibrate } = useHaptics();
  const beats = useMemo(() => scheduleBeats(), []);
  const music = useMemo(() => composeBackgroundMusic(beats), [beats]);
  const fieldElements = useRef<FieldElements>({
    mallet: null,
    shadow: null,
    call: null,
    speedUp: null,
  });
  // 아래 값들은 한 판 동안만 유효하다. 플레이 effect가 만들고 정리한다.
  const clock = useRef<GameClock | null>(null);
  const soundOutput = useRef<AudioNode | null>(null);
  const usedBeats = useRef(new Set<number>());
  /** 마지막으로 탭한 게임 시각(ms). 떡메를 내리친 자세로 보여줄 때 쓴다 */
  const lastStrikeMs = useRef<number | null>(null);
  /** 점수 계산 상태. 탭 처리에서 바로 읽어야 해서 ref에 두고, 화면 표시용으로 state에도 복사한다 */
  const scoring = useRef<ScoreState>(initialScoreState());
  const [stats, setStats] = useState<ScoreState>(initialScoreState);
  const [feedback, setFeedback] = useState<TapFeedback | null>(null);
  /** 반응이 없어 끝났는지. 결과 화면 문구에 쓴다 */
  const [endedIdle, setEndedIdle] = useState(false);
  const { phase, end } = session;

  // 판정·애니메이션·효과음이 모두 같은 게임 시계를 쓴다.
  useEffect(() => {
    if (phase !== 'playing') return;
    const audio = getAudioContext();
    const gameClock = createGameClock(audio);
    const bus = audio && gameClock.toAudioTime(0) !== null ? createSoundBus(audio) : null;
    clock.current = gameClock;
    soundOutput.current = bus?.output ?? null;
    usedBeats.current.clear();
    lastStrikeMs.current = null;

    if (bus) scheduleBackgroundMusic(bus.output, music, gameClock.toAudioTime);

    let frame = requestAnimationFrame(function tick() {
      const elapsedMs = gameClock.elapsedMs();
      drawFrame(fieldElements.current, beats, { elapsedMs, lastStrikeMs: lastStrikeMs.current });
      // 박자가 MAX_IDLE_BEATS번 지나도록 탭이 없으면 자리를 비운 것으로 보고 끝낸다
      if (idleBeatsAt(beats, { elapsedMs, lastTapMs: lastStrikeMs.current }) >= MAX_IDLE_BEATS) {
        setEndedIdle(true);
        end();
        return;
      }
      frame = requestAnimationFrame(tick);
    });

    return () => {
      cancelAnimationFrame(frame);
      bus?.dispose();
      clock.current = null;
      soundOutput.current = null;
    };
  }, [phase, beats, music, end]);

  const handleStart = () => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    setFeedback(null);
    setEndedIdle(false);
    scoring.current = initialScoreState();
    setStats(scoring.current);
    session.start();
  };

  const handleTap = () => {
    const gameClock = clock.current;
    if (!gameClock) return;
    const elapsed = gameClock.elapsedMs();
    lastStrikeMs.current = elapsed; // 탭하면 박자와 관계없이 떡메가 떡을 내리친다
    const index = nearestBeatIndex(beats, elapsed);
    // 한 박자에 한 번만 인정해 연타로 점수를 쌓지 못하게 한다.
    const result = usedBeats.current.has(index) ? 'MISS' : judge(elapsed - beats[index]!);
    if (result !== 'MISS') usedBeats.current.add(index);

    const scored = scoreTap(scoring.current, { judgement: result, beatIndex: index });
    scoring.current = scored.state;
    setStats(scored.state);
    session.addScore(scored.delta);
    setFeedback((previous) => ({
      id: (previous?.id ?? 0) + 1,
      judgement: result,
      combo: scored.state.combo,
      multiplier: comboMultiplier(scored.state.combo),
    }));
    vibrate(VIBRATION[result]);
    if (soundOutput.current) playHitSound(soundOutput.current, result);
  };

  // 시작 화면에서는 홈으로, 그 외(카운트다운·플레이·결과)에서는 시작 화면으로 돌아간다
  const handleBack = phase === 'idle' ? goHome : session.reset;

  return (
    <GameShell
      title={TITLE}
      onBack={handleBack}
      score={phase === 'playing' ? session.score : undefined}
      remainingMs={phase === 'playing' ? session.remainingMs : undefined}
    >
      {/* 시작 전에도 장면을 보여줘 무엇을 할지 바로 알 수 있게 한다 */}
      {(phase === 'idle' || phase === 'countdown') && (
        <div className="tt-field">
          <Scene elementsRef={fieldElements} hitId={null} restHeight={PREVIEW_MALLET_HEIGHT} />
          <div className="tt-overlay">
            {phase === 'idle' ? (
              <>
                <p className="tt-guide">
                  떡메가 떡에 닿는 순간 탭!
                  <br />
                  북이 “동” 울릴 때예요.
                </p>
                <button type="button" className="mg-button" onClick={handleStart}>
                  시작
                </button>
              </>
            ) : (
              <Countdown />
            )}
          </div>
        </div>
      )}
      {phase === 'playing' && (
        <PlayField elementsRef={fieldElements} feedback={feedback} onTap={handleTap} />
      )}
      {phase === 'result' && (
        <ScoreResult
          slug={SLUG}
          title={TITLE}
          score={session.score}
          headline={endedIdle ? `${MAX_IDLE_BEATS}번 연속 치지 않아 끝났어요` : '완주!'}
          details={<ResultStats stats={stats} />}
          metadata={{ counts: stats.counts, maxCombo: stats.maxCombo }}
          onRestart={handleStart}
        />
      )}
    </GameShell>
  );
}
