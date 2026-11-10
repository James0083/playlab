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
import { Bowl, createBowlElements, drawBowl } from './Bowl.tsx';
import { drawHud } from './Hud.tsx';
import { ReadyField } from './ReadyField.tsx';
import { ResultStats, type InputMode } from './ResultStats.tsx';
import {
  applyTurn,
  clumpEfficiency,
  DURATION_MS,
  finalResult,
  MAX_BONUS_SWITCHES,
  mixRatio,
  motionTurns,
  startMotionTracker,
  startStir,
  strokeZone,
  SWITCH_POINTS,
  type StirResult,
  type StrokeZone,
} from './rules.ts';
import { playClump, playFinish, playFullyMixed, playStir, playSwitch } from './sounds.ts';
import { StirField, type StirSource } from './StirField.tsx';

const SLUG = 'jjajang';
const TITLE = '짜장면 비비기';
/** 입력 방식마다 랭킹을 따로 둔다. 폰 돌리기·원 그리기·키보드는 같은 점수로 겨루기 어렵다 */
const BOARD: Record<InputMode, string> = { motion: 'motion', pointer: 'pointer', keys: 'keys' };
/** 시간이 끝난 뒤 젓가락으로 면을 들어 올리는 연출 시간(ms). 끝나고 결과 화면으로 넘어간다 */
const FINALE_MS = 1_200;
const SWITCH_VIBRATION_MS = 15;
const CLUMP_VIBRATION = [30, 40, 30];
/** 휘젓는 소리 사이 돌린 양(바퀴). 입력마다 내면 소리가 뭉개진다 */
const STIR_SOUND_TURNS = 0.2;
/** 남은 시간 표시 갱신 주기. 화면에는 초 단위로만 보인다 */
const REMAINING_TICK_MS = 100;
/** 남은 시간을 빨갛게 보여주는 시점. 10초 게임이라 엔진 기본값(10초)이면 처음부터 빨갛다 */
const URGENT_MS = 3_000;
/** 이 이상 비볐으면 "거의 다 비볐어요"로 격려한다 */
const ALMOST_MIXED_PERCENT = 90;
/** 스크린리더에 비빈 정도를 알리는 간격(%) */
const ANNOUNCE_STEP_PERCENT = 25;
const AWAY_NOTICE = '다른 화면으로 나가서 판을 멈췄어요. 다시 시작해 주세요.';

/** 점수와 함께 저장하는 기록(랭킹 검토용) */
function metadataOf(result: StirResult, inputMode: InputMode) {
  return {
    inputMode,
    mixPercent: result.mixPercent,
    switches: result.switches,
    mixedAtMs: result.mixedAtMs === null ? null : Math.round(result.mixedAtMs),
    clumpedTurns: result.clumpedTurns,
  };
}

function headlineOf(result: StirResult): string {
  if (result.mixPercent < ALMOST_MIXED_PERCENT) return '덜 비벼졌어요';
  if (result.mixPercent < 100) return '거의 다 비볐어요! 조금만 더';
  if (result.switches >= MAX_BONUS_SWITCHES && result.clumpedTurns === 0)
    return '완벽하게 비볐어요!';
  return '잘 비볐어요!';
}

/** 동작 줄이기 설정이면 면을 돌리지 않는다(젓가락과 게이지는 그대로 움직인다) */
function motionScale(): number {
  const isReduced =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  return isReduced ? 0 : 1;
}

export function JjajangGame() {
  // 끝나는 연출을 넣기 위해 시간은 게임이 직접 잰다(엔진 타이머는 시간이 다 되면 바로 결과로 넘긴다)
  const session = useGameSession({ durationMs: null });
  const { vibrate } = useHaptics();
  const [inputMode, setInputMode] = useState<InputMode>('pointer');
  /** 보너스를 받은 방향 바꾸기 횟수("+5" 표시용). 드물게 바뀌어 상태로 둔다 */
  const [bonusSwitches, setBonusSwitches] = useState(0);
  const [remainingMs, setRemainingMs] = useState(DURATION_MS);
  const [result, setResult] = useState<StirResult | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  /** 스크린리더에 읽어 줄 상태 변화(비빔 25%마다, 뭉침, 방향 바꾸기, 다 비빔) */
  const [announcement, setAnnouncement] = useState('');
  /** 시작 화면에 보여줄 안내(예: 다른 화면으로 나가 판이 멈춤) */
  const [notice, setNotice] = useState('');
  // 돌리는 동안 매 입력 바뀌는 값은 ref에 둔다(화면은 drawBowl·drawHud가 직접 갱신)
  const bowlElements = useRef(createBowlElements());
  const stir = useRef(startStir());
  const tracker = useRef(startMotionTracker());
  /** 화면에 보여줄 돌린 각도(바퀴). 속도 상한과 관계없이 손을 그대로 따라간다 */
  const angleTurns = useRef(0);
  /** 휘젓는 소리를 마지막으로 낸 뒤 돌린 양(바퀴) */
  const turnsSinceSound = useRef(0);
  const startMs = useRef<number | null>(null);
  const zone = useRef<StrokeZone>('short');
  const announcedStep = useRef(0);
  const { phase, end } = session;
  const canStir = phase === 'playing' && !isFinished;

  /** 돌린 입력 하나를 반영한다. 시각은 performance.now 기준, 양수 = 시계 방향 */
  const addTurn = (nowMs: number, turns: number) => {
    if (!canStir || startMs.current === null) return;
    angleTurns.current += turns;
    const before = stir.current;
    const after = applyTurn(before, { atMs: nowMs - startMs.current, turns });
    stir.current = after;
    if (after.switches > before.switches && after.switches <= MAX_BONUS_SWITCHES) {
      setBonusSwitches(after.switches);
      setAnnouncement(`방향 바꾸기 ${after.switches}번! +${SWITCH_POINTS}점`);
      vibrate(SWITCH_VIBRATION_MS);
      playSwitch();
      return;
    }
    if (mixRatio(before) < 1 && mixRatio(after) >= 1) {
      setAnnouncement('다 비볐어요!');
      playFullyMixed();
      return;
    }
    turnsSinceSound.current += Math.abs(turns);
    if (turnsSinceSound.current >= STIR_SOUND_TURNS) {
      turnsSinceSound.current = 0;
      playStir(mixRatio(after));
    }
  };

  const handleMotion = (sample: MotionSample) => {
    // 카운트다운 동안 센서 값이 들어오면 폰 돌리기로 플레이한다. 안 들어오면 화면에 원 그리기로 한다
    if (phase === 'countdown') {
      setInputMode('motion');
      return;
    }
    if (inputMode !== 'motion') return;
    const measured = motionTurns(tracker.current, {
      atMs: sample.timestamp,
      linearAcceleration: sample.linearAcceleration,
      spinRate: sample.rotationRate?.alpha ?? null,
    });
    tracker.current = measured.tracker;
    if (measured.turns !== 0) addTurn(performance.now(), measured.turns);
  };
  const motion = useDeviceMotion(handleMotion, phase === 'countdown' || phase === 'playing');

  const handleFieldTurn = (input: { nowMs: number; turns: number; source: StirSource }) => {
    if (inputMode === 'motion') {
      // 센서는 있지만 돌릴 수 없는 기기(센서 달린 노트북 등): 아직 비빈 것이 없을 때
      // 화면에 원을 그리거나 키를 누르면 한 번만 그 방식으로 바꾼다
      if (stir.current.mix > 0) return;
      setInputMode(input.source);
    } else if (input.source === 'keys' && inputMode === 'pointer') {
      // 키보드는 박자만 맞추면 쉬워 키보드 랭킹으로 따로 기록한다
      setInputMode('keys');
    }
    addTurn(input.nowMs, input.turns);
  };

  /** 매 프레임: 뭉치는 구간에 들어가는 순간 소리·진동, 비빔 25%마다 스크린리더 안내 */
  const handleFrameCues = useEffectEvent(
    ({ zone: zoneNow, mix }: { zone: StrokeZone; mix: number }) => {
      if (zoneNow === 'clump' && zone.current !== 'clump') {
        playClump();
        vibrate(CLUMP_VIBRATION);
        setAnnouncement('면이 뭉쳐요! 반대로 돌려요');
      }
      zone.current = zoneNow;
      const step = Math.floor((mix * 100) / ANNOUNCE_STEP_PERCENT) * ANNOUNCE_STEP_PERCENT;
      if (step > announcedStep.current && step < 100) {
        announcedStep.current = step;
        setAnnouncement(`비빔 ${step}%`);
      }
    },
  );

  const finish = useEffectEvent(() => {
    const outcome = finalResult(stir.current);
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
    zone.current = 'short';
    announcedStep.current = 0;

    let frame = requestAnimationFrame(function draw() {
      const elapsedMs = performance.now() - start;
      const state = stir.current;
      const isOver = elapsedMs >= DURATION_MS;
      const mix = mixRatio(state);
      const strokeTurns = state.stroke?.turns ?? 0;
      const zoneNow = strokeZone(strokeTurns);
      drawBowl(bowlElements.current, {
        angleTurns: angleTurns.current,
        mix,
        efficiency: clumpEfficiency(strokeTurns),
        motionScale: scale,
      });
      drawHud(bowlElements.current, {
        mix,
        stroke: state.stroke,
        zone: isOver ? 'short' : zoneNow,
        switches: Math.min(state.switches, MAX_BONUS_SWITCHES),
      });
      handleFrameCues({ zone: zoneNow, mix });
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

  /** 한 판의 기록과 그릇 그림을 처음 상태로 되돌린다 */
  const clearRound = () => {
    stir.current = startStir();
    tracker.current = startMotionTracker();
    angleTurns.current = 0;
    turnsSinceSound.current = 0;
    setBonusSwitches(0);
    setIsFinished(false);
  };

  const backToStart = () => {
    clearRound();
    session.reset();
  };

  // 플레이 중 다른 화면으로 나가면 그동안 돌릴 수 없는데 시간은 흐른다. 판을 멈추고 시작 화면으로 돌린다
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
    clearRound();
    setInputMode('pointer');
    setResult(null);
    setAnnouncement('');
    setNotice('');
    setRemainingMs(DURATION_MS);
    session.start();
  };

  const handleStart = () => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    // iOS는 동작 센서 권한도 탭 안에서 물어야 한다. 답을 받은 뒤에 카운트다운을 시작해야
    // 카운트다운 동안 센서 값이 들어와 폰 돌리기로 플레이할 수 있다(거부하면 원 그리기)
    if (motion.status === 'needs-permission') {
      void motion.requestPermission().then(startRound);
      return;
    }
    startRound();
  };

  // 시작 화면에서는 홈으로, 그 외(카운트다운·플레이·결과)에서는 시작 화면으로 돌아간다
  const handleBack = phase === 'idle' ? goHome : backToStart;
  const bowl = (
    <Bowl elementsRef={bowlElements} bonusSwitches={bonusSwitches} isFinished={isFinished} />
  );

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
          {bowl}
        </ReadyField>
      )}
      {phase === 'playing' && (
        <StirField inputMode={inputMode} announcement={announcement} onTurn={handleFieldTurn}>
          {bowl}
        </StirField>
      )}
      {phase === 'result' && result && (
        <ScoreResult
          slug={SLUG}
          board={BOARD[inputMode]}
          title={TITLE}
          score={session.score}
          headline={headlineOf(result)}
          details={<ResultStats result={result} inputMode={inputMode} />}
          metadata={metadataOf(result, inputMode)}
          onRestart={handleStart}
        />
      )}
    </GameShell>
  );
}
