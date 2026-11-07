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
import { drawHud } from './Hud.tsx';
import { ReadyField } from './ReadyField.tsx';
import { ResultStats, type InputMode } from './ResultStats.tsx';
import {
  applyShake,
  DURATION_MS,
  envelopeAt,
  finalResult,
  intensityFromMotion,
  MAX_INTENSITY,
  mixRatio,
  NOISE_FLOOR,
  rateSecond,
  SECONDS,
  SPILL_PENALTY,
  startShake,
  WARNING_ENVELOPE,
  type ShakeResult,
} from './rules.ts';
import { ShakeField, type ShakeSource } from './ShakeField.tsx';
import { playFinish, playFullyMixed, playRattle, playSpill, playWarning } from './sounds.ts';

const SLUG = 'bubble-tea';
const TITLE = '버블티 흔들기';
/** 입력 방식마다 랭킹을 따로 둔다. 폰 흔들기·문지르기·키보드는 같은 점수로 겨루기 어렵다 */
const BOARD: Record<InputMode, string> = { motion: 'shake', pointer: 'pointer', keys: 'keys' };
/** 시간이 끝난 뒤 빨대가 꽂히는 연출 시간(ms). 끝나고 결과 화면으로 넘어간다 */
const FINALE_MS = 1_200;
const SPILL_VIBRATION = [40, 30, 40];
/** 경고 구간에 들어갈 때 짧은 진동(ms). 흔드는 중이라 소리를 주로 쓰고 진동은 보조다 */
const WARNING_VIBRATION_MS = 15;
/** 달그락 소리 사이 최소 간격(ms)과 소리가 나는 최소 세기. 센서 이벤트마다 내면 소리가 뭉개진다 */
const RATTLE_GAP_MS = 90;
const RATTLE_MIN_INTENSITY = 4;
/** 남은 시간 표시 갱신 주기. 화면에는 초 단위로만 보인다 */
const REMAINING_TICK_MS = 100;
/** 남은 시간을 빨갛게 보여주는 시점. 10초 게임이라 엔진 기본값(10초)이면 처음부터 빨갛다 */
const URGENT_MS = 3_000;
/** 이 이상 섞였으면 "거의 다 섞였어요"로 격려한다 */
const ALMOST_MIXED_PERCENT = 90;
/** 스크린리더에 섞인 정도를 알리는 간격(%) */
const ANNOUNCE_STEP_PERCENT = 25;
const AWAY_NOTICE = '다른 화면으로 나가서 판을 멈췄어요. 다시 시작해 주세요.';

function headlineOf(result: ShakeResult): string {
  if (result.mixPercent < ALMOST_MIXED_PERCENT) return '덜 섞였어요';
  if (result.mixPercent < 100) return '거의 다 섞였어요! 조금만 더';
  if (result.spills === 0) return '완벽한 버블티!';
  return '완성! 조금 흘렸어요';
}

/** 동작 줄이기 설정이면 컵을 흔들지 않는다(게이지는 그대로 움직인다) */
function motionScale(): number {
  const isReduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return isReduced ? 0 : 1;
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
  /** 스크린리더에 읽어 줄 상태 변화(섞임 25%마다, 넘침, 다 섞임) */
  const [announcement, setAnnouncement] = useState('');
  /** 시작 화면에 보여줄 안내(예: 다른 화면으로 나가 판이 멈춤) */
  const [notice, setNotice] = useState('');
  // 흔드는 동안 매 이벤트 바뀌는 값은 ref에 둔다(화면은 drawCup·drawHud가 직접 갱신)
  const cupElements = useRef(createCupElements());
  const shake = useRef(startShake());
  const startMs = useRef<number | null>(null);
  const lastRattleMs = useRef(-Infinity);
  const isWarning = useRef(false);
  const announcedStep = useRef(0);
  const { phase, end } = session;
  const canShake = phase === 'playing' && !isFinished;

  /** 흔들기 한 번을 반영한다. 시각은 performance.now 기준 */
  const addSample = (nowMs: number, intensity: number) => {
    if (!canShake || startMs.current === null) return;
    const before = shake.current;
    const after = applyShake(before, { atMs: nowMs - startMs.current, intensity });
    shake.current = after;
    if (after.spillTimesMs.length > before.spillTimesMs.length) {
      setSpills(after.spillTimesMs.length);
      setAnnouncement(`넘쳤어요! −${SPILL_PENALTY}점`);
      vibrate(SPILL_VIBRATION);
      playSpill();
      return;
    }
    if (mixRatio(before) < 1 && mixRatio(after) >= 1) {
      setAnnouncement('다 섞였어요!');
      playFullyMixed();
      return;
    }
    if (intensity >= RATTLE_MIN_INTENSITY && nowMs - lastRattleMs.current >= RATTLE_GAP_MS) {
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
    if (inputMode === 'motion') addSample(performance.now(), intensityFromMotion(sample));
  };
  const motion = useDeviceMotion(handleMotion, phase === 'countdown' || phase === 'playing');

  const handleFieldShake = (input: { nowMs: number; intensity: number; source: ShakeSource }) => {
    if (inputMode === 'motion') {
      // 센서는 있지만 흔들 수 없는 기기(센서 달린 노트북 등): 아직 섞인 것이 없을 때
      // 분명히 문지르면 한 번만 그 방식으로 바꾼다. 화면을 살짝 스친 정도로는 바꾸지 않는다
      if (shake.current.mix > 0 || input.intensity < NOISE_FLOOR) return;
      setInputMode(input.source);
    } else if (input.source === 'keys' && inputMode === 'pointer') {
      // 키보드는 박자만 맞추면 쉬워 키보드 랭킹으로 따로 기록한다
      setInputMode('keys');
    }
    addSample(input.nowMs, input.intensity);
  };

  /** 매 프레임: 경고 구간에 들어가는 순간 소리·진동, 섞임 25%마다 스크린리더 안내 */
  const handleFrameCues = useEffectEvent(({ envelope, mix }: { envelope: number; mix: number }) => {
    const isWarningNow = envelope >= WARNING_ENVELOPE;
    if (isWarningNow && !isWarning.current) {
      playWarning();
      vibrate(WARNING_VIBRATION_MS);
    }
    isWarning.current = isWarningNow;
    const step = Math.floor((mix * 100) / ANNOUNCE_STEP_PERCENT) * ANNOUNCE_STEP_PERCENT;
    if (step > announcedStep.current && step < 100) {
      announcedStep.current = step;
      setAnnouncement(`섞임 ${step}%`);
    }
  });

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
    const scale = motionScale();
    startMs.current = start;
    isWarning.current = false;
    announcedStep.current = 0;

    let frame = requestAnimationFrame(function draw() {
      const elapsedMs = performance.now() - start;
      const state = shake.current;
      const isOver = elapsedMs >= DURATION_MS;
      // 끝나면 컵을 바로 세워 빨대 연출을 보여준다
      const envelope = isOver ? 0 : envelopeAt(state, elapsedMs);
      const mix = mixRatio(state);
      const secondsDone = Math.min(Math.floor(elapsedMs / 1_000), SECONDS);
      drawCup(cupElements.current, {
        intensity: envelope,
        mix,
        timeMs: elapsedMs,
        motionScale: scale,
      });
      drawHud(cupElements.current, {
        mix,
        envelope,
        ratings: Array.from({ length: secondsDone }, (_, second) => rateSecond(state, second)),
      });
      handleFrameCues({ envelope, mix });
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

  const backToStart = () => {
    setIsFinished(false);
    setSpills(0);
    session.reset();
  };

  // 플레이 중 다른 화면으로 나가면 그동안 흔들 수 없는데 시간은 흐른다. 판을 멈추고 시작 화면으로 돌린다
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

  const startRound = () => {
    shake.current = startShake();
    setInputMode('pointer');
    setSpills(0);
    setResult(null);
    setIsFinished(false);
    setAnnouncement('');
    setNotice('');
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
          notice={notice}
          onStart={handleStart}
        >
          {cup}
        </ReadyField>
      )}
      {phase === 'playing' && (
        <ShakeField inputMode={inputMode} announcement={announcement} onShake={handleFieldShake}>
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
          metadata={{
            inputMode,
            mixPercent: result.mixPercent,
            steadySeconds: result.steadySeconds,
            spills: result.spills,
          }}
          onRestart={handleStart}
        />
      )}
    </GameShell>
  );
}
