import {
  GameShell,
  goHome,
  ScoreResult,
  unlockAudio,
  useDeviceMotion,
  useGameSession,
  useHaptics,
  type MotionSample,
} from '@minigames/engine';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { createCupElements, Cup, drawCup } from './Cup.tsx';
import { ReadyField } from './ReadyField.tsx';
import { ResultStats, type InputMode } from './ResultStats.tsx';
import {
  applyShake,
  DURATION_MS,
  finalResult,
  intensityFromAcceleration,
  MAX_INTENSITY,
  mixRatio,
  startShake,
  type ShakeResult,
} from './rules.ts';
import { ShakeField } from './ShakeField.tsx';
import { playFinish, playRattle, playSpill } from './sounds.ts';

const SLUG = 'bubble-tea';
const TITLE = '버블티 흔들기';
/** 입력 방식마다 랭킹을 따로 둔다. 폰 흔들기와 마우스 문지르기는 같은 점수로 겨루기 어렵다 */
const BOARD: Record<InputMode, string> = { motion: 'shake', pointer: 'pointer' };
/** 시간이 끝난 뒤 빨대가 꽂히는 연출 시간(ms). 끝나고 결과 화면으로 넘어간다 */
const FINALE_MS = 1_200;
const SPILL_VIBRATION = [40, 30, 40];
/** 달그락 소리 사이 최소 간격(ms)과 소리가 나는 최소 세기. 센서 이벤트마다 내면 소리가 뭉개진다 */
const RATTLE_GAP_MS = 90;
const RATTLE_MIN_INTENSITY = 4;
/** 화면의 흔들림은 매 프레임 이 비율만큼 최근 세기 쪽으로 다가간다(센서 값이 튀어도 부드럽게 보이게) */
const DISPLAY_SMOOTHING = 0.25;
/** 입력이 끊기면 최근 세기가 매 프레임 이 비율로 줄어 컵이 서서히 멈춘다 */
const INTENSITY_DECAY = 0.9;
/** 남은 시간 표시 갱신 주기. 화면에는 초 단위로만 보인다 */
const REMAINING_TICK_MS = 100;
/** 남은 시간을 빨갛게 보여주는 시점. 10초 게임이라 엔진 기본값(10초)이면 처음부터 빨갛다 */
const URGENT_MS = 3_000;

function headlineOf(result: ShakeResult): string {
  if (result.mixPercent < 100) return '덜 섞였어요';
  if (result.spills === 0) return '완벽한 버블티!';
  return '완성! 조금 흘렸어요';
}

export function BubbleTeaGame() {
  // 끝나는 연출을 넣기 위해 시간은 게임이 직접 잰다(엔진 타이머는 시간이 다 되면 바로 결과로 넘긴다)
  const session = useGameSession({ durationMs: null });
  const { vibrate } = useHaptics();
  const [inputMode, setInputMode] = useState<InputMode>('pointer');
  const [spills, setSpills] = useState(0);
  const [remainingMs, setRemainingMs] = useState(DURATION_MS);
  const [result, setResult] = useState<ShakeResult | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  // 흔드는 동안 매 이벤트 바뀌는 값은 ref에 둔다(화면은 drawCup이 직접 갱신)
  const cupElements = useRef(createCupElements());
  const shake = useRef(startShake());
  const startMs = useRef<number | null>(null);
  const latestIntensity = useRef(0);
  const lastRattleMs = useRef(-Infinity);
  const { phase, end } = session;
  const canShake = phase === 'playing' && !isFinished;

  /** 흔들기 한 번을 반영한다. 시각은 performance.now 기준 */
  const addSample = (nowMs: number, intensity: number) => {
    if (!canShake || startMs.current === null) return;
    const before = shake.current;
    const after = applyShake(before, { atMs: nowMs - startMs.current, intensity });
    shake.current = after;
    latestIntensity.current = Math.max(latestIntensity.current, intensity);
    if (after.spills > before.spills) {
      setSpills(after.spills);
      vibrate(SPILL_VIBRATION);
      playSpill();
    } else if (intensity >= RATTLE_MIN_INTENSITY && nowMs - lastRattleMs.current >= RATTLE_GAP_MS) {
      lastRattleMs.current = nowMs;
      playRattle(intensity / MAX_INTENSITY);
    }
  };

  const handleMotion = (sample: MotionSample) => {
    // 카운트다운 동안 센서 값이 들어오면 폰 흔들기로 플레이한다. 안 들어오면 마우스·터치로 한다
    if (phase === 'countdown') {
      setInputMode('motion');
      return;
    }
    if (inputMode === 'motion') {
      addSample(performance.now(), intensityFromAcceleration(sample.acceleration));
    }
  };
  const motion = useDeviceMotion(handleMotion, phase === 'countdown' || phase === 'playing');

  const finish = useEffectEvent(() => {
    const outcome = finalResult(shake.current);
    session.addScore(outcome.score);
    setResult(outcome);
    setRemainingMs(0);
    setIsFinished(true);
    playFinish();
  });

  useEffect(() => {
    if (phase !== 'playing') return;
    const start = performance.now();
    startMs.current = start;
    let displayIntensity = 0;

    let frame = requestAnimationFrame(function draw() {
      const elapsedMs = performance.now() - start;
      displayIntensity += (latestIntensity.current - displayIntensity) * DISPLAY_SMOOTHING;
      latestIntensity.current *= INTENSITY_DECAY;
      const isOver = elapsedMs >= DURATION_MS;
      drawCup(cupElements.current, {
        // 끝나면 컵을 바로 세워 빨대 연출을 보여준다
        intensity: isOver ? 0 : displayIntensity,
        mix: mixRatio(shake.current),
        timeMs: elapsedMs,
      });
      if (isOver) {
        finish();
        return;
      }
      frame = requestAnimationFrame(draw);
    });
    const timer = setInterval(
      () => setRemainingMs(Math.max(DURATION_MS - (performance.now() - start), 0)),
      REMAINING_TICK_MS,
    );
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      startMs.current = null;
    };
  }, [phase]);

  // 연출이 끝나면 결과 화면으로 넘어간다
  useEffect(() => {
    if (!isFinished || phase !== 'playing') return;
    const id = setTimeout(end, FINALE_MS);
    return () => clearTimeout(id);
  }, [isFinished, phase, end]);

  const startRound = () => {
    shake.current = startShake();
    latestIntensity.current = 0;
    setInputMode('pointer');
    setSpills(0);
    setResult(null);
    setIsFinished(false);
    setRemainingMs(DURATION_MS);
    session.start();
  };

  const handleStart = () => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    // iOS는 동작 센서 권한도 탭 안에서 물어야 한다. 답을 받은 뒤에 카운트다운을 시작해야
    // 카운트다운 동안 센서 값이 들어와 폰 흔들기로 플레이할 수 있다(거부하면 문질러 흔들기)
    if (motion.status === 'needs-permission') {
      void motion.requestPermission().then(startRound);
      return;
    }
    startRound();
  };

  const backToStart = () => {
    setIsFinished(false);
    session.reset();
  };
  // 시작 화면에서는 홈으로, 그 외(카운트다운·플레이·결과)에서는 시작 화면으로 돌아간다
  const handleBack = phase === 'idle' ? goHome : backToStart;
  const cup = <Cup elementsRef={cupElements} spills={spills} isFinished={isFinished} />;

  return (
    <GameShell
      title={TITLE}
      onBack={handleBack}
      remainingMs={phase === 'playing' ? remainingMs : undefined}
      urgentMs={URGENT_MS}
    >
      {(phase === 'idle' || phase === 'countdown') && (
        <ReadyField
          isCounting={phase === 'countdown'}
          motionStatus={motion.status}
          onStart={handleStart}
        >
          {cup}
        </ReadyField>
      )}
      {phase === 'playing' && (
        <ShakeField inputMode={inputMode} onShake={addSample}>
          {cup}
        </ShakeField>
      )}
      {phase === 'result' && result && (
        <ScoreResult
          slug={SLUG}
          board={BOARD[inputMode]}
          title={TITLE}
          score={session.score}
          headline={headlineOf(result)}
          details={<ResultStats result={result} inputMode={inputMode} />}
          metadata={{ inputMode, ...result }}
          onRestart={handleStart}
        />
      )}
    </GameShell>
  );
}
