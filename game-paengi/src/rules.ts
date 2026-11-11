// 팽이 돌리기 규칙. React 없이 테스트할 수 있는 순수 함수로 둔다(서버 재판정에서도 그대로 쓴다).
//
// 1단계 돌리기(5초): 팽이 둘레에 원을 그려 회전 속도(RPM)를 올린다. 한 방향으로만 돌려야 하고
//   반대로 돌리면 회전이 줄어든다.
// 2단계 균형: 회전이 서서히 줄고, 느려질수록 팽이가 크게 흔들리며 판 위를 미끄러진다.
//   판을 기울여 팽이를 가운데에 둔다. 판 밖으로 나가거나 회전이 멈추면 쓰러진다.
// 점수 = 균형 단계에서 버틴 시간(0.1초당 1점).
// 수치는 플랜에 없어 정한 임시 값이다. 실기기 플레이테스트 후 조정한다.

// ── 1단계: 돌리기 ──────────────────────────────────────────────

export const SPIN_MS = 5_000;
/** 1초에 이 바퀴 수까지만 인정한다. 이보다 빠른 입력(센서 튐, 매크로)은 이 속도로 깎는다 */
export const MAX_TURNS_PER_SECOND = 3;
/** 입력 사이 간격은 이만큼까지만 인정한다(손을 뗐다 다시 대도 그 사이를 돌린 것으로 치지 않는다) */
const MAX_SAMPLE_GAP_MS = 250;
/** 처음에 이만큼(바퀴) 한쪽으로 돌려야 팽이 방향이 정해진다(손떨림으로 방향이 정해지지 않게) */
const DIRECTION_LOCK_TURNS = 0.25;
/**
 * 한 바퀴에 오르는 회전 속도. 실제 팽이(채로 친 나무 팽이)는 1,000~2,000 RPM으로 돈다(2026-11-11 상향, 예전 40).
 * 회전 관련 값(감소 속도·쓰러지는 기준)은 모두 같은 비율로 올려 버티는 시간과 점수는 그대로다
 */
export const RPM_PER_TURN = 120;
/** 가장 빠른 회전 속도(1,800). 5초 동안 인정 속도 상한으로 돌린 경우(15바퀴) */
export const MAX_RPM = ((MAX_TURNS_PER_SECOND * SPIN_MS) / 1_000) * RPM_PER_TURN;

/** 돌린 방향. 1 = 시계, -1 = 반시계 */
export type Direction = 1 | -1;

export interface SpinState {
  /** 정해진 방향. 아직 정해지지 않았으면 null */
  direction: Direction | null;
  /** 방향이 정해지기 전에 쌓인 회전(부호 있음) */
  pendingTurns: number;
  /** 정해진 방향으로 돌린 바퀴 수(반대로 돌리면 줄어든다, 0 아래로는 내려가지 않음) */
  turns: number;
  /** 반대로 돌려 깎인 바퀴 수 */
  reversedTurns: number;
  lastAtMs: number | null;
}

export function startSpin(): SpinState {
  return { direction: null, pendingTurns: 0, turns: 0, reversedTurns: 0, lastAtMs: null };
}

/** 직전 입력부터 지난 시간에 허용되는 만큼으로 회전량을 깎는다 */
function limitTurns(lastAtMs: number | null, { atMs, turns }: TurnSample): number {
  if (lastAtMs === null) return 0;
  const gapMs = Math.min(atMs - lastAtMs, MAX_SAMPLE_GAP_MS);
  const limit = (MAX_TURNS_PER_SECOND * gapMs) / 1_000;
  return Math.min(Math.max(turns, -limit), limit);
}

/** 돌린 입력 하나(직전 입력 뒤로 돈 바퀴 수, 양수 = 시계 방향) */
export interface TurnSample {
  /** 돌리기 시작부터의 시각(ms) */
  atMs: number;
  turns: number;
}

/** 입력 하나를 반영한 새 상태. 돌리기 시간 밖이거나 시간이 거꾸로 가는 입력은 무시한다 */
export function applySpin(state: SpinState, sample: TurnSample): SpinState {
  const { atMs } = sample;
  if (atMs < 0 || atMs >= SPIN_MS) return state;
  if (state.lastAtMs !== null && atMs <= state.lastAtMs) return state;
  const step = limitTurns(state.lastAtMs, sample);
  const next = { ...state, lastAtMs: atMs };
  if (state.direction === null) {
    const pending = state.pendingTurns + step;
    if (Math.abs(pending) < DIRECTION_LOCK_TURNS) return { ...next, pendingTurns: pending };
    return { ...next, pendingTurns: 0, direction: pending > 0 ? 1 : -1, turns: Math.abs(pending) };
  }
  const along = step * state.direction;
  if (along >= 0) return { ...next, turns: state.turns + along };
  // 반대로 돌리면 팽이가 느려진다
  const reduced = Math.min(-along, state.turns);
  return { ...next, turns: state.turns - reduced, reversedTurns: state.reversedTurns + -along };
}

/** 돌리기로 얻은 회전 속도 */
export function rpmOf(spin: SpinState): number {
  return Math.min(spin.turns * RPM_PER_TURN, MAX_RPM);
}

// ── 2단계: 균형 ──────────────────────────────────────────────

/** 균형 단계는 이 간격(ms)으로 한 걸음씩 계산한다. 화면 주사율과 관계없이 같은 결과가 나온다 */
export const STEP_MS = 1_000 / 60;
/** 이 회전 속도 아래로 떨어지면 쓰러진다 */
export const FALL_RPM = 300;
/** 가만히 있어도 초당 줄어드는 회전 속도 */
const BASE_DECAY_PER_SECOND = 60;
/** 가운데에서 멀수록 판에 쓸려 더 빨리 느려진다: 추가 감소 = 이 값 × (가운데에서 거리)² */
const EDGE_DECAY_PER_SECOND = 120;
/** 판을 가장 크게 기울였을 때 팽이가 받는 가속도(판 반지름/초²) */
const TILT_ACCELERATION = 2.5;
/** 판이 오목해 가운데로 끌어당기는 힘(거리에 비례) */
const CENTER_PULL = 0.3;
/** 미끄러지는 속도를 줄이는 마찰 */
const DAMPING = 1.5;
/**
 * 흔들림이 팽이를 미는 힘. 회전이 느릴수록 세다: 이 값 × (가장 빠른 회전 / 지금 회전).
 * 가장 빠를 때 0.25, 회전이 절반이면 0.5, 쓰러지기 직전(300)이면 1.5
 */
const WOBBLE_AT_MAX_RPM = 0.25;
/** 흔들림 방향이 바뀌는 빠르기(라디안/초). 바깥에서 준 drift(−1~1)에 곱한다 */
const WOBBLE_TURN_RATE = 2.5;

/** 이론상 최고 점수: 가장 빠르게 돌리고 가운데를 지켜 회전이 다 줄 때까지 버틴 경우(0.1초당 1점) */
export const MAX_SCORE = Math.floor(((MAX_RPM - FALL_RPM) / BASE_DECAY_PER_SECOND) * 10);

type Vector = { x: number; y: number };

/** 쓰러진 이유: 회전이 멈춤 / 판 밖으로 나감 */
export type FallReason = 'stopped' | 'out';

export interface BalanceState {
  rpm: number;
  /** 판 위 위치(가운데 0, 판 가장자리 반지름 1) */
  position: Vector;
  velocity: Vector;
  /** 흔들림이 미는 방향(라디안) */
  wobbleAngle: number;
  /** 버틴 시간(ms) */
  elapsedMs: number;
  /** 쓰러졌으면 그 이유 */
  fallen: FallReason | null;
}

export function startBalance(rpm: number, wobbleAngle = 0): BalanceState {
  return {
    rpm,
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    wobbleAngle,
    elapsedMs: 0,
    fallen: rpm <= FALL_RPM ? 'stopped' : null,
  };
}

/** 지금 흔들림이 미는 힘 */
export function wobbleOf(rpm: number): number {
  return rpm <= 0 ? Infinity : (WOBBLE_AT_MAX_RPM * MAX_RPM) / rpm;
}

/** 크기가 1을 넘지 않게 줄인다 */
export function clampToUnit({ x, y }: Vector): Vector {
  const length = Math.hypot(x, y);
  return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

/**
 * 한 걸음(STEP_MS) 계산한 새 상태.
 * @param tilt 판을 기울인 방향과 크기(크기 1 = 가장 크게). 팽이가 이 방향으로 미끄러진다
 * @param drift 흔들림 방향이 바뀌는 정도(−1~1). 게임은 난수를, 테스트는 정해진 값을 넘긴다
 */
export function stepBalance(
  state: BalanceState,
  { tilt, drift }: { tilt: Vector; drift: number },
): BalanceState {
  if (state.fallen) return state;
  const dt = STEP_MS / 1_000;
  const lean = clampToUnit(tilt);
  const wobble = wobbleOf(state.rpm);
  const wobbleAngle = state.wobbleAngle + Math.min(Math.max(drift, -1), 1) * WOBBLE_TURN_RATE * dt;
  const { position, velocity } = state;
  const accelerate = (axis: 'x' | 'y', push: number) =>
    TILT_ACCELERATION * lean[axis] +
    wobble * push -
    CENTER_PULL * position[axis] -
    DAMPING * velocity[axis];
  const nextVelocity = {
    x: velocity.x + accelerate('x', Math.cos(wobbleAngle)) * dt,
    y: velocity.y + accelerate('y', Math.sin(wobbleAngle)) * dt,
  };
  const nextPosition = {
    x: position.x + nextVelocity.x * dt,
    y: position.y + nextVelocity.y * dt,
  };
  const distance = Math.hypot(nextPosition.x, nextPosition.y);
  const rpm = state.rpm - (BASE_DECAY_PER_SECOND + EDGE_DECAY_PER_SECOND * distance ** 2) * dt;
  return {
    rpm,
    position: nextPosition,
    velocity: nextVelocity,
    wobbleAngle,
    elapsedMs: state.elapsedMs + STEP_MS,
    fallen: fallReason({ distance, rpm }),
  };
}

function fallReason({ distance, rpm }: { distance: number; rpm: number }): FallReason | null {
  if (distance > 1) return 'out';
  if (rpm <= FALL_RPM) return 'stopped';
  return null;
}

/** 점수: 버틴 시간 0.1초당 1점 */
export function scoreOf(balance: BalanceState): number {
  return Math.min(Math.floor(balance.elapsedMs / 100 + 1e-9), MAX_SCORE);
}

// ── 기울이기 입력 ──────────────────────────────────────────────

/** 폰을 이 각도(도)만큼 기울이면 가장 크게 기울인 것으로 본다 */
const MAX_TILT_DEGREES = 25;

/**
 * 폰 기울기에서 판 기울기. 균형 단계를 시작할 때의 자세(baseline)를 기준으로 잰다
 * (사람마다 폰을 드는 각도가 다르다). 오른쪽을 낮추면(gamma +) 오른쪽, 위쪽을 들면(beta +) 아래쪽으로 미끄러진다
 */
export function tiltFromOrientation(
  orientation: { beta: number; gamma: number },
  baseline: { beta: number; gamma: number },
): Vector {
  return clampToUnit({
    x: (orientation.gamma - baseline.gamma) / MAX_TILT_DEGREES,
    y: (orientation.beta - baseline.beta) / MAX_TILT_DEGREES,
  });
}

/**
 * 마우스·터치 위치에서 판 기울기: 누른 곳 쪽으로 판이 기운다.
 * @param offset 판 가운데에서 누른 곳까지(px)
 * @param radius 판 반지름(px). 가장자리를 누르면 가장 크게 기운다
 */
export function tiltFromPointer(offset: Vector, radius: number): Vector {
  if (radius <= 0) return { x: 0, y: 0 };
  return clampToUnit({ x: offset.x / radius, y: offset.y / radius });
}

const KEY_TILTS: Record<string, Vector> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
};
export const TILT_KEYS: ReadonlySet<string> = new Set(Object.keys(KEY_TILTS));

/** 누르고 있는 방향키들에서 판 기울기(대각선도 크기 1) */
export function tiltFromKeys(pressed: ReadonlySet<string>): Vector {
  let x = 0;
  let y = 0;
  for (const key of pressed) {
    x += KEY_TILTS[key]?.x ?? 0;
    y += KEY_TILTS[key]?.y ?? 0;
  }
  const length = Math.hypot(x, y);
  return length === 0 ? { x: 0, y: 0 } : { x: x / length, y: y / length };
}
