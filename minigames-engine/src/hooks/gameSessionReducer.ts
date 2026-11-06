export type GamePhase = 'idle' | 'countdown' | 'playing' | 'result';

export interface GameSessionState {
  phase: GamePhase;
  score: number;
  /** 플레이 시간(ms). null이면 무한 콤보 방식이다. */
  durationMs: number | null;
  /** 남은 시간(ms). 무한 콤보 방식이면 null. */
  remainingMs: number | null;
  /** 플레이 시작 시각(performance.now 기준). 플레이 중이 아니면 null. */
  startedAt: number | null;
}

export type GameSessionAction =
  | { type: 'start' }
  | { type: 'begin'; now: number }
  | { type: 'tick'; now: number }
  | { type: 'addScore'; delta: number }
  | { type: 'end' }
  | { type: 'reset' };

export function createInitialState(durationMs: number | null): GameSessionState {
  return { phase: 'idle', score: 0, durationMs, remainingMs: durationMs, startedAt: null };
}

/**
 * 게임 상태 전이를 한곳에 모은 순수 함수.
 * idle → countdown → playing → result → (reset) idle
 */
export function gameSessionReducer(
  state: GameSessionState,
  action: GameSessionAction,
): GameSessionState {
  switch (action.type) {
    case 'start':
      return { ...createInitialState(state.durationMs), phase: 'countdown' };

    case 'begin':
      if (state.phase !== 'countdown') return state;
      return { ...state, phase: 'playing', startedAt: action.now };

    case 'tick':
      return tick(state, action.now);

    case 'addScore':
      // 플레이 중이 아닐 때 들어온 입력(카운트다운 중 탭 등)은 무시한다.
      if (state.phase !== 'playing') return state;
      return { ...state, score: state.score + action.delta };

    case 'end':
      if (state.phase !== 'playing') return state;
      return { ...state, phase: 'result', startedAt: null };

    case 'reset':
      return createInitialState(state.durationMs);
  }
}

/** 남은 시간을 갱신하고, 시간이 다 되면 결과 단계로 넘긴다. 무한 콤보 방식은 그대로 둔다. */
function tick(state: GameSessionState, now: number): GameSessionState {
  if (state.phase !== 'playing' || state.durationMs === null || state.startedAt === null) {
    return state;
  }
  const remainingMs = Math.max(state.durationMs - (now - state.startedAt), 0);
  if (remainingMs === 0) return { ...state, phase: 'result', remainingMs, startedAt: null };
  return { ...state, remainingMs };
}
