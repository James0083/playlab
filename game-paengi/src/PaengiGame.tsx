import {
  backGoesHome,
  GameShell,
  goHome,
  motionReadingOf,
  motionTurns,
  ScoreResult,
  startMotionTracker,
  unlockAudio,
  useDeviceMotion,
  useGameSession,
  useHaptics,
  type MotionSample,
} from '@minigames/engine';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { headlineOf, topResultOf, type TopResult } from './advice.ts';
import {
  advanceSpin,
  createDishElements,
  Dish,
  drawDish,
  readMotionScale,
  timeTextOf,
  viewOf,
  type Stage,
} from './Dish.tsx';
import { PlayField, type FieldSource } from './PlayField.tsx';
import { ReadyField } from './ReadyField.tsx';
import { metadataOf, ResultStats, type InputMode } from './ResultStats.tsx';
import {
  applySpin,
  MAX_RPM,
  MAX_TURNS_PER_SECOND,
  rpmOf,
  SPIN_MS,
  startBalance,
  startSpin,
  stepBalance,
  STEP_MS,
  tiltFromOrientation,
  type BalanceState,
  type Direction,
} from './rules.ts';
import { playEdgeWarning, playFall, playHum, playLand, playWhoosh } from './sounds.ts';

const SLUG = 'paengi';
const TITLE = '팽이 돌리기';
/** 입력 방식마다 랭킹을 따로 둔다 */
const BOARD: Record<InputMode, string> = { motion: 'motion', pointer: 'pointer', keys: 'keys' };
/** 돌리기가 끝나고 팽이를 판에 내려놓은 뒤 균형이 시작되기까지(ms). 폰을 편하게 고쳐 들 시간 */
const SETTLE_MS = 1_500;
/** 쓰러지는 연출 시간(ms). 끝나고 결과 화면으로 넘어간다 */
const FINALE_MS = 1_200;
/** 균형 단계에서 한 프레임에 계산하는 시간의 상한(ms). 탭이 잠시 멈췄다 돌아와도 한꺼번에 튀지 않게 */
const MAX_FRAME_MS = 100;
/** 휙 소리 사이 돌린 양(바퀴), 윙 소리 간격(ms) */
const WHOOSH_TURNS = 0.25;
const HUM_INTERVAL_MS = 300;
/** 가장자리 경고를 내는 거리(판 반지름 1 기준) */
const EDGE_CUE_AT = 0.75;
const FALL_VIBRATION = [60, 40, 120];
const EDGE_VIBRATION_MS = 20;
const AWAY_NOTICE = '다른 화면으로 나가서 판을 멈췄어요. 다시 시작해 주세요.';
const NO_TILT = { x: 0, y: 0 };

export function PaengiGame() {
  const session = useGameSession({ durationMs: null });
  const { vibrate } = useHaptics();
  const [inputMode, setInputMode] = useState<InputMode>('pointer');
  const [stage, setStage] = useState<Stage>('spin');
  const [direction, setDirection] = useState<Direction | null>(null);
  const [result, setResult] = useState<TopResult | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [notice, setNotice] = useState('');
  // 매 입력·매 프레임 바뀌는 값은 ref에 둔다(화면은 drawDish가 직접 갱신)
  const dishElements = useRef(createDishElements());
  const stageRef = useRef<Stage>('spin');
  const spin = useRef(startSpin());
  const balance = useRef<BalanceState | null>(null);
  const tracker = useRef(startMotionTracker());
  /** 마우스·키보드로 기울인 정도 */
  const tilt = useRef(NO_TILT);
  /** 최근 폰 자세와, 균형을 시작할 때의 자세(기준) */
  const orientation = useRef({ beta: 0, gamma: 0 });
  const baseline = useRef({ beta: 0, gamma: 0 });
  const spinDegrees = useRef(0);
  const stageStartMs = useRef(0);
  const turnsSinceWhoosh = useRef(0);
  const isNearEdge = useRef(false);
  const motionScale = useRef(1);
  const { phase, end } = session;

  const changeStage = (next: Stage, nowMs: number) => {
    stageRef.current = next;
    stageStartMs.current = nowMs;
    setStage(next);
  };

  /** 돌리기 단계의 입력 하나. 시각은 performance.now 기준 */
  const addTurn = (nowMs: number, turns: number) => {
    if (phase !== 'playing' || stageRef.current !== 'spin') return;
    const before = spin.current;
    const after = applySpin(before, { atMs: nowMs - stageStartMs.current, turns });
    spin.current = after;
    if (after.direction !== before.direction) setDirection(after.direction);
    turnsSinceWhoosh.current += Math.abs(turns);
    if (turnsSinceWhoosh.current >= WHOOSH_TURNS) {
      turnsSinceWhoosh.current = 0;
      playWhoosh(rpmOf(after) / MAX_RPM);
    }
  };

  const handleMotion = (sample: MotionSample) => {
    orientation.current = { beta: sample.orientation.beta, gamma: sample.orientation.gamma };
    // 카운트다운 동안 센서 값이 들어오면 폰으로 플레이한다
    if (phase === 'countdown') {
      setInputMode('motion');
      return;
    }
    if (inputMode !== 'motion') return;
    const measured = motionTurns(tracker.current, motionReadingOf(sample));
    tracker.current = measured.tracker;
    if (measured.turns !== 0) addTurn(performance.now(), measured.turns);
  };
  const motion = useDeviceMotion(handleMotion, phase === 'countdown' || phase === 'playing');

  /** 센서는 있지만 쓸 수 없는 기기: 아직 돌린 것이 없을 때 화면·키를 쓰면 그 방식으로 바꾼다 */
  const adoptFieldInput = (source: FieldSource) => {
    if (inputMode === 'motion' && spin.current.turns === 0 && spin.current.direction === null) {
      setInputMode(source);
    } else if (source === 'keys' && inputMode === 'pointer') {
      setInputMode('keys');
    }
  };

  const handleFieldTurn = (input: { nowMs: number; turns: number; source: FieldSource }) => {
    if (inputMode === 'motion' && spin.current.direction !== null) return;
    adoptFieldInput(input.source);
    addTurn(input.nowMs, input.turns);
  };

  const handleFieldTilt = (input: { tilt: { x: number; y: number }; source: FieldSource }) => {
    if (inputMode === 'motion') return; // 폰은 기울기로만 조종한다
    if (input.source === 'keys') adoptFieldInput('keys');
    tilt.current = input.tilt;
  };

  const currentTilt = () =>
    inputMode === 'motion'
      ? tiltFromOrientation(orientation.current, baseline.current)
      : tilt.current;

  const fall = (state: BalanceState) => {
    changeStage('fallen', performance.now());
    vibrate(FALL_VIBRATION);
    playFall();
    const outcome = topResultOf(state, spin.current);
    session.addScore(outcome.score);
    setResult(outcome);
    setAnnouncement(`쓰러졌어요. ${(state.elapsedMs / 1_000).toFixed(1)}초 버텼어요`);
  };

  /** 돌리기 → 자리 잡기 → 균형으로 넘어간다 */
  const advanceStage = (nowMs: number) => {
    const elapsed = nowMs - stageStartMs.current;
    if (stageRef.current === 'spin' && elapsed >= SPIN_MS) {
      changeStage('settle', nowMs);
      playLand();
      setAnnouncement('균형 잡기! 기울여서 팽이를 가운데에 두세요');
    } else if (stageRef.current === 'settle' && elapsed >= SETTLE_MS) {
      // 사람마다 폰을 드는 각도가 달라, 지금 자세를 평평한 것으로 본다
      baseline.current = orientation.current;
      balance.current = startBalance(rpmOf(spin.current), Math.random() * Math.PI * 2);
      changeStage('balance', nowMs);
    }
  };

  /** 균형 단계: 지난 시간을 1/60초 걸음으로 계산한다 */
  const runBalance = (frameMs: number) => {
    let state = balance.current;
    if (!state) return;
    const steps = Math.floor(Math.min(frameMs, MAX_FRAME_MS) / STEP_MS + 0.5);
    for (let i = 0; i < steps && !state.fallen; i++) {
      state = stepBalance(state, { tilt: currentTilt(), drift: Math.random() * 2 - 1 });
    }
    balance.current = state;
    const nearEdge = Math.hypot(state.position.x, state.position.y) >= EDGE_CUE_AT;
    if (nearEdge && !isNearEdge.current) {
      playEdgeWarning();
      vibrate(EDGE_VIBRATION_MS);
    }
    isNearEdge.current = nearEdge;
    if (state.fallen) fall(state);
  };

  /** 한 프레임: 단계 진행, 균형 계산, 그리기. 계속 그려야 하면 true */
  const tick = useEffectEvent((nowMs: number, frameMs: number): boolean => {
    advanceStage(nowMs);
    if (stageRef.current === 'balance') runBalance(frameMs);
    const view = viewOf(stageRef.current, { balance: balance.current, spin: spin.current });
    spinDegrees.current = advanceSpin(spinDegrees.current, { rpm: view.rpm, dtMs: frameMs });
    drawDish(dishElements.current, {
      ...view,
      spinDegrees: spinDegrees.current,
      timeMs: nowMs,
      fallenAtMs: stageRef.current === 'fallen' ? stageStartMs.current : null,
      motionScale: motionScale.current,
      timeText: timeTextOf(stageRef.current, {
        stageMs: nowMs - stageStartMs.current,
        survivedMs: balance.current?.elapsedMs ?? 0,
      }),
      isBalancing: stageRef.current === 'balance',
    });
    return true;
  });

  useEffect(() => {
    if (phase !== 'playing') return;
    let last = performance.now();
    stageStartMs.current = last;
    motionScale.current = readMotionScale();
    let frame = requestAnimationFrame(function draw(now) {
      const frameMs = now - last;
      last = now;
      if (tick(now, frameMs)) frame = requestAnimationFrame(draw);
    });
    // 균형 단계의 "윙" 소리: 회전이 느려질수록 낮아진다
    const hum = setInterval(() => {
      const state = balance.current;
      if (stageRef.current === 'balance' && state) playHum(state.rpm / MAX_RPM);
    }, HUM_INTERVAL_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(hum);
    };
  }, [phase]);

  // 쓰러지는 연출이 끝나면 결과 화면으로 넘어간다
  useEffect(() => {
    if (stage !== 'fallen' || phase !== 'playing') return;
    const id = setTimeout(end, FINALE_MS);
    return () => clearTimeout(id);
  }, [stage, phase, end]);

  const clearRound = () => {
    spin.current = startSpin();
    balance.current = null;
    tracker.current = startMotionTracker();
    tilt.current = NO_TILT;
    spinDegrees.current = 0;
    turnsSinceWhoosh.current = 0;
    isNearEdge.current = false;
    stageRef.current = 'spin';
    setStage('spin');
    setDirection(null);
  };

  const backToStart = () => {
    clearRound();
    session.reset();
  };

  // 플레이 중 다른 화면으로 나가면 그동안 조종할 수 없다. 판을 멈추고 시작 화면으로 돌린다
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
    setAnnouncement(
      `${SPIN_MS / 1_000}초 동안 한 방향으로 돌려요. 초당 ${MAX_TURNS_PER_SECOND}바퀴까지`,
    );
    setNotice('');
    session.start();
  };

  const handleStart = () => {
    unlockAudio(); // 사용자 제스처 안에서 호출해야 iOS에서 소리가 난다
    // iOS는 동작 센서 권한도 탭 안에서 물어야 한다. 답을 받은 뒤에 카운트다운을 시작한다
    if (motion.status === 'needs-permission') {
      void motion.requestPermission().then(startRound);
      return;
    }
    startRound();
  };

  const handleBack = backGoesHome(phase) ? goHome : backToStart;
  const dish = <Dish elementsRef={dishElements} stage={stage} direction={direction} />;

  return (
    <GameShell title={TITLE} onBack={handleBack}>
      {(phase === 'idle' || phase === 'countdown') && (
        <ReadyField
          isCounting={phase === 'countdown'}
          motionStatus={motion.status}
          notice={notice}
          onStart={handleStart}
        >
          {dish}
        </ReadyField>
      )}
      {phase === 'playing' && (
        <PlayField
          stage={stage}
          inputMode={inputMode}
          announcement={announcement}
          onTurn={handleFieldTurn}
          onTilt={handleFieldTilt}
        >
          {dish}
        </PlayField>
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
